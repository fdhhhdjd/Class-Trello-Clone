import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./admin.controller.js";

export const adminRouter = Router();

adminRouter.use(authenticate);

adminRouter.get("/stats", authorize("users.list"), ah(c.stats));
adminRouter.get("/users", authorize("users.list"), ah(c.listUsers));
adminRouter.get("/users/:id", authorize("users.list"), ah(c.getUser));
adminRouter.post("/users/:id/suspend", authorize("users.suspend"), ah(c.suspendUser));
adminRouter.post("/users/:id/reset-password", authorize("users.reset_password"), ah(c.resetPassword));
adminRouter.delete("/users/:id", authorize("users.delete"), ah(c.deleteUser));
adminRouter.post("/users/:id/impersonate", authorize("users.impersonate"), ah(c.impersonate));
adminRouter.post("/roles/assign", authorize("roles.assign"), ah(c.assignRole));
adminRouter.get("/permissions", authorize("roles.list"), ah(c.listPermissions));
adminRouter.get("/roles", authorize("roles.list"), ah(c.listRoles));
adminRouter.get("/roles/:id", authorize("roles.list"), ah(c.getRole));
adminRouter.patch("/roles/:id/permissions", authorize("roles.update"), ah(c.setRolePermissions));
adminRouter.get("/workspaces", authorize("workspaces.list"), ah(c.listWorkspaces));
adminRouter.get("/workspaces/:id", authorize("workspaces.list"), ah(c.getWorkspace));
adminRouter.patch("/workspaces/:id", authorize("workspaces.update"), ah(c.updateWorkspace));
adminRouter.post("/workspaces/:id/transfer-owner", authorize("workspaces.update"), ah(c.transferOwner));
adminRouter.post("/workspaces/:id/lock", authorize("workspaces.lock"), ah(c.lockWorkspace));
adminRouter.delete("/workspaces/:id", authorize("workspaces.delete"), ah(c.deleteWorkspace));
adminRouter.get("/storage", authorize("storage.view"), ah(c.storage));
adminRouter.post("/storage/cleanup", authorize("storage.manage"), ah(c.storageCleanup));
adminRouter.get("/health", authorize("system.view_audit_log"), ah(c.health));
adminRouter.get("/config", authorize("system.manage_settings"), ah(c.getConfig));
adminRouter.patch("/config", authorize("system.manage_settings"), ah(c.updateConfig));
adminRouter.get("/audit", authorize("system.view_audit_log"), ah(c.listAudit));
adminRouter.get("/landing", authorize("system.manage_settings"), ah(c.getLandingContent));
adminRouter.patch("/landing", authorize("system.manage_settings"), ah(c.updateLandingContent));
adminRouter.post("/landing/image", authorize("system.manage_settings"), ah(c.landingImageUpload));
