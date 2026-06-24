import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./cards.controller.js";
import * as fields from "../customFields/customFields.controller.js";

export const cardsRouter = Router();

cardsRouter.use(authenticate);

cardsRouter.get("/", ah(c.list));
cardsRouter.post("/", ah(c.create));
cardsRouter.get("/:id", ah(c.get));
cardsRouter.patch("/:id", ah(c.update));
cardsRouter.patch("/:id/move", ah(c.move));
cardsRouter.post("/:id/duplicate", ah(c.duplicate));
cardsRouter.put("/:id/watch", ah(c.watch));
cardsRouter.delete("/:id", ah(c.remove));

cardsRouter.get("/:id/comments", ah(c.listComments));
cardsRouter.post("/:id/comments", ah(c.createComment));

cardsRouter.post("/:id/labels", ah(c.attachLabel));
cardsRouter.delete("/:id/labels/:labelId", ah(c.detachLabel));

cardsRouter.post("/:id/members", ah(c.addMember));
cardsRouter.delete("/:id/members/:userId", ah(c.removeMember));

cardsRouter.post("/:id/checklists", ah(c.createChecklist));

cardsRouter.get("/:id/attachments", ah(c.listAttachments));
cardsRouter.post("/:id/attachments/presign", ah(c.presignAttachment));
cardsRouter.post("/:id/attachments", ah(c.createAttachment));

cardsRouter.get("/:id/activity", ah(c.listActivity));

cardsRouter.get("/:id/fields", ah(fields.listCardValues));
cardsRouter.put("/:id/fields/:fieldId", ah(fields.setCardValue));
