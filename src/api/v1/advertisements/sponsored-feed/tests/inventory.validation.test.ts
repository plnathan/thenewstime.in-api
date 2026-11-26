import { describe, it, expect } from "vitest";
import {
  batchInput,
  rateInput,
  assignmentInput,
  dailyQuantity
} from "../inventory.validation.js";
describe("Sponsored inventory validation", () => {
  it("accepts a batch", () =>
    expect(
      batchInput.parse({
        code: "PREMIUM",
        displayName: "Premium",
        batchOrder: 1
      }).batchOrder
    ).toBe(1));
  it("rejects zero order", () =>
    expect(
      batchInput.safeParse({
        code: "PREMIUM",
        displayName: "Premium",
        batchOrder: 0
      }).success
    ).toBe(false));
  it("rejects client supplied audit fields", () =>
    expect(
      assignmentInput.safeParse({ batchId: 1, createdBy: 2 }).success
    ).toBe(false));
  it("rejects reversed rate dates", () =>
    expect(
      rateInput.safeParse({
        rateAmount: 100,
        effectiveFrom: "2026-12-02T00:00:00Z",
        effectiveTo: "2026-12-01T00:00:00Z"
      }).success
    ).toBe(false));
  it("rejects nonpositive rates", () =>
    expect(
      rateInput.safeParse({
        rateAmount: 0,
        effectiveFrom: "2026-12-01T00:00:00Z"
      }).success
    ).toBe(false));
  it("rounds partial days up", () =>
    expect(
      dailyQuantity(
        new Date("2026-12-01T00:00:00Z"),
        new Date("2026-12-02T01:00:00Z")
      )
    ).toBe(2));
  it("rejects zero duration", () =>
    expect(() => dailyQuantity(new Date(0), new Date(0))).toThrow());
});
