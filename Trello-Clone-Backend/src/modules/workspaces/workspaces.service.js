import crypto from "node:crypto";
import path from "node:path";
import { prisma } from "../../config/db.js";
import { Forbidden, NotFound, BadRequest } from "../../lib/errors.js";
import { invalidateUserPerms } from "../rbac/perms.js";
import { notify } from "../notifications/notifications.service.js";
import { minioPublic, MINIO_BUCKET, publicUrl } from "../../config/minio.js";

// Workspace-scoped role hierarchy. Higher index = more privileged.
const WS_ROLE_RANK = {
  ws_guest: 0,
  ws_member: 1,
  ws_admin: 2,
  ws_owner: 3,
};

async function roleIdByKey(key) {
  const role = await prisma.role.findUnique({ where: { key }, select: { id: true } });
  if (!role) throw BadRequest(`Unknown role: ${key}`, "UNKNOWN_ROLE");
  return role.id;
}

// Returns the user's effective ws role key in a workspace, or null if no access.
export async function getWorkspaceRole(userId, workspaceId) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });
  if (!ws) return { exists: false, role: null };
  if (ws.ownerId === userId) return { exists: true, role: "ws_owner" };

  const now = new Date();
  const rows = await prisma.userRole.findMany({
    where: {
      userId,
      tenantId: workspaceId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { role: { select: { key: true } } },
  });
  let best = null;
  for (const r of rows) {
    const k = r.role.key;
    if (k in WS_ROLE_RANK && (best == null || WS_ROLE_RANK[k] > WS_ROLE_RANK[best])) best = k;
  }
  return { exists: true, role: best };
}

// Reusable guard: throws 404 if workspace missing, 403 if no access / below minRole.
export async function assertWorkspaceAccess(userId, workspaceId, minRole) {
  const { exists, role } = await getWorkspaceRole(userId, workspaceId);
  if (!exists) throw NotFound("Workspace not found");
  if (!role) throw Forbidden("No access to this workspace");
  if (minRole && WS_ROLE_RANK[role] < WS_ROLE_RANK[minRole]) {
    throw Forbidden(`Requires ${minRole} or higher`);
  }
  return role;
}

export async function listWorkspaces(userId) {
  const now = new Date();
  const owned = await prisma.workspace.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, visibility: true, ownerId: true, logoUrl: true, createdAt: true },
  });
  const memberRoles = await prisma.userRole.findMany({
    where: {
      userId,
      tenantId: { not: null },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      role: { key: { in: Object.keys(WS_ROLE_RANK) } },
    },
    select: { tenantId: true, role: { select: { key: true } } },
  });

  const ids = new Set(owned.map((w) => w.id));
  const memberWsIds = [...new Set(memberRoles.map((r) => r.tenantId).filter((id) => !ids.has(id)))];
  const memberWs = memberWsIds.length
    ? await prisma.workspace.findMany({
        where: { id: { in: memberWsIds } },
        select: { id: true, name: true, visibility: true, ownerId: true, logoUrl: true, createdAt: true },
      })
    : [];

  const bestRoleByWs = new Map();
  for (const r of memberRoles) {
    const prev = bestRoleByWs.get(r.tenantId);
    if (prev == null || WS_ROLE_RANK[r.role.key] > WS_ROLE_RANK[prev]) {
      bestRoleByWs.set(r.tenantId, r.role.key);
    }
  }

  const all = [
    ...owned.map((w) => ({ ...w, role: "ws_owner" })),
    ...memberWs.map((w) => ({ ...w, role: bestRoleByWs.get(w.id) ?? "ws_member" })),
  ];

  const counts = await prisma.board.groupBy({
    by: ["workspaceId"],
    where: { workspaceId: { in: all.map((w) => w.id) } },
    _count: { _all: true },
  });
  const countByWs = new Map(counts.map((c) => [c.workspaceId, c._count._all]));

  return all.map((w) => ({
    id: w.id,
    name: w.name,
    visibility: w.visibility,
    ownerId: w.ownerId,
    logoUrl: w.logoUrl ?? null,
    role: w.role,
    boardCount: countByWs.get(w.id) ?? 0,
    createdAt: w.createdAt,
  }));
}

