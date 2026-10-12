import { beforeEach, describe, expect, it, vi } from "vitest";

const { poolQueryMock, poolConnectMock, clientQueryMock, releaseMock } =
  vi.hoisted(() => ({
    poolQueryMock: vi.fn(),
    poolConnectMock: vi.fn(),
    clientQueryMock: vi.fn(),
    releaseMock: vi.fn()
  }));

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: poolQueryMock,
    connect: poolConnectMock
  }
}));

vi.mock("../target.repository.js", () => ({
  findById: vi.fn(),
  findByAdvertisementId: vi.fn(),
  findByAdvertisementIdAndType: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  deleteByAdvertisementId: vi.fn()
}));

import * as targetRepository from "../target.repository.js";
import {
  AdvertisementTargetServiceError,
  addTarget,
  editTarget,
  listTargets,
  removeTarget,
  replaceTargets
} from "../target.service.js";
import type { AdvertisementTarget } from "../target.types.js";

const sampleTarget: AdvertisementTarget = {
  id: 101,
  advertisementId: 202,
  targetType: "STATE",
  targetValue: "tamil-nadu",
  isInclude: true,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  createdBy: 1,
  updatedBy: 1,
  createdByName: "Test Creator",
  updatedByName: "Test User"
};

const transactionClient = {
  query: clientQueryMock,
  release: releaseMock
};

function mockAdvertisementExists(exists = true) {
  poolQueryMock.mockResolvedValueOnce({
    rows: exists ? [{ id: 202 }] : []
  });
}

