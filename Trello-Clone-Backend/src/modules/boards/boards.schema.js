import { z } from "zod";

const visibility = z.enum(["private", "workspace", "public"]);

export const createBoardSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(160),
  description: z.string().max(4096).optional(),
  background: z.string().max(512).optional(),
  visibility: visibility.optional(),
});

export const updateBoardSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(4096).nullable().optional(),
    background: z.string().max(2048).nullable().optional(),
    visibility: visibility.optional(),
    archived: z.boolean().optional(),
    isTemplate: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const starBoardSchema = z.object({ starred: z.boolean() });

const boardRole = z.enum(["admin", "member", "observer"]);
export const addBoardMemberSchema = z.object({
  userId: z.string().uuid(),
  role: boardRole.optional(),
});
export const updateBoardMemberSchema = z.object({ role: boardRole });