export async function createWorkspace(userId, input) {
  const ownerRoleId = await roleIdByKey("ws_owner");
  const ws = await prisma.workspace.create({
    data: {
      name: input.name,
      visibility: input.visibility ?? "private",
      ownerId: userId,
    },
  });
  await prisma.userRole.create({
    data: { userId, roleId: ownerRoleId, tenantId: ws.id, grantedBy: userId },
  });
  await invalidateUserPerms(userId);
  return { ...ws, role: "ws_owner", boardCount: 0 };
}

export async function getWorkspace(userId, workspaceId) {
  await assertWorkspaceAccess(userId, workspaceId);
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      visibility: true,
      ownerId: true,
      logoUrl: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
  const members = await listMembers(userId, workspaceId, true);
  return { ...ws, members };
}

export async function updateWorkspace(userId, workspaceId, input) {
  await assertWorkspaceAccess(userId, workspaceId, "ws_admin");
  return prisma.workspace.update({
    where: { id: workspaceId },
    data: input,
    select: { id: true, name: true, visibility: true, ownerId: true, logoUrl: true, createdAt: true },
  });
}

// Presigned PUT for a workspace logo (ws_admin). Mirrors avatar upload.
export async function createLogoUpload(userId, workspaceId, { filename, contentType }) {
  await assertWorkspaceAccess(userId, workspaceId, "ws_admin");
  const ext = path.extname(filename || "").slice(0, 16);
  const key = `workspace-logos/${workspaceId}/${crypto.randomUUID()}${ext}`;
  const uploadUrl = await minioPublic.presignedPutObject(MINIO_BUCKET, key, 5 * 60);
  return { uploadUrl, key, fileUrl: publicUrl(key), contentType };
}

export async function deleteWorkspace(userId, workspaceId) {
  await assertWorkspaceAccess(userId, workspaceId, "ws_owner");
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function listMembers(userId, workspaceId, skipAccessCheck = false) {
  if (!skipAccessCheck) await assertWorkspaceAccess(userId, workspaceId);
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true, owner: { select: { id: true, name: true, email: true } } },
  });
  const now = new Date();
  const roles = await prisma.userRole.findMany({
    where: {
      tenantId: workspaceId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      role: { key: { in: Object.keys(WS_ROLE_RANK) } },
    },
    select: {
      userId: true,
      role: { select: { key: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const bestByUser = new Map();
  for (const r of roles) {
    const prev = bestByUser.get(r.userId);
    if (prev == null || WS_ROLE_RANK[r.role.key] > WS_ROLE_RANK[prev.role]) {
      bestByUser.set(r.userId, { user: r.user, role: r.role.key });
    }
  }
  // Owner always present as ws_owner.
  bestByUser.set(ws.ownerId, { user: ws.owner, role: "ws_owner" });

  return [...bestByUser.values()].map((m) => ({
    userId: m.user.id,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
  }));
}

export async function addMember(userId, workspaceId, input) {
  await assertWorkspaceAccess(userId, workspaceId, "ws_admin");
  const target = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true },
  });
  if (!target) throw NotFound("No user with that email", "USER_NOT_FOUND");

  const roleId = await roleIdByKey(input.role);
  const existing = await prisma.userRole.findFirst({
    where: { userId: target.id, roleId, tenantId: workspaceId },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId: target.id, roleId, tenantId: workspaceId, grantedBy: userId },
    });
    await invalidateUserPerms(target.id);
    if (target.id !== userId) {
      notify(target.id, "invite", {
        workspaceId,
        role: input.role,
        invitedBy: userId,
      });
    }
  }
  return { userId: target.id, email: target.email, name: target.name, role: input.role };
}

