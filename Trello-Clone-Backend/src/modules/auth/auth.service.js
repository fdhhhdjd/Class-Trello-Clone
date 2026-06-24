import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../config/db.js";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { signAccessToken } from "./tokens.js";
import { BadRequest, Conflict, Unauthorized } from "../../lib/errors.js";
import { invalidateUserPerms } from "../rbac/perms.js";
import { logAudit } from "../rbac/audit.js";
import { enqueueEmail } from "../../queues/email.queue.js";

const BCRYPT_ROUNDS = 10;
const refreshTtlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_SEC = 60 * 60; // 1 hour

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Issues a new access JWT + a new refresh token row. Returns the raw refresh secret.
async function issueTokens(userId, tokenVersion, ctx = {}) {
  const accessJti = uuidv4();
  const accessToken = signAccessToken({
    user_id: userId,
    token_version: tokenVersion,
    jti: accessJti,
  });

  const refreshRaw = uuidv4();
  const refreshJti = uuidv4();
  await prisma.refreshToken.create({
    data: {
      id: refreshJti,
      userId,
      jti: refreshJti,
      tokenHash: hashToken(refreshRaw),
      expiresAt: new Date(Date.now() + refreshTtlMs),
      used: false,
      userAgent: ctx.userAgent ? ctx.userAgent.slice(0, 400) : null,
      ipAddress: ctx.ipAddress ?? null,
    },
  });

  return { accessToken, refreshToken: refreshRaw, refreshMaxAgeMs: refreshTtlMs, refreshJti };
}

export async function register(email, plainPassword, name) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Conflict("Email already registered", "EMAIL_TAKEN");

  const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  const userRole = await prisma.role.findUnique({ where: { key: "user" } });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      ...(userRole
        ? { userRoles: { create: { roleId: userRole.id, tenantId: null } } }
        : {}),
    },
    select: { id: true, tokenVersion: true },
  });

  const tokens = await issueTokens(user.id, user.tokenVersion);
  return { userId: user.id, tokens };
}

// First-run setup: true when no super_admin user exists yet.
export async function getSetupStatus() {
  const superRole = await prisma.role.findUnique({ where: { key: "super_admin" } });
  if (!superRole) return { needsSetup: true };
  const count = await prisma.userRole.count({ where: { roleId: superRole.id, tenantId: null } });
  return { needsSetup: count === 0 };
}

// Create the very first super_admin. Only allowed while no super_admin exists.
export async function setupSuperAdmin(email, plainPassword, name, ip) {
  const superRole = await prisma.role.findUnique({ where: { key: "super_admin" } });
  if (!superRole) throw BadRequest("Roles are not seeded yet", "ROLES_MISSING");
  const existing = await prisma.userRole.count({ where: { roleId: superRole.id, tenantId: null } });
  if (existing > 0) throw Conflict("Setup already completed", "SETUP_DONE");

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) throw Conflict("Email already registered", "EMAIL_TAKEN");

  const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  const userRole = await prisma.role.findUnique({ where: { key: "user" } });
  const roleLinks = [{ roleId: superRole.id, tenantId: null }];
  if (userRole) roleLinks.push({ roleId: userRole.id, tenantId: null });

  const user = await prisma.user.create({
    data: { email, passwordHash, name, isActive: true, userRoles: { create: roleLinks } },
    select: { id: true, tokenVersion: true },
  });
  logAudit({ actorId: user.id, action: "auth.setup.super_admin", metadata: { email }, ipAddress: ip });
  const tokens = await issueTokens(user.id, user.tokenVersion);
  return { userId: user.id, tokens };
}

export async function login(email, plainPassword, ip, ctx = {}) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(plainPassword, user.passwordHash));
  if (!user || !ok) {
    logAudit({
      actorId: user?.id ?? "00000000-0000-0000-0000-000000000000",
      action: "auth.login.failed",
      metadata: { email },
      ipAddress: ip,
    });
    throw Unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
  }
  if (!user.isActive) throw Unauthorized("USER_INACTIVE", "Account is disabled");

  logAudit({ actorId: user.id, action: "auth.login.success", ipAddress: ip });
  const tokens = await issueTokens(user.id, user.tokenVersion, { ipAddress: ip, userAgent: ctx.userAgent });
  return { userId: user.id, tokens };
}

