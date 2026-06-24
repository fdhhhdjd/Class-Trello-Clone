import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./comments.controller.js";

export const commentsRouter = Router();

commentsRouter.use(authenticate);

commentsRouter.patch("/:id", ah(c.update));
commentsRouter.delete("/:id", ah(c.remove));