// Change a member's workspace role (ws_admin+). Owner role is immutable here.
export async function updateMemberRole(actorId, workspaceId, targetUserId, role) {
  await assertWorkspaceAccess(actorId, workspaceId, "ws_admin");
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
  if (!ws) throw NotFound("Workspace not found");
  if (ws.ownerId === targetUserId) throw BadRequest("Cannot change the owner's role", "OWNER_IMMUTABLE");
  const roleId = await roleIdByKey(role);
  await prisma.$transaction([
    prisma.userRole.deleteMany({
      where: { userId: targetUserId, tenantId: workspaceId, role: { key: { in: Object.keys(WS_ROLE_RANK) } } },
    }),
    prisma.userRole.create({ data: { userId: targetUserId, roleId, tenantId: workspaceId, grantedBy: actorId } }),
  ]);
  await invalidateUserPerms(targetUserId);
  return { userId: targetUserId, role };
}

// Remove a member (revoke all ws roles in this workspace). Owner cannot be removed.
export async function removeMember(actorId, workspaceId, targetUserId) {
  await assertWorkspaceAccess(actorId, workspaceId, "ws_admin");
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
  if (!ws) throw NotFound("Workspace not found");
  if (ws.ownerId === targetUserId) throw BadRequest("Cannot remove the owner", "OWNER_IMMUTABLE");
  await prisma.userRole.deleteMany({
    where: { userId: targetUserId, tenantId: workspaceId, role: { key: { in: Object.keys(WS_ROLE_RANK) } } },
  });
  await invalidateUserPerms(targetUserId);
}

/* --------------------------------------------------------- Invite links */

const INVITE_ROLES = ["ws_guest", "ws_member", "ws_admin"];

export async function createInvite(userId, workspaceId, input) {
  await assertWorkspaceAccess(userId, workspaceId, "ws_admin");
  const role = INVITE_ROLES.includes(input?.role) ? input.role : "ws_member";
  const token = crypto.randomBytes(18).toString("base64url");
  const expiresAt = input?.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86400 * 1000)
    : null;
  const invite = await prisma.workspaceInvite.create({
    data: { token, workspaceId, role, createdById: userId, expiresAt },
    select: { token: true, role: true, expiresAt: true, createdAt: true },
  });
  return invite;
}

export async function listInvites(userId, workspaceId) {
  await assertWorkspaceAccess(userId, workspaceId, "ws_admin");
  return prisma.workspaceInvite.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { token: true, role: true, expiresAt: true, createdAt: true },
  });
}

export async function revokeInvite(userId, workspaceId, token) {
  await assertWorkspaceAccess(userId, workspaceId, "ws_admin");
  await prisma.workspaceInvite.deleteMany({ where: { token, workspaceId } });
}

async function loadValidInvite(token) {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    select: { token: true, workspaceId: true, role: true, expiresAt: true, workspace: { select: { id: true, name: true } } },
  });
  if (!invite) throw NotFound("Invite not found or revoked", "INVITE_INVALID");
  if (invite.expiresAt && invite.expiresAt < new Date()) throw BadRequest("Invite has expired", "INVITE_EXPIRED");
  return invite;
}

// Preview a workspace by invite token (any authenticated user).
export async function getInvite(token) {
  const invite = await loadValidInvite(token);
  return { token: invite.token, role: invite.role, workspace: invite.workspace };
}

// Current user joins the workspace using the invite.
export async function acceptInvite(userId, token) {
  const invite = await loadValidInvite(token);
  const roleId = await roleIdByKey(invite.role);
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, tenantId: invite.workspaceId },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId, roleId, tenantId: invite.workspaceId, grantedBy: invite.workspaceId ? userId : userId },
    });
    await invalidateUserPerms(userId);
  }
  return { workspaceId: invite.workspaceId, role: invite.role, workspace: invite.workspace };
}
