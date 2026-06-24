import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./backup.controller.js";

// Authenticated admin routes, mounted at /api/admin/backup.
// Gated by system.manage_settings (super_admin bypasses).
export const backupRouter = Router();
backupRouter.use(authenticate);

const guard = authorize("system.manage_settings");

backupRouter.get("/settings", guard, ah(c.getSettings));
backupRouter.put("/settings", guard, ah(c.updateSettings));
backupRouter.post("/run", guard, ah(c.runNow));
backupRouter.get("/runs", guard, ah(c.listRuns));
backupRouter.get("/runs/:id", guard, ah(c.getRun));
backupRouter.delete("/runs/:id", guard, ah(c.deleteRun));
backupRouter.put("/gdrive/creds", guard, ah(c.setCreds));
backupRouter.get("/gdrive/oauth/start", guard, ah(c.oauthStart));
backupRouter.post("/gdrive/disconnect", guard, ah(c.disconnect));

// Public callback (Google redirect, no auth), mounted at /api/backup.
export const backupPublicRouter = Router();
backupPublicRouter.get("/oauth/callback", ah(c.oauthCallback));
