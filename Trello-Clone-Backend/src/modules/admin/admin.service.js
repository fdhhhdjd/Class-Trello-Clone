import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { BadRequest, NotFound, Forbidden } from "../../lib/errors.js";
import {
  invalidateUserPerms,
  invalidatePermsForRole,
  getUserRoleKeys,
  getUserPermissions,
} from "../rbac/perms.js";
import { logAudit } from "../rbac/audit.js";
import { signAccessToken } from "../auth/tokens.js";
import { dbHealthy } from "../../config/db.js";
import { redisHealthy } from "../../config/redis.js";
import { minio, MINIO_BUCKET } from "../../config/minio.js";
import { getOnlineCount } from "../../realtime/index.js";

const BCRYPT_ROUNDS = 10;

export async function getStats() {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400 * 1000);
  const d30 = new Date(now.getTime() - 30 * 86400 * 1000);

  const [
    total, active, workspaces, boards, lists, cards, comments, attachments, storage,
    newUsers7d, newUsers30d, newBoards7d, newCards7d,
    recentSignups, topWsRaw, roleRows, recentUsers7,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.workspace.count(),
    prisma.board.count(),
    prisma.list.count(),
    prisma.card.count(),
    prisma.comment.count(),
    prisma.attachment.count(),
    prisma.attachment.aggregate({ _sum: { size: true } }),
    prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.count({ where: { createdAt: { gte: d30 } } }),
    prisma.board.count({ where: { createdAt: { gte: d7 } } }),
    prisma.card.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, email: true, avatarUrl: true, isActive: true, createdAt: true } }),
    prisma.board.groupBy({ by: ["workspaceId"], _count: { _all: true }, orderBy: { _count: { workspaceId: "desc" } }, take: 5 }),
    prisma.userRole.groupBy({ by: ["roleId"], where: { tenantId: null }, _count: { _all: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: d7 } }, select: { createdAt: true } }),
  ]);

  // top workspaces -> names
  const topWs = [];
  if (topWsRaw.length) {
    const names = await prisma.workspace.findMany({
      where: { id: { in: topWsRaw.map((t) => t.workspaceId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(names.map((n) => [n.id, n.name]));
    for (const t of topWsRaw) topWs.push({ id: t.workspaceId, name: nameById.get(t.workspaceId) ?? "—", boards: t._count._all });
  }

  // role distribution (system roles, tenantId null)
  const roleDist = [];
  if (roleRows.length) {
    const roles = await prisma.role.findMany({ where: { id: { in: roleRows.map((r) => r.roleId) } }, select: { id: true, key: true } });
    const keyById = new Map(roles.map((r) => [r.id, r.key]));
    for (const r of roleRows) roleDist.push({ role: keyById.get(r.roleId) ?? "?", count: r._count._all });
    roleDist.sort((a, b) => b.count - a.count);
  }

  // signup trend last 7 days (oldest -> newest)
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 86400 * 1000);
    const label = `${day.getMonth() + 1}/${day.getDate()}`;
    const count = recentUsers7.filter((u) => {
      const c = new Date(u.createdAt);
      return c.getFullYear() === day.getFullYear() && c.getMonth() === day.getMonth() && c.getDate() === day.getDate();
    }).length;
    trend.push({ label, value: count });
  }

  return {
    users: { total, active, suspended: total - active, new7d: newUsers7d, new30d: newUsers30d },
    workspaces: { total: workspaces },
    boards: { total: boards, new7d: newBoards7d },
    lists: { total: lists },
    cards: { total: cards, new7d: newCards7d },
    comments: { total: comments },
    attachments: { total: attachments },
    storage: { bytes: storage._sum.size ?? 0 },
    recentSignups,
    topWorkspaces: topWs,
    roleDistribution: roleDist,
    signupTrend: trend,
  };
}

export async function listUsers({ search, page, pageSize }) {
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        userRoles: { select: { role: { select: { key: true } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  const data = rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    roles: [...new Set(u.userRoles.map((r) => r.role.key))],
    createdAt: u.createdAt,
  }));
  return { data, total };
}

export async function suspendUser(actorId, targetId, suspend, ctx) {
  const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!user) throw NotFound("User not found");
  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { isActive: !suspend, ...(suspend ? { tokenVersion: { increment: 1 } } : {}) },
    select: { id: true, email: true, name: true, isActive: true, createdAt: true },
  });
  await invalidateUserPerms(targetId);
  logAudit({
    actorId,
    targetId,
    action: suspend ? "admin.user.suspended" : "admin.user.unsuspended",
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return updated;
}

export async function assignRole(actorId, { userId, roleKey, tenantId }, ctx) {
  const [user, role] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.role.findUnique({ where: { key: roleKey }, select: { id: true } }),
  ]);
  if (!user) throw NotFound("User not found");
  if (!role) throw BadRequest(`Unknown role: ${roleKey}`, "UNKNOWN_ROLE");

  const tenant = tenantId ?? null;
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id, tenantId: tenant },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId, roleId: role.id, tenantId: tenant, grantedBy: actorId },
    });
  }
  await invalidateUserPerms(userId);
  logAudit({
    actorId,
    targetId: userId,
    action: "admin.role.assigned",
    metadata: { roleKey, tenantId: tenant },
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return { status: "ok" };
}

export async function listWorkspaces({ search, page, pageSize }) {
  const where = search ? { name: { contains: search, mode: "insensitive" } } : {};
  const [rows, total] = await Promise.all([
    prisma.workspace.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        visibility: true,
        isLocked: true,
        createdAt: true,
        ownerId: true,
        owner: { select: { email: true } },
        _count: { select: { boards: true } },
      },
    }),
    prisma.workspace.count({ where }),
  ]);

  const wsIds = rows.map((w) => w.id);
  const memberGroups = wsIds.length
    ? await prisma.userRole.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: wsIds } },
        _count: { userId: true },
      })
    : [];
  const memberCount = new Map(memberGroups.map((g) => [g.tenantId, g._count.userId]));

  const data = rows.map((w) => ({
    id: w.id,
    name: w.name,
    visibility: w.visibility,
    isLocked: w.isLocked,
    ownerId: w.ownerId,
    ownerEmail: w.owner.email,
    boardCount: w._count.boards,
    memberCount: memberCount.get(w.id) ?? 0,
    createdAt: w.createdAt,
  }));
  return { data, total };
}

