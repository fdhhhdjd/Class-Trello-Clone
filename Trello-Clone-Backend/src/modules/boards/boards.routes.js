import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./boards.controller.js";
import * as labels from "../labels/labels.controller.js";
import * as fields from "../customFields/customFields.controller.js";
import * as cardsC from "../cards/cards.controller.js";

export const boardsRouter = Router();

boardsRouter.use(authenticate);

boardsRouter.get("/", ah(c.list));
boardsRouter.post("/", ah(c.create));
boardsRouter.get("/:id", ah(c.get));
boardsRouter.patch("/:id", ah(c.update));
boardsRouter.delete("/:id", ah(c.remove));
boardsRouter.post("/:id/copy", ah(c.copy));
boardsRouter.put("/:id/star", ah(c.star));
boardsRouter.post("/:id/background-image", ah(c.backgroundUpload));

boardsRouter.get("/:id/members", ah(c.listMembers));
boardsRouter.post("/:id/members", ah(c.addMember));
boardsRouter.patch("/:id/members/:userId", ah(c.updateMember));
boardsRouter.delete("/:id/members/:userId", ah(c.removeMember));

boardsRouter.get("/:id/labels", ah(labels.listForBoard));
boardsRouter.post("/:id/labels", ah(labels.createForBoard));

boardsRouter.get("/:id/custom-fields", ah(fields.listForBoard));
boardsRouter.post("/:id/custom-fields", ah(fields.createForBoard));

boardsRouter.get("/:id/card-templates", ah(cardsC.cardTemplates));
