import { z } from "zod";

const fieldType = z.enum(["text", "number", "date", "checkbox", "dropdown"]);

export const createFieldSchema = z.object({
  name: z.string().min(1).max(160),
  type: fieldType.optional(),
  options: z.array(z.string().max(160)).max(50).optional(),
});

export const updateFieldSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    type: fieldType.optional(),
    options: z.array(z.string().max(160)).max(50).nullable().optional(),
    position: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const setValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});
