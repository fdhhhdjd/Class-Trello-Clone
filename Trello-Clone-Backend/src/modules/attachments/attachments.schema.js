import { z } from "zod";

export const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255).optional(),
  size: z.coerce.number().int().nonnegative().optional(),
});

export const createAttachmentSchema = z.object({
  key: z.string().min(1),
  filename: z.string().min(1).max(255),
  size: z.coerce.number().int().nonnegative().optional(),
  mime: z.string().max(255).optional(),
  fileUrl: z.string().optional(),
});
