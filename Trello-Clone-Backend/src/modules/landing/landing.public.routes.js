import { Router } from "express";
import { ah } from "../../middleware/errorHandler.js";
import { getLanding } from "./landing.service.js";

// Public, unauthenticated. Mounted at /api/landing.
export const landingPublicRouter = Router();

landingPublicRouter.get(
  "/",
  ah(async (_req, res) => {
    res.json(await getLanding());
  }),
);
