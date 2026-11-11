import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  deleteCloudinaryImage: vi.fn()
}));

vi.mock("../../config/db.js", () => ({
  pool: {
    query: mocks.query
  }
}));

vi.mock("../../config/cloudinary.js", () => ({
  deleteCloudinaryImage: mocks.deleteCloudinaryImage
}));

import { runCloudinaryCleanupBatch } from "../cloudinary-cleanup.service.js";

describe("Cloudinary cleanup retry behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a failed deletion to PENDING for retry", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            public_id: "test/failed-image",
            attempts: 1
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ count: "0" }]
      })
      .mockResolvedValueOnce({
        rows: []
      });

    mocks.deleteCloudinaryImage.mockRejectedValueOnce(
      new Error("Simulated Cloudinary failure")
    );

    const result = await runCloudinaryCleanupBatch(10);

    expect(result).toEqual({
      processed: 1,
      succeeded: 0,
      failed: 1
    });

    expect(mocks.deleteCloudinaryImage).toHaveBeenCalledWith(
      "test/failed-image"
    );

    expect(mocks.query).toHaveBeenCalledTimes(3);

    const retryUpdate = mocks.query.mock.calls.at(2);

    expect(retryUpdate).toBeDefined();

    if (!retryUpdate) {
      throw new Error("Expected cleanup retry update query");
    }

    expect(retryUpdate[0]).toContain("status = 'PENDING'");
    expect(retryUpdate[0]).toContain("next_attempt_at");

    expect(retryUpdate[1]).toEqual([1, "Simulated Cloudinary failure", 1]);
  });

  it("marks a successful deletion as COMPLETED", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            public_id: "test/success-image",
            attempts: 2
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ count: "0" }]
      })
      .mockResolvedValueOnce({
        rows: []
      });

    mocks.deleteCloudinaryImage.mockResolvedValueOnce(undefined);

    const result = await runCloudinaryCleanupBatch(10);

    expect(result).toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0
    });

    expect(mocks.deleteCloudinaryImage).toHaveBeenCalledWith(
      "test/success-image"
    );

    expect(mocks.query).toHaveBeenCalledTimes(3);

    const completionUpdate = mocks.query.mock.calls.at(2);

    expect(completionUpdate).toBeDefined();

    if (!completionUpdate) {
      throw new Error("Expected cleanup completion update query");
    }

    expect(completionUpdate[0]).toContain("status = 'COMPLETED'");
  });

  it("cancels cleanup for an image referenced by news", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            public_id: "test/referenced-image",
            attempts: 1
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ count: "1" }]
      })
      .mockResolvedValueOnce({
        rows: []
      });

    const result = await runCloudinaryCleanupBatch(10);

    expect(result).toEqual({
      processed: 1,
      succeeded: 0,
      failed: 0
    });

    expect(mocks.deleteCloudinaryImage).not.toHaveBeenCalled();

    expect(mocks.query).toHaveBeenCalledTimes(3);

    const cancellationUpdate = mocks.query.mock.calls.at(2);

    expect(cancellationUpdate).toBeDefined();

    if (!cancellationUpdate) {
      throw new Error("Expected cleanup cancellation update query");
    }

    expect(cancellationUpdate[0]).toContain("status = 'CANCELLED'");
  });
});
