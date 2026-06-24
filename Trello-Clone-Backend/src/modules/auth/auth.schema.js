import { z } from "zod";

const password = z.string().min(8, "Password must be at least 8 characters").max(128);

export const registerSchema = z.object({
  email: z.string().email(),
  password,
  name: z.string().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const setupSchema = z.object({
  email: z.string().email(),
  password,
  name: z.string().min(1).max(120),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: password,
});
