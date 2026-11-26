import { describe, it, expect } from "vitest";
import { additionalAmount, upgradeInput } from "../upgrade.validation.js";
describe("upgrade requests", () => {
  it("prices remaining days", () =>
    expect(additionalAmount("750", "1000", 4)).toBe(1000));
  it("rejects cheaper target", () =>
    expect(() => additionalAmount("1000", "750", 4)).toThrow());
  it("rejects zero days", () =>
    expect(() => additionalAmount("750", "1000", 0)).toThrow());
  it("rejects duplicate moves", () => {
    const m = { advertisementId: 1, sourceBatchId: 2, targetBatchId: 1 };
    expect(
      upgradeInput.safeParse({
        requestId: "123e4567-e89b-42d3-a456-426614174000",
        moves: [m, m]
      }).success
    ).toBe(false);
  });
});