export async function deleteWorkspace(actorId, workspaceId, ctx) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!ws) throw NotFound("Workspace not found");
  await prisma.workspace.delete({ where: { id: workspaceId } });
  logAudit({
    actorId,
    targetId: workspaceId,
    action: "admin.workspace.deleted",
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
}

export async function listAudit({ actor, action, from, to, page, pageSize }) {
  const where = {
    ...(actor ? { actorId: actor } : {}),
    ...(action ? { action: { contains: action } } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.accessAudit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.accessAudit.count({ where }),
  ]);

  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } })
    : [];
  const emailById = new Map(actors.map((a) => [a.id, a.email]));

  const data = rows.map((r) => ({
    id: r.id.toString(),
    actorId: r.actorId,
    actorEmail: emailById.get(r.actorId) ?? null,
    action: r.action,
    targetId: r.targetId,
    metadata: r.metadata,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt,
  }));
  return { data, total };
}

export async function getUserDetail(targetId) {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
      userRoles: {
        select: {
          tenantId: true,
          role: { select: { key: true, name: true } },
        },
      },
      ownedWorkspaces: { select: { id: true, name: true } },
    },
  });
  if (!user) throw NotFound("User not found");

  const wsTenantIds = [...new Set(user.userRoles.map((r) => r.tenantId).filter(Boolean))];
  const memberWorkspaces = wsTenantIds.length
    ? await prisma.workspace.findMany({
        where: { id: { in: wsTenantIds } },
        select: { id: true, name: true },
      })
    : [];

  const activityCount = await prisma.activity.count({ where: { actorId: targetId } });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    createdAt: user.createdAt,
    roles: user.userRoles.map((r) => ({
      key: r.role.key,
      name: r.role.name,
      tenantId: r.tenantId,
    })),
    ownedWorkspaces: user.ownedWorkspaces,
    memberWorkspaces,
    activityCount,
  };
}

function generatePassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12) + "A1!";
}

