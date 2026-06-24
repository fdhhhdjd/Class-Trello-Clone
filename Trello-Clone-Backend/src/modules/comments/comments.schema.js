import { z } from "zod";

export const createCommentSchema = z.object({
  body: z.string().min(1).max(16384),
  mentions: z.array(z.string().uuid()).max(50).optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(16384),
});
