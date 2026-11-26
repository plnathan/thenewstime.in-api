import { describe, it, expect } from "vitest";
import { cardSchema, idSchema } from "../sponsored-feed.validation.js";
describe("Sponsored card validation", () => {
  it("normalizes URLs and blank text", () =>
    expect(
      cardSchema.parse({ imageUrl: "example.com", headline: " " })
    ).toMatchObject({ imageUrl: "https://example.com/", headline: null }));
  it("rejects unsafe URLs", () =>
    expect(
      cardSchema.safeParse({ ctaUrl: "javascript:alert(1)" }).success
    ).toBe(false));
  it("rejects unexpected fields", () =>
    expect(cardSchema.safeParse({ createdBy: 1 }).success).toBe(false));
  it("rejects oversized headlines", () =>
    expect(cardSchema.safeParse({ headline: "x".repeat(251) }).success).toBe(
      false
    ));
  it("rejects unsafe IDs", () =>
    expect(idSchema.safeParse("9007199254740992").success).toBe(false));
});