export async function resetPassword(actorId, targetId, newPassword, ctx) {
  const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!user) throw NotFound("User not found");

  const password = newPassword || generatePassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: targetId } }),
  ]);
  await invalidateUserPerms(targetId);

  logAudit({
    actorId,
    targetId,
    action: "admin.user.password_reset",
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return { status: "ok", password };
}

export async function deleteUser(actorId, targetId, ctx) {
  if (actorId === targetId) throw BadRequest("You cannot delete yourself", "SELF_DELETE");
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true },
  });
  if (!user) throw NotFound("User not found");
  if (user.email === env.SEED_ADMIN_EMAIL) {
    throw Forbidden("Cannot delete the seeded super admin");
  }

  await prisma.user.delete({ where: { id: targetId } });
  await invalidateUserPerms(targetId);
  logAudit({
    actorId,
    targetId,
    action: "admin.user.deleted",
    metadata: { email: user.email },
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return { status: "ok" };
}

export async function impersonate(actorId, targetId, ctx) {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, name: true, avatarUrl: true, isActive: true, tokenVersion: true },
  });
  if (!user) throw NotFound("User not found");
  if (!user.isActive) throw BadRequest("Cannot impersonate an inactive user");

  const accessToken = signAccessToken({
    user_id: user.id,
    token_version: user.tokenVersion,
    jti: uuidv4(),
    impersonated_by: actorId,
  });
  const [roles, permissions] = await Promise.all([
    getUserRoleKeys(user.id),
    getUserPermissions(user.id),
  ]);

  logAudit({
    actorId,
    targetId,
    action: "user.impersonate",
    metadata: { email: user.email },
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      roles,
      permissions,
    },
  };
}

export async function updateWorkspace(actorId, workspaceId, input, ctx) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!ws) throw NotFound("Workspace not found");
  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    },
    select: { id: true, name: true, visibility: true, isLocked: true },
  });
  logAudit({
    actorId,
    targetId: workspaceId,
    action: "admin.workspace.updated",
    metadata: input,
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return updated;
}

export async function transferOwner(actorId, workspaceId, newOwnerId, ctx) {
  const [ws, newOwner] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, ownerId: true } }),
    prisma.user.findUnique({ where: { id: newOwnerId }, select: { id: true } }),
  ]);
  if (!ws) throw NotFound("Workspace not found");
  if (!newOwner) throw BadRequest("New owner not found", "OWNER_NOT_FOUND");

  const ownerRole = await prisma.role.findUnique({ where: { key: "ws_owner" }, select: { id: true } });

  await prisma.workspace.update({ where: { id: workspaceId }, data: { ownerId: newOwnerId } });
  if (ownerRole) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: newOwnerId, roleId: ownerRole.id, tenantId: workspaceId },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: newOwnerId, roleId: ownerRole.id, tenantId: workspaceId, grantedBy: actorId },
      });
    }
    await invalidateUserPerms(newOwnerId);
  }

  logAudit({
    actorId,
    targetId: workspaceId,
    action: "admin.workspace.owner_transferred",
    metadata: { from: ws.ownerId, to: newOwnerId },
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return { status: "ok" };
}

export async function lockWorkspace(actorId, workspaceId, locked, ctx) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!ws) throw NotFound("Workspace not found");
  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { isLocked: locked },
    select: { id: true, name: true, isLocked: true },
  });
  logAudit({
    actorId,
    targetId: workspaceId,
    action: locked ? "admin.workspace.locked" : "admin.workspace.unlocked",
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return updated;
}

export async function getStorage() {
  const [total, byWsRows, byUserRows] = await Promise.all([
    prisma.attachment.aggregate({ _sum: { size: true } }),
    prisma.$queryRaw`
      SELECT w.id AS "workspaceId", w.name AS name, COALESCE(SUM(a.size), 0)::bigint AS bytes
      FROM attachments a
      JOIN cards c ON c.id = a.card_id
      JOIN lists l ON l.id = c.list_id
      JOIN boards b ON b.id = l.board_id
      JOIN workspaces w ON w.id = b.workspace_id
      GROUP BY w.id, w.name
      ORDER BY bytes DESC
      LIMIT 100`,
    prisma.attachment.groupBy({
      by: ["uploaderId"],
      _sum: { size: true },
      orderBy: { _sum: { size: "desc" } },
      take: 100,
    }),
  ]);

  const userIds = byUserRows.map((r) => r.uploaderId);
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    : [];
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  return {
    totalBytes: Number(total._sum.size ?? 0),
    byWorkspace: byWsRows.map((r) => ({
      workspaceId: r.workspaceId,
      name: r.name,
      bytes: Number(r.bytes),
    })),
    byUser: byUserRows.map((r) => ({
      userId: r.uploaderId,
      email: emailById.get(r.uploaderId) ?? null,
      bytes: Number(r._sum.size ?? 0),
    })),
  };
}

// ===== Roles & Permissions =====

export async function listRoles() {
  const roles = await prisma.role.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      _count: { select: { rolePermissions: true, userRoles: true } },
    },
  });
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissionCount: r._count.rolePermissions,
    userCount: r._count.userRoles,
  }));
}

