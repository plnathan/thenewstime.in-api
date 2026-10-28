/** Pure selection functions. Only pass already-eligible delivery items. */
export interface RotationCreative {
  id: number;
  variant: "DESKTOP" | "MOBILE";
  displayOrder: number;
  mediaUrl: string;
}
export interface RotationAdvertisement<T extends RotationCreative> {
  advertisementId: number;
  creatives: readonly T[];
}
/** Each advertisement occupies exactly one turn, regardless of creative count. */
export function selectAdvertisement<
  T extends RotationAdvertisement<RotationCreative>
>(advertisements: readonly T[], turn: number): T | null {
  if (!advertisements.length) return null;
  if (!Number.isSafeInteger(turn) || turn < 0) return null;
  return advertisements[turn % advertisements.length] ?? null;
}
/**
 * Desktop is the canonical slide list. A mobile variant with the same
 * displayOrder represents the same slide, not another rotation turn.
 * Missing mobile media falls back to the desktop slide.
 * Callers must assign matching displayOrder to paired variants.
 */
export function selectCreative<T extends RotationCreative>(
  creatives: readonly T[],
  turn: number,
  device: "DESKTOP" | "MOBILE"
): T | null {
  if (!Number.isSafeInteger(turn) || turn < 0) return null;
  const desktop = creatives.filter(
    (c) => c.variant === "DESKTOP" && c.mediaUrl.trim()
  );
  const ordered = [...desktop].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id - b.id
  );
  if (!ordered.length) return null;
  const slide = ordered[turn % ordered.length]!;
  if (device === "DESKTOP") return slide;
  return (
    creatives.find(
      (c) =>
        c.variant === "MOBILE" &&
        c.displayOrder === slide.displayOrder &&
        c.mediaUrl.trim()
    ) ?? slide
  );
}
/** Advertisement-turn count, not global creative count, determines fairness. */
export function creativeTurnForAdvertisement(
  adTurn: number,
  adIndex: number,
  adCount: number
): number {
  if (!Number.isSafeInteger(adTurn) || adTurn < adIndex || adCount <= 0)
    return 0;
  return Math.floor((adTurn - adIndex) / adCount);
}
