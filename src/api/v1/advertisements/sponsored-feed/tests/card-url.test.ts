import { describe, expect, it } from "vitest";
import { normalizeCardUrl, resolveCardUrl } from "../card-url.js";
describe("Sponsored card destinations", () => {
  it("normalizes bare domains without inventing www", () =>
    expect(normalizeCardUrl("example.com")).toBe("https://example.com/"));
  it("preserves element destination", () =>
    expect(
      resolveCardUrl("https://example.com/book", "https://example.org", true)
    ).toBe("https://example.com/book"));
  it("falls back for blank element", () =>
    expect(resolveCardUrl(" ", "www.example.com", true)).toBe(
      "https://www.example.com/"
    ));
  it("honors clickability", () =>
    expect(resolveCardUrl("example.com", null, false)).toBeNull());
  it.each([
    "javascript:alert(1)",
    "ftp://example.com",
    "//example.com",
    "https://user:pass@example.com",
    "https://exa mple.com"
  ])("rejects %s", (v) => expect(() => normalizeCardUrl(v)).toThrow());
});
