import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";

import * as repository from "../rate-card.repository.js";
import * as service from "../rate-card.service.js";

import type {
  AdvertisementRateCard,
  CreateAdvertisementRateCardInput,
  UpdateAdvertisementRateCardInput
} from "../rate-card.types.js";

vi.mock("../rate-card.repository.js", () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByPlacementId: vi.fn(),
  findEffectiveRate: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
}));

const mockRepository = vi.mocked(repository);

const createRateCard = (
  overrides: Partial<AdvertisementRateCard> = {}
): AdvertisementRateCard => ({
  id: 100,
  placementId: 10,
  pricingUnit: "DAY",
  rateAmount: 10000,
  currencyCode: "INR",
  effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
  effectiveTo: new Date("2026-09-30T23:59:59.999Z"),
  status: "ACTIVE",
  createdBy: 5,
  updatedBy: 5,
  createdAt: new Date("2026-08-25T10:00:00.000Z"),
  updatedAt: new Date("2026-08-25T10:00:00.000Z"),
  ...overrides
});

const createInput = (
  overrides: Partial<CreateAdvertisementRateCardInput> = {}
): CreateAdvertisementRateCardInput => ({
  placementId: 10,
  pricingUnit: "DAY",
  rateAmount: 10000,
  currencyCode: "INR",
  effectiveFrom: "2026-09-01T00:00:00.000Z",
  effectiveTo: "2026-09-30T23:59:59.999Z",
  status: "ACTIVE",
  ...overrides
});

const createUpdateInput = (
  overrides: Partial<UpdateAdvertisementRateCardInput> = {}
): UpdateAdvertisementRateCardInput => ({
  rateAmount: 12000,
  ...overrides
});

