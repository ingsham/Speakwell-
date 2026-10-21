import { describe, it, expect } from "vitest";
import { signupSchema, usernameSchema, messageSchema, reflectionSchema } from "@/lib/validation";

describe("validation", () => {
  it("rejects short passwords", () => {
    expect(signupSchema.safeParse({ displayName: "A", email: "a@b.com", password: "123" }).success).toBe(false);
  });
  it("accepts a valid signup", () => {
    expect(signupSchema.safeParse({ displayName: "Ama", email: "ama@example.com", password: "longenough1" }).success).toBe(true);
  });
  it("normalises and validates usernames", () => {
    expect(usernameSchema.parse(" Ama_K ")).toBe("ama_k");
    expect(usernameSchema.safeParse("a b").success).toBe(false);
  });
  it("rejects empty and oversize messages", () => {
    expect(messageSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(messageSchema.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
  });
  it("bounds confidence 1-5", () => {
    expect(reflectionSchema.safeParse({ durationSeconds: 60, confidence: 6 }).success).toBe(false);
    expect(reflectionSchema.safeParse({ durationSeconds: 60, confidence: null }).success).toBe(true);
  });
});
