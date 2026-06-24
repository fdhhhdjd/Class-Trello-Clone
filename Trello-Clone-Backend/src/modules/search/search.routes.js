import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as searchService from "./search.service.js";

export const searchRouter = Router();

searchRouter.use(authenticate);

searchRouter.get(
  "/",
  ah(async (req, res) => {
    res.json(await searchService.search(req.user.id, req.query.q));
  }),
);
