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

import { postSchema, communitySchema, profileSchema, reportSchema } from "@/lib/validation";
import { scenarios } from "@/lib/scenarios";

describe("social validation", () => {
  it("rejects empty and oversized posts", () => {
    expect(postSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(postSchema.safeParse({ body: "a".repeat(3001) }).success).toBe(false);
    expect(postSchema.safeParse({ body: "hello" }).success).toBe(true);
  });
  it("requires a reason of 3+ characters for reports", () => {
    expect(reportSchema.safeParse({ reason: "no" }).success).toBe(false);
    expect(reportSchema.safeParse({ reason: "spam links" }).success).toBe(true);
  });
  it("validates communities and profiles", () => {
    expect(communitySchema.safeParse({ name: "ab", visibility: "public" }).success).toBe(false);
    expect(communitySchema.safeParse({ name: "Interview prep", visibility: "invite_only" }).success).toBe(true);
    expect(communitySchema.safeParse({ name: "Interview prep", visibility: "secret" }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: "Kofi", username: "Bad Name", bio: "", goals: "", country: "", interests: [] }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: "Kofi", username: "kofi_1", bio: "", goals: "", country: "", interests: ["music"] }).success).toBe(true);
  });
  it("has 8 complete scenarios", () => {
    expect(scenarios).toHaveLength(8);
    for (const s of scenarios) { expect(s.steps.length).toBeGreaterThanOrEqual(3); expect(new Set(scenarios.map((x) => x.slug)).size).toBe(8); }
  });
});
