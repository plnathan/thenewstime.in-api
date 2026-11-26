import { describe, it, expect } from "vitest";
import { fullApproval } from "../upgrade-finance.rules.js";
describe("upgrade finance", () => {
  it("accepts exact approved amount", () =>
    expect(fullApproval("APPROVED", null, "250.00", "250", 250)).toBe(true));
  it("rejects partial approval", () =>
    expect(fullApproval("APPROVED", null, 250, 200, 250)).toBe(false));
  it("rejects revoked approval", () =>
    expect(fullApproval("APPROVED", new Date(), 250, 250, 250)).toBe(false));
  it("rejects pending and null amounts", () => {
    expect(fullApproval("HOLD", null, 250, 250, 250)).toBe(false);
    expect(fullApproval("APPROVED", null, null, null, 250)).toBe(false);
  });
});
