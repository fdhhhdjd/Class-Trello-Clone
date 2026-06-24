import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";
import { verifyAccessToken } from "../modules/auth/tokens.js";
import { getUserRoleKeys } from "../modules/rbac/perms.js";
import { Unauthorized } from "../lib/errors.js";

const revokedKey = (jti) => `revoked_jti:${jti}`;

export const authenticate = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw Unauthorized("NO_TOKEN", "Missing access token");
    }
    const token = header.slice(7);

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (e) {
      const expired = e instanceof Error && e.name === "TokenExpiredError";
      throw Unauthorized(expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN", "Invalid access token");
    }

    const blacklisted = await redis.get(revokedKey(decoded.jti)).catch(() => null);
    if (blacklisted) throw Unauthorized("TOKEN_REVOKED", "Token has been revoked");

    const user = await prisma.user.findUnique({
      where: { id: decoded.user_id },
      select: { id: true, tokenVersion: true, isActive: true },
    });
    if (!user || !user.isActive) throw Unauthorized("USER_INACTIVE", "User not active");
    if (user.tokenVersion !== decoded.token_version) {
      throw Unauthorized("TOKEN_VERSION_MISMATCH", "Token no longer valid");
    }

    const roles = await getUserRoleKeys(user.id);
    req.user = {
      id: user.id,
      tokenVersion: user.tokenVersion,
      jti: decoded.jti,
      exp: decoded.exp,
      roles,
    };
    next();
  } catch (err) {
    next(err);
  }
};
