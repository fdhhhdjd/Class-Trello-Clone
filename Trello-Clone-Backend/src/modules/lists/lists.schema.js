import { z } from "zod";

export const createListSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(160),
  position: z.number().optional(),
});

export const updateListSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    position: z.number().optional(),
    archived: z.boolean().optional(),
    wipLimit: z.number().int().min(0).max(999).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const sortListSchema = z.object({ by: z.enum(["name", "due", "created"]) });

export const moveListSchema = z.object({ targetBoardId: z.string().uuid() });
