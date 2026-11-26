export const FEED_BATCH_CAPACITY = 6;
export interface EligibleCard {
  advertisementId: string;
  batchId: string;
  batchAssignedAt: string;
  activatedAt: string;
}
/** Input must already satisfy public eligibility; never move cards across batches. */
export function orderEligibleCards<T extends EligibleCard>(
  batchId: string,
  cards: readonly T[],
  capacity = FEED_BATCH_CAPACITY
): Array<T & { position: number }> {
  const ordered = cards
    .filter((card) => card.batchId === batchId)
    .sort((a, b) => {
      const time =
        Math.max(Date.parse(a.batchAssignedAt), Date.parse(a.activatedAt)) -
        Math.max(Date.parse(b.batchAssignedAt), Date.parse(b.activatedAt));
      if (time) return time;
      const x = BigInt(a.advertisementId),
        y = BigInt(b.advertisementId);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  if (ordered.length > capacity)
    throw new Error("Sponsored feed batch exceeds capacity");
  return ordered.map((card, index) => ({ ...card, position: index + 1 }));
}