// Rotate refresh token. Detects reuse of an already-used token => revoke everything.
export async function renew(rawRefresh, ctx = {}) {
  if (!rawRefresh) throw Unauthorized("NO_REFRESH", "Missing refresh token");

  const tokenHash = hashToken(rawRefresh);
  const record = await prisma.refreshToken.findFirst({ where: { tokenHash } });

  if (!record || record.expiresAt < new Date()) {
    throw Unauthorized("INVALID_REFRESH", "Invalid refresh token");
  }

  if (record.used) {
    // Reuse detected -> revoke all sessions for this user.
    await revokeAllForUser(record.userId);
    logAudit({
      actorId: record.userId,
      action: "auth.refresh.reuse_detected",
    });
    throw Unauthorized("REFRESH_REUSE", "Refresh token reuse detected");
  }

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { id: true, tokenVersion: true, isActive: true },
  });
  if (!user || !user.isActive) throw Unauthorized("USER_INACTIVE", "User not active");

  await prisma.refreshToken.update({ where: { id: record.id }, data: { used: true } });
  const tokens = await issueTokens(user.id, user.tokenVersion, { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
  return { userId: user.id, tokens };
}

/* --------------------------------------------------------- Sessions */

// Active sessions = non-expired, unused refresh tokens. currentJti marks "this device".
export async function listSessions(userId, currentRefreshRaw) {
  const currentHash = currentRefreshRaw ? hashToken(currentRefreshRaw) : null;
  const rows = await prisma.refreshToken.findMany({
    where: { userId, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true, tokenHash: true },
  });
  return rows.map((r) => ({
    id: r.id,
    userAgent: r.userAgent,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    current: currentHash != null && r.tokenHash === currentHash,
  }));
}

// Revoke one session (refresh token row) belonging to the user.
export async function revokeSession(userId, sessionId) {
  await prisma.refreshToken.deleteMany({ where: { id: sessionId, userId } });
}

export async function logout(params) {
  const ttl = params.accessExp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.set(`revoked_jti:${params.accessJti}`, "1", "EX", ttl).catch(() => undefined);
  }
  if (params.rawRefresh) {
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(params.rawRefresh) },
    });
  }
}

async function revokeAllForUser(userId) {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
  ]);
  await invalidateUserPerms(userId);
}

export async function logoutAll(userId) {
  await revokeAllForUser(userId);
}

// Generate a reset token, store its hash in redis, and email the link.
// Always resolves the same way to avoid leaking which emails are registered.
export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
  if (user && user.isActive) {
    const raw = `${uuidv4()}${uuidv4()}`.replace(/-/g, "");
    await redis.set(`pwreset:${hashToken(raw)}`, user.id, "EX", PASSWORD_RESET_TTL_SEC);
    enqueueEmail({ to: email, kind: "password_reset", data: { token: raw } });
    logAudit({ actorId: user.id, action: "auth.password_reset.requested", metadata: { email } });
  }
  return { status: "ok" };
}

export async function resetPassword(token, newPassword) {
  const key = `pwreset:${hashToken(token)}`;
  const userId = await redis.get(key);
  if (!userId) throw BadRequest("Invalid or expired reset token", "INVALID_RESET_TOKEN");

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await redis.del(key);
  await revokeAllForUser(userId);
  logAudit({ actorId: userId, action: "auth.password_reset.completed" });
  return { status: "ok" };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw BadRequest("User not found");
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw Unauthorized("WRONG_PASSWORD", "Current password is incorrect");

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  // Bump token_version + drop refresh tokens => force re-login everywhere.
  await revokeAllForUser(userId);
}
