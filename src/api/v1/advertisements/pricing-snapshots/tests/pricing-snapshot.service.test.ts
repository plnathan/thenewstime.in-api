import { beforeEach, describe, expect, it, vi } from "vitest";

import * as advertisementRepository from "../../../advertisements/advertisement/advertisement.repository.js";
import * as rateCardRepository from "../../rate-cards/rate-card.repository.js";

import type { Advertisement } from "../../../advertisements/advertisement/advertisement.types.js";

import type { AdvertisementRuntimePlacement } from "../../../advertisements/advertisement/advertisement.repository.js";

import * as repository from "../pricing-snapshot.repository.js";
import * as service from "../pricing-snapshot.service.js";

vi.mock(
  "../../../advertisements/advertisement/advertisement.repository.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../advertisements/advertisement/advertisement.repository.js")
      >();

    return {
      ...actual,
      findById: vi.fn()
    };
  }
);

vi.mock("../../rate-cards/rate-card.repository.js", () => ({
  findById: vi.fn()
}));

vi.mock("../pricing-snapshot.repository.js", () => ({
  findById: vi.fn(),
  findByAdvertisementId: vi.fn(),
  findLatestByAdvertisementId: vi.fn(),
  findLatestByAdvertisementAndPlacement: vi.fn(),
  create: vi.fn()
}));

const mockedAdvertisementRepository = vi.mocked(advertisementRepository);
const mockedRateCardRepository = vi.mocked(rateCardRepository);
const mockedRepository = vi.mocked(repository);

const createAdvertisement = (
  overrides: Partial<Advertisement> = {}
): Advertisement & {
  placement: AdvertisementRuntimePlacement | null;
} =>
  ({
    id: 10,
    pricingPlacementId: 20,
    pricingUnit: "DAY",
    pricingQuantity: 1,
    standardAmount: 5000,
    placement: null,
    ...overrides
  }) as Advertisement & {
    placement: AdvertisementRuntimePlacement | null;
  };

const createRateCard = (overrides: Record<string, unknown> = {}) => ({
  id: 30,
  placementId: 20,
  pricingUnit: "DAY" as const,
  rateAmount: 5000,
  currencyCode: "INR",
  effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
  effectiveTo: new Date("2026-10-01T00:00:00.000Z"),
  status: "ACTIVE" as const,
  createdBy: 5,
  updatedBy: null,
  createdAt: new Date("2026-08-25T00:00:00.000Z"),
  updatedAt: new Date("2026-08-25T00:00:00.000Z"),
  ...overrides
});

const createSnapshot = (overrides: Record<string, unknown> = {}) => ({
  id: 100,
  advertisementId: 10,
  placementId: 20,
  rateCardId: 30,
  pricingUnit: "DAY" as const,
  rateAmount: 5000,
  currencyCode: "INR",
  rateEffectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
  rateEffectiveTo: new Date("2026-10-01T00:00:00.000Z"),
  quantity: 1,
  standardAmount: 5000,
  snapshotAt: new Date("2026-09-25T10:00:00.000Z"),
  createdBy: 5,
  createdAt: new Date("2026-09-25T10:00:00.000Z"),
  ...overrides
});

