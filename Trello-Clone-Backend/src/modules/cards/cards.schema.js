import { z } from "zod";

const isoDate = z.string().datetime().nullable();

export const createCardSchema = z.object({
  listId: z.string().uuid(),
  title: z.string().min(1).max(512),
  position: z.number().optional(),
});

export const updateCardSchema = z
  .object({
    title: z.string().min(1).max(512).optional(),
    description: z.string().max(16384).nullable().optional(),
    dueDate: isoDate.optional(),
    startDate: isoDate.optional(),
    coverUrl: z.string().max(1024).nullable().optional(),
    archived: z.boolean().optional(),
    status: z.enum(["todo", "doing", "done", "blocked"]).nullable().optional(),
    isTemplate: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const moveCardSchema = z.object({
  listId: z.string().uuid(),
  position: z.number(),
});
