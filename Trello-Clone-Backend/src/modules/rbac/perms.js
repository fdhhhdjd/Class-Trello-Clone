import { prisma } from "../../config/db.js";
import { redis } from "../../config/redis.js";

const PERMS_TTL_SECONDS = 300; // 5 min cache per RBAC.md 7.4
const permsKey = (userId) => `perms:${userId}`;

// Loads the distinct permission keys for a user from DB.
async function loadFromDb(userId) {
  const now = new Date();
  const rows = await prisma.permission.findMany({
    where: {
      rolePermissions: {
        some: {
          role: {
            userRoles: {
              some: {
                userId,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            },
          },
        },
      },
    },
    select: { key: true },
  });
  return rows.map((r) => r.key);
}

export async function getUserPermissions(userId) {
  const cached = await redis.get(permsKey(userId)).catch(() => null);
  if (cached) return JSON.parse(cached);

  const perms = await loadFromDb(userId);
  await redis
    .set(permsKey(userId), JSON.stringify(perms), "EX", PERMS_TTL_SECONDS)
    .catch(() => undefined);
  return perms;
}

export async function getUserRoleKeys(userId) {
  const now = new Date();
  const rows = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { role: { select: { key: true } } },
  });
  return rows.map((r) => r.role.key);
}

// Call after any role assign/revoke to avoid stale perms (RBAC.md anti-pattern).
export async function invalidateUserPerms(userId) {
  await redis.del(permsKey(userId)).catch(() => undefined);
}

// Invalidate perms cache for every user currently holding a given role.
export async function invalidatePermsForRole(roleId) {
  const rows = await prisma.userRole.findMany({
    where: { roleId },
    select: { userId: true },
  });
  const ids = [...new Set(rows.map((r) => r.userId))];
  if (ids.length === 0) return;
  await redis.del(ids.map(permsKey)).catch(() => undefined);
}
