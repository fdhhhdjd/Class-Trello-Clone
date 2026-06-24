import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./lists.controller.js";

export const listsRouter = Router();

listsRouter.use(authenticate);

listsRouter.get("/", ah(c.list));
listsRouter.post("/", ah(c.create));
listsRouter.get("/:id", ah(c.get));
listsRouter.patch("/:id", ah(c.update));
listsRouter.post("/:id/sort", ah(c.sort));
listsRouter.post("/:id/copy", ah(c.copy));
listsRouter.post("/:id/move", ah(c.move));
listsRouter.post("/:id/archive-cards", ah(c.archiveCards));
listsRouter.delete("/:id", ah(c.remove));
