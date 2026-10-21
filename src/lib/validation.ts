import { z } from "zod";

export const usernameSchema = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "3-24 characters: letters, numbers, underscores");

export const signupSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(60),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(72),
});
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export const reflectionSchema = z.object({
  durationSeconds: z.number().int().min(0).max(7200),
  confidence: z.number().int().min(1).max(5).nullable(),
  reflection: z.string().trim().max(1000).optional(),
  customPrompt: z.string().trim().max(300).optional(),
});
export const messageSchema = z.object({ body: z.string().trim().min(1, "Write something").max(2000) });
