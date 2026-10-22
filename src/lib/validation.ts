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

export const postSchema = z.object({ body: z.string().trim().min(1, "Write something").max(3000, "Too long (3000 max)") });
export const commentSchema = z.object({ body: z.string().trim().min(1, "Write something").max(1500, "Too long (1500 max)") });
export const reportSchema = z.object({ reason: z.string().trim().min(3, "Tell us a little more").max(500) });
export const communitySchema = z.object({
  name: z.string().trim().min(3, "Name needs 3+ characters").max(60),
  description: z.string().trim().max(600).optional(),
  category: z.string().trim().max(40).optional(),
  guidelines: z.string().trim().max(2000).optional(),
  visibility: z.enum(["public", "private", "invite_only"]),
});
export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(60),
  username: usernameSchema,
  bio: z.string().trim().max(280, "Bio is 280 characters max"),
  goals: z.string().trim().max(500),
  country: z.string().trim().max(60),
  interests: z.array(z.string().trim().min(1).max(30)).max(10),
});
export const announcementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(1000),
  kind: z.enum(["info", "maintenance"]),
});
export const exerciseSchema = z.object({
  category: z.enum(["warm-up", "storytelling", "conversation", "reading", "introduction", "presentation", "opinion"]),
  title: z.string().trim().min(2).max(100),
  prompt: z.string().trim().min(5).max(600),
  suggestedSeconds: z.number().int().min(15).max(1800),
});