describe("Advertisement Pricing Snapshot Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getById", () => {
    it("should return a pricing snapshot", async () => {
      const snapshot = createSnapshot();

      mockedRepository.findById.mockResolvedValue(snapshot);

      const result = await service.getById(100);

      expect(result).toEqual(snapshot);

      expect(mockedRepository.findById).toHaveBeenCalledWith(100);
    });

    it("should reject an invalid id", async () => {
      await expect(service.getById(0)).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRepository.findById).not.toHaveBeenCalled();
    });

    it("should reject a missing snapshot", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(service.getById(999)).rejects.toMatchObject({
        statusCode: 404
      });

      expect(mockedRepository.findById).toHaveBeenCalledWith(999);
    });
  });

  describe("getByAdvertisementId", () => {
    it("should return advertisement snapshots", async () => {
      const snapshots = [
        createSnapshot(),
        createSnapshot({
          id: 101
        })
      ];

      mockedRepository.findByAdvertisementId.mockResolvedValue(snapshots);

      const result = await service.getByAdvertisementId(10);

      expect(result).toEqual(snapshots);

      expect(mockedRepository.findByAdvertisementId).toHaveBeenCalledWith(10);
    });

    it("should reject an invalid advertisement id", async () => {
      await expect(service.getByAdvertisementId(-1)).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRepository.findByAdvertisementId).not.toHaveBeenCalled();
    });
  });

  describe("getLatestByAdvertisementId", () => {
    it("should return the latest snapshot", async () => {
      const snapshot = createSnapshot();

      mockedRepository.findLatestByAdvertisementId.mockResolvedValue(snapshot);

      const result = await service.getLatestByAdvertisementId(10);

      expect(result).toEqual(snapshot);

      expect(mockedRepository.findLatestByAdvertisementId).toHaveBeenCalledWith(
        10
      );
    });

    it("should return null when no snapshot exists", async () => {
      mockedRepository.findLatestByAdvertisementId.mockResolvedValue(null);

      const result = await service.getLatestByAdvertisementId(10);

      expect(result).toBeNull();

      expect(mockedRepository.findLatestByAdvertisementId).toHaveBeenCalledWith(
        10
      );
    });
  });

  describe("getLatestByAdvertisementAndPlacement", () => {
    it("should return the latest placement snapshot", async () => {
      const snapshot = createSnapshot();

      mockedRepository.findLatestByAdvertisementAndPlacement.mockResolvedValue(
        snapshot
      );

      const result = await service.getLatestByAdvertisementAndPlacement(10, 20);

      expect(result).toEqual(snapshot);

      expect(
        mockedRepository.findLatestByAdvertisementAndPlacement
      ).toHaveBeenCalledWith(10, 20);
    });
  });

  describe("createFromRateCard", () => {
    it("should create a snapshot from the active rate card", async () => {
      const rateCard = createRateCard();
      const snapshot = createSnapshot();

      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement({
          pricingPlacementId: 20,
          pricingUnit: "DAY",
          pricingQuantity: 1
        })
      );

      mockedRateCardRepository.findById.mockResolvedValue(rateCard);
      mockedRepository.create.mockResolvedValue(snapshot);

      const result = await service.createFromRateCard(10, 20, 30, 5);

      expect(result).toEqual(snapshot);

      expect(mockedAdvertisementRepository.findById).toHaveBeenCalledWith(
        10,
        undefined
      );

      expect(mockedRateCardRepository.findById).toHaveBeenCalledWith(
        30,
        undefined
      );

      expect(mockedRepository.create).toHaveBeenCalledWith(
        {
          advertisementId: 10,
          placementId: 20,
          rateCardId: 30,
          pricingUnit: "DAY",
          rateAmount: 5000,
          currencyCode: "INR",
          rateEffectiveFrom: rateCard.effectiveFrom,
          rateEffectiveTo: rateCard.effectiveTo,
          quantity: 1,
          standardAmount: 5000
        },
        5,
        undefined
      );
    });

    it("should reject when the advertisement does not exist", async () => {
      mockedAdvertisementRepository.findById.mockResolvedValue(null);

      await expect(
        service.createFromRateCard(10, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 404
      });

      expect(mockedAdvertisementRepository.findById).toHaveBeenCalledWith(
        10,
        undefined
      );

      expect(mockedRateCardRepository.findById).not.toHaveBeenCalled();

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject when the rate card does not exist", async () => {
      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement()
      );

      mockedRateCardRepository.findById.mockResolvedValue(null);

      await expect(
        service.createFromRateCard(10, 20, 999, 5)
      ).rejects.toMatchObject({
        statusCode: 404
      });

      expect(mockedAdvertisementRepository.findById).toHaveBeenCalledWith(
        10,
        undefined
      );

      expect(mockedRateCardRepository.findById).toHaveBeenCalledWith(
        999,
        undefined
      );

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject when the advertisement pricing placement does not match", async () => {
      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement({
          pricingPlacementId: 999
        })
      );

      await expect(
        service.createFromRateCard(10, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedAdvertisementRepository.findById).toHaveBeenCalledWith(
        10,
        undefined
      );

      expect(mockedRateCardRepository.findById).not.toHaveBeenCalled();

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject when advertisement pricing quantity is missing", async () => {
      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement({
          pricingQuantity: null
        })
      );

      await expect(
        service.createFromRateCard(10, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedAdvertisementRepository.findById).toHaveBeenCalledWith(
        10,
        undefined
      );

      expect(mockedRateCardRepository.findById).not.toHaveBeenCalled();

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid pricing quantity", async () => {
      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement({
          pricingQuantity: 0
        })
      );

      await expect(
        service.createFromRateCard(10, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedAdvertisementRepository.findById).toHaveBeenCalledWith(
        10,
        undefined
      );

      expect(mockedRateCardRepository.findById).not.toHaveBeenCalled();

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject a rate card belonging to another placement", async () => {
      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement()
      );

      mockedRateCardRepository.findById.mockResolvedValue(
        createRateCard({
          placementId: 999
        })
      );

      await expect(
        service.createFromRateCard(10, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRateCardRepository.findById).toHaveBeenCalledWith(
        30,
        undefined
      );

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an inactive rate card", async () => {
      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement()
      );

      mockedRateCardRepository.findById.mockResolvedValue(
        createRateCard({
          status: "INACTIVE"
        })
      );

      await expect(
        service.createFromRateCard(10, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRateCardRepository.findById).toHaveBeenCalledWith(
        30,
        undefined
      );

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an archived rate card", async () => {
      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement()
      );

      mockedRateCardRepository.findById.mockResolvedValue(
        createRateCard({
          status: "ARCHIVED"
        })
      );

      await expect(
        service.createFromRateCard(10, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRateCardRepository.findById).toHaveBeenCalledWith(
        30,
        undefined
      );

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should preserve zero rate amounts", async () => {
      const rateCard = createRateCard({
        rateAmount: 0
      });

      const snapshot = createSnapshot({
        rateAmount: 0,
        standardAmount: 0
      });

      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement()
      );

      mockedRateCardRepository.findById.mockResolvedValue(rateCard);
      mockedRepository.create.mockResolvedValue(snapshot);

      const result = await service.createFromRateCard(10, 20, 30, 5);

      expect(result.rateAmount).toBe(0);

      expect(mockedRepository.create).toHaveBeenCalledWith(
        {
          advertisementId: 10,
          placementId: 20,
          rateCardId: 30,
          pricingUnit: "DAY",
          rateAmount: 0,
          currencyCode: "INR",
          rateEffectiveFrom: rateCard.effectiveFrom,
          rateEffectiveTo: rateCard.effectiveTo,
          quantity: 1,
          standardAmount: 0
        },
        5,
        undefined
      );
    });

    it("should normalize the rate-card currency", async () => {
      const rateCard = createRateCard({
        currencyCode: "usd"
      });

      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement()
      );

      mockedRateCardRepository.findById.mockResolvedValue(rateCard);

      mockedRepository.create.mockResolvedValue(
        createSnapshot({
          currencyCode: "USD"
        })
      );

      await service.createFromRateCard(10, 20, 30, 5);

      expect(mockedRepository.create).toHaveBeenCalledWith(
        {
          advertisementId: 10,
          placementId: 20,
          rateCardId: 30,
          pricingUnit: "DAY",
          rateAmount: 5000,
          currencyCode: "USD",
          rateEffectiveFrom: rateCard.effectiveFrom,
          rateEffectiveTo: rateCard.effectiveTo,
          quantity: 1,
          standardAmount: 5000
        },
        5,
        undefined
      );
    });

    it("should reject an invalid effective period", async () => {
      const rateCard = createRateCard({
        effectiveFrom: new Date("2026-10-01T00:00:00.000Z"),
        effectiveTo: new Date("2026-09-01T00:00:00.000Z")
      });

      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement()
      );

      mockedRateCardRepository.findById.mockResolvedValue(rateCard);

      await expect(
        service.createFromRateCard(10, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRateCardRepository.findById).toHaveBeenCalledWith(
        30,
        undefined
      );

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid currency code", async () => {
      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement()
      );

      mockedRateCardRepository.findById.mockResolvedValue(
        createRateCard({
          currencyCode: "US"
        })
      );

      await expect(
        service.createFromRateCard(10, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRateCardRepository.findById).toHaveBeenCalledWith(
        30,
        undefined
      );

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should calculate standard amount from rate amount and quantity", async () => {
      const rateCard = createRateCard({
        rateAmount: 1250.5
      });

      const snapshot = createSnapshot({
        rateAmount: 1250.5,
        quantity: 3,
        standardAmount: 3751.5
      });

      mockedAdvertisementRepository.findById.mockResolvedValue(
        createAdvertisement({
          pricingPlacementId: 20,
          pricingUnit: "DAY",
          pricingQuantity: 3
        })
      );

      mockedRateCardRepository.findById.mockResolvedValue(rateCard);
      mockedRepository.create.mockResolvedValue(snapshot);

      const result = await service.createFromRateCard(10, 20, 30, 5);

      expect(result).toEqual(snapshot);

      expect(mockedRepository.create).toHaveBeenCalledWith(
        {
          advertisementId: 10,
          placementId: 20,
          rateCardId: 30,
          pricingUnit: "DAY",
          rateAmount: 1250.5,
          currencyCode: "INR",
          rateEffectiveFrom: rateCard.effectiveFrom,
          rateEffectiveTo: rateCard.effectiveTo,
          quantity: 3,
          standardAmount: 3751.5
        },
        5,
        undefined
      );
    });

    it("should reject an invalid advertisement id before querying", async () => {
      await expect(
        service.createFromRateCard(0, 20, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedAdvertisementRepository.findById).not.toHaveBeenCalled();
      expect(mockedRateCardRepository.findById).not.toHaveBeenCalled();
      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid placement id before querying", async () => {
      await expect(
        service.createFromRateCard(10, 0, 30, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedAdvertisementRepository.findById).not.toHaveBeenCalled();
      expect(mockedRateCardRepository.findById).not.toHaveBeenCalled();
      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid rate card id before querying", async () => {
      await expect(
        service.createFromRateCard(10, 20, 0, 5)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedAdvertisementRepository.findById).not.toHaveBeenCalled();
      expect(mockedRateCardRepository.findById).not.toHaveBeenCalled();
      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid creator id before querying", async () => {
      await expect(
        service.createFromRateCard(10, 20, 30, 0)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedAdvertisementRepository.findById).not.toHaveBeenCalled();
      expect(mockedRateCardRepository.findById).not.toHaveBeenCalled();
      expect(mockedRepository.create).not.toHaveBeenCalled();
    });
  });
});
