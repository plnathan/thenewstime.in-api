import { describe, expect, it } from "vitest";
import { orderEligibleCards } from "../batch-order.js";
const card = (id: string, batchId = "1") => ({
  advertisementId: id,
  batchId,
  batchAssignedAt: "2026-11-17T00:00:00Z",
  activatedAt: "2026-11-17T00:00:00Z"
});
describe("Sponsored feed ordering", () => {
  it("compacts without borrowing from another batch", () =>
    expect(
      orderEligibleCards("1", [
        card("4"),
        card("1"),
        card("3"),
        card("2", "2")
      ]).map((c) => [c.advertisementId, c.position])
    ).toEqual([
      ["1", 1],
      ["3", 2],
      ["4", 3]
    ]));
  it("appends a commercial upgrade after current occupants", () =>
    expect(
      orderEligibleCards("1", [
        { ...card("1"), batchAssignedAt: "2026-11-18T00:00:00Z" },
        card("2")
      ]).map((c) => c.advertisementId)
    ).toEqual(["2", "1"]));
  it("supports configured ten positions", () =>
    expect(
      orderEligibleCards(
        "1",
        Array.from({ length: 10 }, (_, i) => card(String(i + 1))),
        10
      )
    ).toHaveLength(10));
  it("rejects overflow", () =>
    expect(() =>
      orderEligibleCards(
        "1",
        Array.from({ length: 7 }, (_, i) => card(String(i + 1)))
      )
    ).toThrow());
});