export async function getRole(roleId) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      rolePermissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!role) throw NotFound("Role not found");
  const { rolePermissions, ...rest } = role;
  return { role: rest, permissions: rolePermissions.map((rp) => rp.permission.key) };
}

export async function listPermissions() {
  const perms = await prisma.permission.findMany({
    orderBy: [{ resource: "asc" }, { action: "asc" }],
    select: { id: true, key: true, resource: true, action: true, description: true },
  });
  const groups = new Map();
  for (const p of perms) {
    if (!groups.has(p.resource)) groups.set(p.resource, []);
    groups.get(p.resource).push({
      id: p.id,
      key: p.key,
      action: p.action,
      description: p.description,
    });
  }
  return [...groups.entries()].map(([resource, items]) => ({ resource, items }));
}

export async function setRolePermissions(actorId, roleId, permissionKeys, ctx) {
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) throw NotFound("Role not found");

  const keys = [...new Set(permissionKeys)];
  const perms = keys.length
    ? await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } })
    : [];
  const foundKeys = new Set(perms.map((p) => p.key));
  const unknown = keys.filter((k) => !foundKeys.has(k));
  if (unknown.length) throw BadRequest(`Unknown permissions: ${unknown.join(", ")}`, "UNKNOWN_PERMISSION");

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    ...(perms.length
      ? [prisma.rolePermission.createMany({
          data: perms.map((p) => ({ roleId, permissionId: p.id })),
          skipDuplicates: true,
        })]
      : []),
  ]);

  await invalidatePermsForRole(roleId);
  logAudit({
    actorId,
    targetId: null,
    action: "admin.role.permissions_updated",
    metadata: { roleId, permissionKeys: keys },
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return { status: "ok", permissions: keys };
}

// ===== Workspace detail =====

export async function getWorkspaceDetail(workspaceId) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      visibility: true,
      isLocked: true,
      createdAt: true,
      owner: { select: { id: true, email: true, name: true } },
      boards: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          archived: true,
          _count: { select: { lists: true } },
          lists: { select: { _count: { select: { cards: true } } } },
        },
      },
    },
  });
  if (!ws) throw NotFound("Workspace not found");

  const boards = ws.boards.map((b) => ({
    id: b.id,
    name: b.name,
    archived: b.archived,
    listCount: b._count.lists,
    cardCount: b.lists.reduce((sum, l) => sum + l._count.cards, 0),
  }));
  const cardCount = boards.reduce((sum, b) => sum + b.cardCount, 0);

  // Members: distinct users with a role scoped to this workspace.
  const memberRoles = await prisma.userRole.findMany({
    where: { tenantId: workspaceId },
    select: {
      userId: true,
      user: { select: { email: true, name: true } },
      role: { select: { key: true } },
    },
  });
  const memberMap = new Map();
  for (const m of memberRoles) {
    if (!memberMap.has(m.userId)) {
      memberMap.set(m.userId, {
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: m.role.key,
      });
    }
  }
  const members = [...memberMap.values()];

  return {
    id: ws.id,
    name: ws.name,
    visibility: ws.visibility,
    isLocked: ws.isLocked,
    owner: ws.owner,
    createdAt: ws.createdAt,
    counts: { boards: boards.length, members: members.length, cards: cardCount },
    boards,
    members,
  };
}

// ===== Health / Monitoring =====

let startedAt = Date.now();

async function minioHealthy() {
  try {
    return await minio.bucketExists(MINIO_BUCKET);
  } catch {
    return false;
  }
}

