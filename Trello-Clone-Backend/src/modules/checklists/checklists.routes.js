import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./checklists.controller.js";

// Mounted at /api/checklists
export const checklistsRouter = Router();
checklistsRouter.use(authenticate);
checklistsRouter.post("/:id/items", ah(c.createItem));
checklistsRouter.patch("/:id", ah(c.updateChecklist));
checklistsRouter.delete("/:id", ah(c.removeChecklist));

// Mounted at /api/checklist-items
export const checklistItemsRouter = Router();
checklistItemsRouter.use(authenticate);
checklistItemsRouter.patch("/:id", ah(c.updateItem));
checklistItemsRouter.post("/:id/convert-to-card", ah(c.convertItem));
checklistItemsRouter.delete("/:id", ah(c.removeItem));
