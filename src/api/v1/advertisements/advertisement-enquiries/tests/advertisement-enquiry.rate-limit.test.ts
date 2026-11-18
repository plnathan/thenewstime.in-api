import { describe, it, expect, vi, afterEach } from "vitest";
import type { Pool } from "pg";
import {
  consumeEnquiryQuota,
  enquiryLimit
} from "../advertisement-enquiry.rate-limit.js";
import {
  createAdvertisementEnquiryRepository,
  DuplicateEnquiryError
} from "../advertisement-enquiry.repository.js";

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
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // lock
      .mockResolvedValueOnce({ rows: [{ found: false }] })
      .mockResolvedValueOnce({ rows: [{ requests: 1, retry_after: 60 }] })
      .mockResolvedValueOnce({ rows: [{ requests: 1, retry_after: 60 }] })
      .mockResolvedValueOnce({ rows: [{ requests: 1, retry_after: 60 }] })
      .mockRejectedValueOnce(new Error("insert failed"))
      .mockResolvedValueOnce({});
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

describe("Duplicate enquiry prevention", () => {
  const input = {
    fullName: "Test User",
    mobileNumber: "1234567890",
    source: "FOOTER" as const
  };
  it("rejects a duplicate before consuming successful quotas", async () => {
    vi.stubEnv("ENQUIRY_DUPLICATE_WINDOW_HOURS", undefined);
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ found: true }] })
      .mockResolvedValueOnce({});
    const release = vi.fn();
    const pool = {
      connect: vi.fn().mockResolvedValue({ query, release })
    } as unknown as Pool;
    await expect(
      createAdvertisementEnquiryRepository(pool).create(input, "test")
    ).rejects.toBeInstanceOf(DuplicateEnquiryError);
    expect(query).toHaveBeenCalledTimes(4);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("pg_advisory_xact_lock"),
      ["1234567890"]
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("SELECT EXISTS"),
      ["1234567890", 24, "Test User", "", "", null, [], [], null, null, ""]
    );
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
  it("commits a nonduplicate enquiry and quotas", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ found: false }] });
    for (let i = 0; i < 3; i++)
      query.mockResolvedValueOnce({ rows: [{ requests: 1, retry_after: 60 }] });
    query
      .mockResolvedValueOnce({
        rows: [{ id: "1", created_at: new Date("2026-11-18T00:00:00Z") }]
      })
      .mockResolvedValueOnce({});
    const release = vi.fn();
    const pool = {
      connect: vi.fn().mockResolvedValue({ query, release })
    } as unknown as Pool;
    await expect(
      createAdvertisementEnquiryRepository(pool).create(input, "test")
    ).resolves.toMatchObject({ id: "1" });
    expect(query).toHaveBeenLastCalledWith("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
});