describe("Advertisement Rate Card Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAll", () => {
    it("should return all rate cards", async () => {
      const rateCards = [createRateCard()];

      mockRepository.findAll.mockResolvedValue(rateCards);

      const result = await service.getAll();

      expect(result).toEqual(rateCards);
      expect(mockRepository.findAll).toHaveBeenCalledWith({});
    });

    it("should validate placementId filter", async () => {
      await expect(
        service.getAll({
          placementId: 0
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "placementId must be a positive integer."
      });

      expect(mockRepository.findAll).not.toHaveBeenCalled();
    });

    it("should validate pricingUnit filter", async () => {
      await expect(
        service.getAll({
          pricingUnit: "INVALID" as never
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockRepository.findAll).not.toHaveBeenCalled();
    });

    it("should validate status filter", async () => {
      await expect(
        service.getAll({
          status: "INVALID" as never
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockRepository.findAll).not.toHaveBeenCalled();
    });

    it("should pass valid filters to the repository", async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const filters = {
        placementId: 10,
        pricingUnit: "DAY" as const,
        status: "ACTIVE" as const
      };

      await service.getAll(filters);

      expect(mockRepository.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe("getById", () => {
    it("should return a rate card", async () => {
      const rateCard = createRateCard();

      mockRepository.findById.mockResolvedValue(rateCard);

      const result = await service.getById(100);

      expect(result).toEqual(rateCard);
      expect(mockRepository.findById).toHaveBeenCalledWith(100);
    });

    it("should reject an invalid id", async () => {
      await expect(service.getById(0)).rejects.toMatchObject({
        statusCode: 400,
        message: "id must be a positive integer."
      });

      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it("should return 404 when the rate card does not exist", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getById(999)).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement rate card not found."
      });
    });
  });

  describe("getByPlacementId", () => {
    it("should return rate cards for a placement", async () => {
      const rateCards = [
        createRateCard({
          id: 100,
          placementId: 10
        }),
        createRateCard({
          id: 101,
          placementId: 10,
          pricingUnit: "WEEK"
        })
      ];

      mockRepository.findByPlacementId.mockResolvedValue(rateCards);

      const result = await service.getByPlacementId(10);

      expect(result).toEqual(rateCards);
      expect(mockRepository.findByPlacementId).toHaveBeenCalledWith(10);
    });

    it("should reject an invalid placement id", async () => {
      await expect(
        service.getByPlacementId(-1)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "placementId must be a positive integer."
      });

      expect(mockRepository.findByPlacementId).not.toHaveBeenCalled();
    });
  });

  describe("getEffectiveRate", () => {
    it("should return the effective active rate", async () => {
      const rateCard = createRateCard();

      mockRepository.findEffectiveRate.mockResolvedValue(rateCard);

      const effectiveAt = "2026-09-15T12:00:00.000Z";

      const result = await service.getEffectiveRate(10, "DAY", effectiveAt);

      expect(result).toEqual(rateCard);
      expect(mockRepository.findEffectiveRate).toHaveBeenCalledWith(
        10,
        "DAY",
        effectiveAt
      );
    });

    it("should return null when no effective rate exists", async () => {
      mockRepository.findEffectiveRate.mockResolvedValue(null);

      const result = await service.getEffectiveRate(
        10,
        "DAY",
        "2026-09-15T12:00:00.000Z"
      );

      expect(result).toBeNull();
    });

    it("should reject an invalid placement id", async () => {
      await expect(
        service.getEffectiveRate(0, "DAY", "2026-09-15T12:00:00.000Z")
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockRepository.findEffectiveRate).not.toHaveBeenCalled();
    });

    it("should reject an unsupported pricing unit", async () => {
      await expect(
        service.getEffectiveRate(
          10,
          "INVALID" as never,
          "2026-09-15T12:00:00.000Z"
        )
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockRepository.findEffectiveRate).not.toHaveBeenCalled();
    });

    it("should reject an invalid effective date", async () => {
      await expect(
        service.getEffectiveRate(10, "DAY", "invalid-date")
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "effectiveAt must be a valid date."
      });

      expect(mockRepository.findEffectiveRate).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("should create a rate card", async () => {
      const input = createInput();

      const created = createRateCard();

      mockRepository.create.mockResolvedValue(created);

      const result = await service.create(input, 5);

      expect(result).toEqual(created);

      expect(mockRepository.create).toHaveBeenCalledWith(
        {
          ...input,
          currencyCode: "INR"
        },
        5
      );
    });

    it("should normalize a lowercase currency code", async () => {
      const input = createInput({
        currencyCode: "inr"
      });

      mockRepository.create.mockResolvedValue(createRateCard());

      await service.create(input, 5);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currencyCode: "INR"
        }),
        5
      );
    });

    it("should default an omitted currency code to INR", async () => {
      const input = createInput({
        currencyCode: undefined
      });

      mockRepository.create.mockResolvedValue(createRateCard());

      await service.create(input, 5);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currencyCode: "INR"
        }),
        5
      );
    });

    it("should reject an invalid placement id", async () => {
      await expect(
        service.create(
          createInput({
            placementId: 0
          }),
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid creator id", async () => {
      await expect(
        service.create(createInput(), 0)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "createdBy must be a positive integer."
      });

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it("should reject a negative rate amount", async () => {
      await expect(
        service.create(
          createInput({
            rateAmount: -1
          }),
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it("should allow a zero rate amount", async () => {
      const input = createInput({
        rateAmount: 0
      });

      mockRepository.create.mockResolvedValue(
        createRateCard({
          rateAmount: 0
        })
      );

      await service.create(input, 5);

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it("should reject an invalid currency code", async () => {
      await expect(
        service.create(
          createInput({
            currencyCode: "IN"
          }),
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid effectiveFrom date", async () => {
      await expect(
        service.create(
          createInput({
            effectiveFrom: "invalid-date"
          }),
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "effectiveFrom must be a valid date."
      });

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an effectiveTo date before effectiveFrom", async () => {
      await expect(
        service.create(
          createInput({
            effectiveTo: "2026-08-31T23:59:59.999Z"
          }),
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "effectiveTo must be later than effectiveFrom."
      });

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an effectiveTo date equal to effectiveFrom", async () => {
      await expect(
        service.create(
          createInput({
            effectiveTo: "2026-09-01T00:00:00.000Z"
          }),
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "effectiveTo must be later than effectiveFrom."
      });

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it("should allow an open-ended effective period", async () => {
      mockRepository.create.mockResolvedValue(
        createRateCard({
          effectiveTo: null
        })
      );

      await service.create(
        createInput({
          effectiveTo: null
        }),
        5
      );

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it("should convert an active-period conflict into 409", async () => {
      const error = Object.assign(new Error("exclusion constraint violation"), {
        code: "23P01"
      });

      mockRepository.create.mockRejectedValue(error);

      await expect(
        service.create(createInput(), 5)
      ).rejects.toMatchObject({
        statusCode: 409,
        message:
          "An active rate card already exists for the same placement and pricing unit during the specified effective period."
      });
    });

    it("should convert a foreign-key violation into 400", async () => {
      const error = Object.assign(new Error("foreign key violation"), {
        code: "23503"
      });

      mockRepository.create.mockRejectedValue(error);

      await expect(
        service.create(createInput(), 5)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "The referenced placement or user does not exist."
      });
    });
  });

  describe("update", () => {
    it("should update an existing rate card", async () => {
      const existing = createRateCard();

      const updated = createRateCard({
        rateAmount: 12000,
        updatedBy: 7
      });

      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const input = createUpdateInput({
        rateAmount: 12000
      });

      const result = await service.update(100, input, 7);

      expect(result).toEqual(updated);

      expect(mockRepository.update).toHaveBeenCalledWith(100, input, 7);
    });

    it("should reject an invalid rate card id", async () => {
      await expect(
        service.update(0, createUpdateInput(), 7)
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it("should reject an invalid updatedBy id", async () => {
      await expect(
        service.update(100, createUpdateInput(), 0)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "updatedBy must be a positive integer."
      });

      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it("should return 404 when updating a missing rate card", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.update(999, createUpdateInput(), 7)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement rate card not found."
      });

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it("should validate the resulting effective period", async () => {
      const existing = createRateCard();

      mockRepository.findById.mockResolvedValue(existing);

      await expect(
        service.update(
          100,
          {
            effectiveTo: "2026-08-01T00:00:00.000Z"
          },
          7
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "effectiveTo must be later than effectiveFrom."
      });

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it("should validate a changed effectiveFrom against the existing effectiveTo", async () => {
      const existing = createRateCard();

      mockRepository.findById.mockResolvedValue(existing);

      await expect(
        service.update(
          100,
          {
            effectiveFrom: "2026-10-01T00:00:00.000Z"
          },
          7
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "effectiveTo must be later than effectiveFrom."
      });

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it("should normalize an updated currency code", async () => {
      mockRepository.findById.mockResolvedValue(createRateCard());

      mockRepository.update.mockResolvedValue(
        createRateCard({
          currencyCode: "USD"
        })
      );

      await service.update(
        100,
        {
          currencyCode: " usd "
        },
        7
      );

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        {
          currencyCode: "USD"
        },
        7
      );
    });

    it("should allow clearing effectiveTo", async () => {
      mockRepository.findById.mockResolvedValue(createRateCard());

      mockRepository.update.mockResolvedValue(
        createRateCard({
          effectiveTo: null
        })
      );

      await service.update(
        100,
        {
          effectiveTo: null
        },
        7
      );

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        {
          effectiveTo: null
        },
        7
      );
    });

    it("should convert an active-period conflict into 409", async () => {
      mockRepository.findById.mockResolvedValue(createRateCard());

      const error = Object.assign(new Error("exclusion constraint violation"), {
        code: "23P01"
      });

      mockRepository.update.mockRejectedValue(error);

      await expect(
        service.update(
          100,
          {
            rateAmount: 15000
          },
          7
        )
      ).rejects.toMatchObject({
        statusCode: 409
      });
    });

    it("should return 404 when repository update returns null", async () => {
      mockRepository.findById.mockResolvedValue(createRateCard());

      mockRepository.update.mockResolvedValue(null);

      await expect(
        service.update(
          100,
          {
            rateAmount: 15000
          },
          7
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement rate card not found."
      });
    });
  });

  describe("deactivate", () => {
    it("should deactivate an active rate card", async () => {
      const existing = createRateCard({
        status: "ACTIVE"
      });

      const updated = createRateCard({
        status: "INACTIVE"
      });

      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.deactivate(100, 7);

      expect(result).toEqual(updated);

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        {
          status: "INACTIVE"
        },
        7
      );
    });

    it("should reject deactivating an already inactive rate card", async () => {
      mockRepository.findById.mockResolvedValue(
        createRateCard({
          status: "INACTIVE"
        })
      );

      await expect(service.deactivate(100, 7)).rejects.toMatchObject({
        statusCode: 409,
        message: "Advertisement rate card is already inactive."
      });

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it("should reject deactivating an archived rate card", async () => {
      mockRepository.findById.mockResolvedValue(
        createRateCard({
          status: "ARCHIVED"
        })
      );

      await expect(service.deactivate(100, 7)).rejects.toMatchObject({
        statusCode: 409,
        message: "Archived advertisement rate cards cannot be deactivated."
      });

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it("should return 404 when deactivating a missing rate card", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.deactivate(999, 7)).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement rate card not found."
      });
    });
  });

  describe("archive", () => {
    it("should archive an active rate card", async () => {
      mockRepository.findById.mockResolvedValue(
        createRateCard({
          status: "ACTIVE"
        })
      );

      const archived = createRateCard({
        status: "ARCHIVED"
      });

      mockRepository.update.mockResolvedValue(archived);

      const result = await service.archive(100, 7);

      expect(result).toEqual(archived);

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        {
          status: "ARCHIVED"
        },
        7
      );
    });

    it("should archive an inactive rate card", async () => {
      mockRepository.findById.mockResolvedValue(
        createRateCard({
          status: "INACTIVE"
        })
      );

      mockRepository.update.mockResolvedValue(
        createRateCard({
          status: "ARCHIVED"
        })
      );

      await service.archive(100, 7);

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        {
          status: "ARCHIVED"
        },
        7
      );
    });

    it("should reject archiving an already archived rate card", async () => {
      mockRepository.findById.mockResolvedValue(
        createRateCard({
          status: "ARCHIVED"
        })
      );

      await expect(service.archive(100, 7)).rejects.toMatchObject({
        statusCode: 409,
        message: "Advertisement rate card is already archived."
      });

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it("should return 404 when archiving a missing rate card", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.archive(999, 7)).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement rate card not found."
      });
    });
  });
});
