import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./customFields.controller.js";

// Mounted at /api/custom-fields for top-level field mutations.
export const customFieldsRouter = Router();
customFieldsRouter.use(authenticate);
customFieldsRouter.patch("/:id", ah(c.update));
customFieldsRouter.delete("/:id", ah(c.remove));
