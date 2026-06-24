import { z } from "zod";

export const createChecklistSchema = z.object({
  title: z.string().min(1).max(512),
});

export const updateChecklistSchema = z.object({
  title: z.string().min(1).max(512),
});

export const createItemSchema = z.object({
  text: z.string().min(1).max(2048),
});

export const updateItemSchema = z
  .object({
    text: z.string().min(1).max(2048).optional(),
    done: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });
