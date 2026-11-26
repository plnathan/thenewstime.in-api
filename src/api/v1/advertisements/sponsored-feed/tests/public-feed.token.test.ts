import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { signReceipt, verifyReceipt } from "../public-feed.token.js";
const prior = process.env.SPONSORED_FEED_TRACKING_SECRET;
const receipt = () => ({
  newsId: "1",
  batchId: "2",
  advertisementId: "3",
  position: 1,
  batchViewId: randomUUID(),
  eventId: randomUUID(),
  expiresAt: Date.now() + 60000
});
beforeEach(() => {
  process.env.SPONSORED_FEED_TRACKING_SECRET =
    "test-only-secret-012345678901234567890";
});
afterEach(() => {
  if (prior === undefined) delete process.env.SPONSORED_FEED_TRACKING_SECRET;
  else process.env.SPONSORED_FEED_TRACKING_SECRET = prior;
});
describe("Sponsored feed receipt", () => {
  it("round trips a signed delivery", () => {
    const r = receipt();
    expect(verifyReceipt(signReceipt(r))).toEqual(r);
  });
  it("rejects tampered content", () => {
    const t = signReceipt(receipt());
    expect(() => verifyReceipt("e30." + t.split(".")[1])).toThrow();
  });
  it("rejects expired receipts", () => {
    expect(() =>
      verifyReceipt(signReceipt({ ...receipt(), expiresAt: Date.now() - 1 }))
    ).toThrow();
  });
  it("rejects invalid positions", () => {
    expect(() => signReceipt({ ...receipt(), position: 32768 })).toThrow();
  });
  it("fails closed without a secret", () => {
    delete process.env.SPONSORED_FEED_TRACKING_SECRET;
    expect(() => signReceipt(receipt())).toThrow();
  });
});
