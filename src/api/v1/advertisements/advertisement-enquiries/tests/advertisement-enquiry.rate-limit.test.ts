import { describe, it, expect, vi, afterEach } from "vitest";
import type { Pool } from "pg";
import {
  consumeEnquiryQuota,
  enquiryLimit
} from "../advertisement-enquiry.rate-limit.js";
import { createAdvertisementEnquiryRepository } from "../advertisement-enquiry.repository.js";

afterEach(() => vi.unstubAllEnvs());
describe("Enquiry quotas", () => {
  it("defaults to ten", () => {
    vi.stubEnv("ENQUIRY_TEST_LIMIT", undefined);
    expect(enquiryLimit("ENQUIRY_TEST_LIMIT")).toBe(10);
  });
  it("rejects invalid configuration", () => {
    vi.stubEnv("ENQUIRY_TEST_LIMIT", "0");
    expect(() => enquiryLimit("ENQUIRY_TEST_LIMIT")).toThrow();
  });
  it("permits the tenth request", async () => {
    const db = {
      query: vi
        .fn()
        .mockResolvedValue({ rows: [{ requests: 10, retry_after: 42 }] })
    } as unknown as Pool;
    await expect(
      consumeEnquiryQuota(db, "ip:hour:test", 10, 3600)
    ).resolves.toBeUndefined();
  });
  it("rejects the eleventh with remaining time", async () => {
    const db = {
      query: vi
        .fn()
        .mockResolvedValue({ rows: [{ requests: 11, retry_after: 42 }] })
    } as unknown as Pool;
    await expect(
      consumeEnquiryQuota(db, "success:phone:day:test", 10, 86400)
    ).rejects.toMatchObject({ retryAfter: 42, scope: "phone" });
  });
  it("rolls back quota updates if insertion fails", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValue({ rows: [{ requests: 1, retry_after: 60 }] });
    query
      .mockResolvedValueOnce({ rows: [{ requests: 1 }] })
      .mockResolvedValueOnce({ rows: [{ requests: 1 }] })
      .mockResolvedValueOnce({ rows: [{ requests: 1 }] })
      .mockRejectedValueOnce(new Error("insert failed"));
    const release = vi.fn();
    const pool = {
      connect: vi.fn().mockResolvedValue({ query, release })
    } as unknown as Pool;
    await expect(
      createAdvertisementEnquiryRepository(pool).create(
        { fullName: "Test User", mobileNumber: "1234567890", source: "FOOTER" },
        "test"
      )
    ).rejects.toThrow("insert failed");
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
});
