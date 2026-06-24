import { getUserPermissions } from "../modules/rbac/perms.js";
import { logAudit } from "../modules/rbac/audit.js";
import { Unauthorized, Forbidden } from "../lib/errors.js";

const SUPER_ADMIN = "super_admin";

// Permissions whose ALLOW should be audited (RBAC.md 12: sensitive only).
const SENSITIVE = new Set([
  "system.impersonate",
  "users.impersonate",
  "billing.refund",
  "users.delete",
  "users.suspend",
  "users.reset_password",
  "roles.assign",
  "workspaces.lock",
]);

export function authorize(requiredPermission) {
  return async (req, _res, next) => {
    try {
      const user = req.user;
      if (!user) throw Unauthorized();

      if (user.roles.includes(SUPER_ADMIN)) {
        logAudit({
          actorId: user.id,
          action: "permission.checked.allowed",
          metadata: { permission: requiredPermission, via: "super_admin" },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
        return next();
      }

      const perms = await getUserPermissions(user.id);
      if (!perms.includes(requiredPermission)) {
        logAudit({
          actorId: user.id,
          action: "permission.checked.denied",
          metadata: { permission: requiredPermission },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
        throw Forbidden(`You do not have permission: ${requiredPermission}`);
      }

      if (SENSITIVE.has(requiredPermission)) {
        logAudit({
          actorId: user.id,
          action: "permission.checked.allowed",
          metadata: { permission: requiredPermission },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
