import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
    bio: z.string().max(500).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

export const avatarUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
});

export const updateSettingsSchema = z.object({
  settings: z.record(z.any()),
});
