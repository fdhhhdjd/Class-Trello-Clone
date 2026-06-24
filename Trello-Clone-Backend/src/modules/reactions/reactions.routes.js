import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import { toggleReaction } from "./reactions.service.js";

const schema = z
  .object({
    cardId: z.string().uuid().optional(),
    commentId: z.string().uuid().optional(),
    emoji: z.string().min(1).max(16),
  })
  .refine((v) => v.cardId || v.commentId, { message: "cardId or commentId required" });

export const reactionsRouter = Router();
reactionsRouter.use(authenticate);
reactionsRouter.post(
  "/toggle",
  ah(async (req, res) => {
    const input = schema.parse(req.body);
    res.json(await toggleReaction(req.user.id, input));
  }),
);
