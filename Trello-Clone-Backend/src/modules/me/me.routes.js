import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./me.controller.js";

// Mounted at /api/me. GET /api/me lives in usersRouter.
export const meRouter = Router();

meRouter.use(authenticate);

meRouter.patch("/", ah(c.updateProfile));
meRouter.delete("/", ah(c.remove));
meRouter.post("/avatar", ah(c.avatarUpload));
meRouter.post("/change-password", ah(c.changePassword));
meRouter.get("/settings", ah(c.getSettings));
meRouter.patch("/settings", ah(c.updateSettings));
meRouter.get("/dashboard", ah(c.dashboard));
meRouter.get("/sessions", ah(c.listSessions));
meRouter.delete("/sessions/:id", ah(c.revokeSession));
