import { describe, expect, it } from "vitest";
import { decodeDistrictNewsCursor } from "../news.repository.js";

describe("district news keyset cursor validation", () => {
  it("accepts an encoded deterministic position", () => {
    const value = Buffer.from(
      JSON.stringify({
        order: 1,
        publishedAt: "2026-11-13T18:30:00.000Z",
        id: 42
      })
    ).toString("base64url");
    expect(decodeDistrictNewsCursor(value)).toEqual({
      order: 1,
      publishedAt: "2026-11-13T18:30:00.000Z",
      id: 42
    });
  });
  it.each([
    "",
    "%%%bad",
    Buffer.from("{}").toString("base64url"),
    Buffer.from(
      JSON.stringify({ order: 1, publishedAt: "bad", id: 1 })
    ).toString("base64url")
  ])("rejects malformed cursor", (cursor) => {
    expect(() => decodeDistrictNewsCursor(cursor)).toThrow(RangeError);
  });
});
