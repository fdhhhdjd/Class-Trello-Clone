import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./workspaces.controller.js";

export const workspacesRouter = Router();

workspacesRouter.use(authenticate);

workspacesRouter.get("/", ah(c.list));
workspacesRouter.post("/", ah(c.create));
workspacesRouter.get("/:id", ah(c.get));
workspacesRouter.patch("/:id", ah(c.update));
workspacesRouter.delete("/:id", ah(c.remove));
workspacesRouter.get("/:id/members", ah(c.listMembers));
workspacesRouter.post("/:id/members", ah(c.addMember));
workspacesRouter.patch("/:id/members/:userId", ah(c.updateMemberRole));
workspacesRouter.delete("/:id/members/:userId", ah(c.removeMember));
workspacesRouter.post("/:id/logo", ah(c.logoUpload));

// Invite links
workspacesRouter.get("/:id/invites", ah(c.listInvites));
workspacesRouter.post("/:id/invites", ah(c.createInvite));
workspacesRouter.delete("/:id/invites/:token", ah(c.revokeInvite));
// Accept / preview by token (any authenticated user)
workspacesRouter.get("/invites/:token", ah(c.getInvite));
workspacesRouter.post("/invites/:token/accept", ah(c.acceptInvite));
