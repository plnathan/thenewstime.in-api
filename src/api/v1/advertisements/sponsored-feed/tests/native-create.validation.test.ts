import { describe, it, expect } from "vitest";
import { createAdvertisementSchema } from "../../advertisement/advertisement.validation.js";
const base = {
  name: "Sponsored test",
  clientId: 1,
  isClickable: false,
  startAt: "2027-01-01T00:00:00Z",
  endAt: "2027-01-02T00:00:00Z"
};
describe("Sponsored feed draft validation", () => {
  it("allows a paid native draft without runtime placement", () =>
    expect(
      createAdvertisementSchema.safeParse({
        ...base,
        advertisementType: "NATIVE"
      }).success
    ).toBe(true));
  it("rejects runtime placement on native drafts", () =>
    expect(
      createAdvertisementSchema.safeParse({
        ...base,
        advertisementType: "NATIVE",
        placementId: 1
      }).success
    ).toBe(false));
  it("still requires placement for display advertisements", () =>
    expect(
      createAdvertisementSchema.safeParse({
        ...base,
        advertisementType: "DISPLAY"
      }).success
    ).toBe(false));
  it("allows conventional placement input", () =>
    expect(
      createAdvertisementSchema.safeParse({
        ...base,
        advertisementType: "DISPLAY",
        placementId: 1
      }).success
    ).toBe(true));
});
