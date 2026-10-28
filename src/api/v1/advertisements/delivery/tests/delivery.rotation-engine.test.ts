import { describe, expect, it } from "vitest";
import {
  selectAdvertisement,
  selectCreative,
  creativeTurnForAdvertisement
} from "../delivery.rotation-engine.js";
const ads = [
  { advertisementId: 2341, creatives: [] },
  { advertisementId: 2342, creatives: [] }
];
const creatives = [
  { id: 1, variant: "DESKTOP" as const, displayOrder: 1, mediaUrl: "a1" },
  { id: 2, variant: "MOBILE" as const, displayOrder: 1, mediaUrl: "m1" },
  { id: 3, variant: "DESKTOP" as const, displayOrder: 2, mediaUrl: "a2" }
];
describe("equal advertisement share", () => {
  it("alternates advertisements regardless of creative count", () => {
    expect(
      Array.from(
        { length: 8 },
        (_, i) => selectAdvertisement(ads, i)?.advertisementId
      )
    ).toEqual([2341, 2342, 2341, 2342, 2341, 2342, 2341, 2342]);
  });
  it("rotates two creatives on the same advertisement's successive turns", () => {
    expect(
      [0, 2, 4].map(
        (t) =>
          selectCreative(
            creatives,
            creativeTurnForAdvertisement(t, 0, 2),
            "DESKTOP"
          )?.id
      )
    ).toEqual([1, 3, 1]);
  });
  it("pairs mobile variant with its desktop slide and falls back", () => {
    expect(selectCreative(creatives, 0, "MOBILE")?.id).toBe(2);
    expect(selectCreative(creatives, 1, "MOBILE")?.id).toBe(3);
  });
  it("handles empty candidates safely", () =>
    expect(selectAdvertisement([], 0)).toBeNull());
});