describe("target.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    poolConnectMock.mockResolvedValue(transactionClient);
    clientQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe("listTargets", () => {
    it("returns targets for an existing advertisement", async () => {
      mockAdvertisementExists();
      vi.mocked(targetRepository.findByAdvertisementId).mockResolvedValueOnce([
        sampleTarget
      ]);

      const result = await listTargets(202);

      expect(poolQueryMock).toHaveBeenCalledTimes(1);
      expect(poolQueryMock.mock.calls[0]?.[1]).toEqual([202]);
      expect(targetRepository.findByAdvertisementId).toHaveBeenCalledWith(202);
      expect(result).toEqual([sampleTarget]);
    });

    it("throws 404 when the advertisement does not exist", async () => {
      mockAdvertisementExists(false);

      await expect(listTargets(202)).rejects.toMatchObject({
        name: "AdvertisementTargetServiceError",
        message: "Advertisement not found.",
        statusCode: 404
      });

      expect(targetRepository.findByAdvertisementId).not.toHaveBeenCalled();
    });

    it("propagates repository errors", async () => {
      mockAdvertisementExists();

      const error = new Error("database failure");
      vi.mocked(targetRepository.findByAdvertisementId).mockRejectedValueOnce(
        error
      );

      await expect(listTargets(202)).rejects.toBe(error);
    });
  });

  describe("addTarget", () => {
    it("creates a target for an existing advertisement", async () => {
      mockAdvertisementExists();
      vi.mocked(targetRepository.create).mockResolvedValueOnce(sampleTarget);

      const result = await addTarget(202, {
        targetType: "STATE",
        targetValue: "tamil-nadu",
        isInclude: false,
      },1);

      expect(targetRepository.create).toHaveBeenCalledWith({
        advertisementId: 202,
        targetType: "STATE",
        targetValue: "tamil-nadu",
        isInclude: false,
        createdBy: 1,
        updatedBy: 1
      });
      expect(result).toEqual(sampleTarget);
    });

    it("defaults isInclude to true", async () => {
      mockAdvertisementExists();
      vi.mocked(targetRepository.create).mockResolvedValueOnce(sampleTarget);

      await addTarget(202, {
        targetType: "STATE",
        targetValue: "tamil-nadu"
      },1);

      expect(targetRepository.create).toHaveBeenCalledWith({
        advertisementId: 202,
        targetType: "STATE",
        targetValue: "tamil-nadu",
        isInclude: true,
        createdBy: 1,
        updatedBy: 1
      });
    });

    it("does not create a target when the advertisement is missing", async () => {
      mockAdvertisementExists(false);

      await expect(
        addTarget(202, {
          targetType: "STATE",
          targetValue: "tamil-nadu"
        },1)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement not found."
      });

      expect(targetRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("editTarget", () => {
    it("updates a target belonging to the specified advertisement", async () => {
      vi.mocked(targetRepository.findById).mockResolvedValueOnce(sampleTarget);
      vi.mocked(targetRepository.update).mockResolvedValueOnce({
        ...sampleTarget,
        targetValue: "kerala"
      });

      const result = await editTarget(202, 101, {
        targetValue: "kerala"
      },1);

      expect(targetRepository.findById).toHaveBeenCalledWith(101);
      expect(targetRepository.update).toHaveBeenCalledWith(101, {
        targetValue: "kerala"
      },1);
      expect(result.targetValue).toBe("kerala");
    });

    it("throws 404 when the target does not exist", async () => {
      vi.mocked(targetRepository.findById).mockResolvedValueOnce(null);

      await expect(
        editTarget(202, 101, {
          targetValue: "kerala"
        },1)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Targeting rule not found for this advertisement."
      });

      expect(targetRepository.update).not.toHaveBeenCalled();
    });

    it("throws 404 when the target belongs to another advertisement", async () => {
      vi.mocked(targetRepository.findById).mockResolvedValueOnce({
        ...sampleTarget,
        advertisementId: 999
      });

      await expect(
        editTarget(202, 101, {
          targetValue: "kerala"
        },1)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Targeting rule not found for this advertisement."
      });

      expect(targetRepository.update).not.toHaveBeenCalled();
    });

    it("throws 404 when the repository cannot update the target", async () => {
      vi.mocked(targetRepository.findById).mockResolvedValueOnce(sampleTarget);
      vi.mocked(targetRepository.update).mockResolvedValueOnce(null);

      await expect(
        editTarget(202, 101, {
          targetValue: "kerala"
        },1)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Targeting rule could not be updated."
      });
    });

    it("propagates repository errors", async () => {
      vi.mocked(targetRepository.findById).mockResolvedValueOnce(sampleTarget);

      const error = new Error("database failure");
      vi.mocked(targetRepository.update).mockRejectedValueOnce(error);

      await expect(
        editTarget(202, 101, {
          targetValue: "kerala"
        },1)
      ).rejects.toBe(error);
    });
  });

  describe("removeTarget", () => {
    it("deletes a target belonging to the specified advertisement", async () => {
      vi.mocked(targetRepository.findById).mockResolvedValueOnce(sampleTarget);
      vi.mocked(targetRepository.deleteById).mockResolvedValueOnce(true);

      await expect(removeTarget(202, 101)).resolves.toBeUndefined();

      expect(targetRepository.deleteById).toHaveBeenCalledWith(101);
    });

    it("throws 404 when the target does not exist", async () => {
      vi.mocked(targetRepository.findById).mockResolvedValueOnce(null);

      await expect(removeTarget(202, 101)).rejects.toMatchObject({
        statusCode: 404,
        message: "Targeting rule not found for this advertisement."
      });

      expect(targetRepository.deleteById).not.toHaveBeenCalled();
    });

    it("throws 404 when the target belongs to another advertisement", async () => {
      vi.mocked(targetRepository.findById).mockResolvedValueOnce({
        ...sampleTarget,
        advertisementId: 999
      });

      await expect(removeTarget(202, 101)).rejects.toMatchObject({
        statusCode: 404
      });

      expect(targetRepository.deleteById).not.toHaveBeenCalled();
    });

    it("throws 404 when the repository reports that nothing was deleted", async () => {
      vi.mocked(targetRepository.findById).mockResolvedValueOnce(sampleTarget);
      vi.mocked(targetRepository.deleteById).mockResolvedValueOnce(false);

      await expect(removeTarget(202, 101)).rejects.toMatchObject({
        statusCode: 404,
        message: "Targeting rule could not be deleted."
      });
    });
  });

  describe("replaceTargets", () => {
    it("replaces all targets inside a transaction", async () => {
      mockAdvertisementExists();

      clientQueryMock
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 202 }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      vi.mocked(targetRepository.deleteByAdvertisementId).mockResolvedValueOnce(
        1
      );
      vi.mocked(targetRepository.create).mockResolvedValueOnce(sampleTarget);

      const result = await replaceTargets(202, [
        {
          targetType: "STATE",
          targetValue: "tamil-nadu"
        }
      ],1);

      expect(poolConnectMock).toHaveBeenCalledTimes(1);
      expect(clientQueryMock).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(clientQueryMock.mock.calls[1]?.[0]).toContain("FOR UPDATE");
      expect(targetRepository.deleteByAdvertisementId).toHaveBeenCalledWith(
        202,
        transactionClient
      );
      expect(targetRepository.create).toHaveBeenCalledWith(
        {
          advertisementId: 202,
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: true,
          createdBy: 1,
          updatedBy: 1
        },
        transactionClient
      );
      expect(clientQueryMock).toHaveBeenLastCalledWith("COMMIT");
      expect(releaseMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual([sampleTarget]);
    });

    it("allows an empty list to clear all existing targets", async () => {
      mockAdvertisementExists();

      clientQueryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 202 }] })
        .mockResolvedValueOnce({ rows: [] });

      vi.mocked(targetRepository.deleteByAdvertisementId).mockResolvedValueOnce(
        3
      );

      const result = await replaceTargets(202, [],1);

      expect(targetRepository.deleteByAdvertisementId).toHaveBeenCalledWith(
        202,
        transactionClient
      );
      expect(targetRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual([]);
      expect(clientQueryMock).toHaveBeenLastCalledWith("COMMIT");
      expect(releaseMock).toHaveBeenCalledTimes(1);
    });

    it("throws 404 when the advertisement does not exist", async () => {
      mockAdvertisementExists(false);

      await expect(replaceTargets(202, [], 1)).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement not found."
      });

      expect(poolConnectMock).not.toHaveBeenCalled();
    });

    it("rolls back when the locked advertisement no longer exists", async () => {
      mockAdvertisementExists();

      clientQueryMock
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(replaceTargets(202, [], 1)).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement not found."
      });

      expect(clientQueryMock).toHaveBeenLastCalledWith("ROLLBACK");
      expect(releaseMock).toHaveBeenCalledTimes(1);
    });

    it("rolls back and releases the client if saving a target fails", async () => {
      mockAdvertisementExists();

      clientQueryMock
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 202 }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      vi.mocked(targetRepository.deleteByAdvertisementId).mockResolvedValueOnce(
        0
      );

      const error = new Error("insert failed");
      vi.mocked(targetRepository.create).mockRejectedValueOnce(error);

      await expect(
        replaceTargets(202, [
          {
            targetType: "STATE",
            targetValue: "tamil-nadu"
          }
        ],1)
      ).rejects.toBe(error);

      expect(clientQueryMock).toHaveBeenLastCalledWith("ROLLBACK");
      expect(releaseMock).toHaveBeenCalledTimes(1);
    });
  });

  it("exposes the expected service error status code", () => {
    const error = new AdvertisementTargetServiceError("Not found.", 404);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AdvertisementTargetServiceError");
    expect(error.message).toBe("Not found.");
    expect(error.statusCode).toBe(404);
  });
});
