import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./attachments.controller.js";

// Mounted at /api/attachments. Card-nested routes live on the cards router.
export const attachmentsRouter = Router();

attachmentsRouter.use(authenticate);

attachmentsRouter.get("/:id/download", ah(c.download));
attachmentsRouter.delete("/:id", ah(c.remove));
