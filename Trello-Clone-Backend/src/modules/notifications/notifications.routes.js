import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get("/", ah(c.list));
notificationsRouter.get("/unread-count", ah(c.unreadCount));
notificationsRouter.post("/read-all", ah(c.markAllRead));
notificationsRouter.post("/:id/read", ah(c.markRead));
notificationsRouter.delete("/:id", ah(c.remove));