export async function getHealth() {
  const [db, redisUp, minioUp] = await Promise.all([
    dbHealthy().catch(() => false),
    redisHealthy().catch(() => false),
    minioHealthy(),
  ]);

  let counts = { users: 0, workspaces: 0, boards: 0, cards: 0, comments: 0 };
  if (db) {
    const [users, workspaces, boards, cards, comments] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.board.count(),
      prisma.card.count(),
      prisma.comment.count(),
    ]);
    counts = { users, workspaces, boards, cards, comments };
  }

  let queues = [];
  if (redisUp) {
    queues = await getQueueCounts().catch(() => []);
  }

  return {
    services: { api: "up", db, redis: redisUp, minio: minioUp },
    counts,
    queues,
    onlineUsers: getOnlineCount(),
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  };
}

// BullMQ job counts per queue (waiting/active/completed/failed/delayed).
async function getQueueCounts() {
  const { emailQueue } = await import("../../queues/email.queue.js");
  const { remindersQueue } = await import("../../queues/reminders.js");
  const { backupQueue } = await import("../../queues/backup.queue.js");
  const defs = [
    { name: "email", q: emailQueue },
    { name: "reminders", q: remindersQueue },
    { name: "backup", q: backupQueue },
  ];
  const out = [];
  for (const d of defs) {
    try {
      const c = await d.q.getJobCounts("waiting", "active", "completed", "failed", "delayed");
      out.push({ name: d.name, ...c });
    } catch {
      out.push({ name: d.name, error: true });
    }
  }
  return out;
}

// ===== System config =====

const CONFIG_KEY = "system";

const CONFIG_DEFAULTS = {
  features: { registration: true, attachments: true, comments: true, invites: true },
  limits: { maxUploadMb: 25, workspaceQuotaMb: 1024 },
  smtp: { host: "", port: 587, user: "", from: "" },
};

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    out[k] = isObject(v) && isObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

function stripSmtpPassword(config) {
  if (isObject(config?.smtp)) {
    const { password, pass, ...rest } = config.smtp;
    return { ...config, smtp: rest };
  }
  return config;
}

export async function getConfig() {
  const row = await prisma.setting.findUnique({ where: { key: CONFIG_KEY } });
  const merged = deepMerge(CONFIG_DEFAULTS, isObject(row?.value) ? row.value : {});
  return stripSmtpPassword(merged);
}

export async function updateConfig(actorId, patch, ctx) {
  const row = await prisma.setting.findUnique({ where: { key: CONFIG_KEY } });
  const current = deepMerge(CONFIG_DEFAULTS, isObject(row?.value) ? row.value : {});
  const next = deepMerge(current, patch);

  await prisma.setting.upsert({
    where: { key: CONFIG_KEY },
    update: { value: next },
    create: { key: CONFIG_KEY, value: next },
  });

  logAudit({
    actorId,
    targetId: null,
    action: "admin.config.updated",
    metadata: { keys: Object.keys(patch ?? {}) },
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return stripSmtpPassword(next);
}

// ===== Storage cleanup =====

const CLEANUP_LIMIT = 500;

export async function cleanupStorage(actorId, ctx) {
  // Bounded scan; cardId FK is enforced so orphan-by-card is rare, but check objects.
  const attachments = await prisma.attachment.findMany({
    take: CLEANUP_LIMIT,
    orderBy: { createdAt: "asc" },
    select: { id: true, key: true, cardId: true },
  });

  const orphans = [];
  for (const a of attachments) {
    let orphan = false;
    const card = await prisma.card.findUnique({ where: { id: a.cardId }, select: { id: true } });
    if (!card) orphan = true;
    else {
      try {
        await minio.statObject(MINIO_BUCKET, a.key);
      } catch {
        orphan = true; // object missing
      }
    }
    if (orphan) orphans.push(a);
  }

  let removed = 0;
  for (const a of orphans) {
    try {
      await minio.removeObject(MINIO_BUCKET, a.key).catch(() => undefined);
      await prisma.attachment.delete({ where: { id: a.id } });
      removed++;
    } catch {
      // skip rows that fail to delete
    }
  }

  logAudit({
    actorId,
    targetId: null,
    action: "admin.storage.cleanup",
    metadata: { removed, scanned: attachments.length },
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  return { removed };
}
