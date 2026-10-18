import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AdvertisementPlacementRule,
  CreatePlacementRuleInput,
  UpdatePlacementRuleInput
} from "../placement-rule.types.js";

const {
  mockFindAll,
  mockFindById,
  mockFindByAdvertisementAndPlacement,
  mockGetRuleReferenceState,
  mockCreate,
  mockUpdate,
  mockDeactivate
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockFindById: vi.fn(),
  mockFindByAdvertisementAndPlacement: vi.fn(),
  mockGetRuleReferenceState: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDeactivate: vi.fn()
}));

vi.mock("../placement-rule.repository.js", () => ({
  findAll: mockFindAll,
  findById: mockFindById,
  findByAdvertisementAndPlacement: mockFindByAdvertisementAndPlacement,
  getRuleReferenceState: mockGetRuleReferenceState,
  create: mockCreate,
  update: mockUpdate,
  deactivate: mockDeactivate
}));

import * as service from "../placement-rule.service.js";

describe("placement-rule.service", () => {
  const createRule = (
    overrides: Partial<AdvertisementPlacementRule> = {}
  ): AdvertisementPlacementRule => ({
    id: 1,
    advertisementId: 10,
    placementId: 20,
    displayOrder: 0,
    insertionType: "FIXED",
    insertionPosition: null,
    maxImpressions: null,
    status: "ACTIVE",
    createdBy: 101,
    updatedBy: 101,
    createdAt: new Date("2026-09-18T10:00:00Z"),
    updatedAt: new Date("2026-09-18T10:00:00Z"),
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuleReferenceState.mockResolvedValue({
      advertisementExists: true,
      placementExists: true
    });
  });

  describe("getAll", () => {
    it("should return placement rules from the repository", async () => {
      const rules = [
        createRule(),
        createRule({
          id: 2,
          placementId: 21
        })
      ];

      mockFindAll.mockResolvedValueOnce(rules);

      const result = await service.getAll({
        advertisementId: 10
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        advertisementId: 10
      });

      expect(result).toEqual(rules);
    });

    it("should use an empty query when no query is supplied", async () => {
      mockFindAll.mockResolvedValueOnce([]);

      const result = await service.getAll();

      expect(mockFindAll).toHaveBeenCalledWith({});
      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("should return the requested placement rule", async () => {
      const rule = createRule();

      mockFindById.mockResolvedValueOnce(rule);

      const result = await service.getById(1);

      expect(mockFindById).toHaveBeenCalledWith(1);
      expect(result).toEqual(rule);
    });

    it("should throw when the placement rule does not exist", async () => {
      mockFindById.mockResolvedValueOnce(null);

      await expect(service.getById(999)).rejects.toThrow(
        "Advertisement placement rule not found"
      );
    });
  });

  describe("create", () => {
    it("should create a FIXED placement rule", async () => {
      const input: CreatePlacementRuleInput = {
        advertisementId: 10,
        placementId: 20,
        insertionType: "FIXED"
      };

      const createdRule = createRule();

      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce(createdRule);

      const result = await service.create(input, 101);

      expect(mockFindByAdvertisementAndPlacement).toHaveBeenCalledWith(10, 20);

      expect(mockCreate).toHaveBeenCalledWith(input, 101);
      expect(result).toEqual(createdRule);
    });

    it("should create an AFTER_N_ITEMS placement rule", async () => {
      const input: CreatePlacementRuleInput = {
        advertisementId: 10,
        placementId: 20,
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 5
      };

      const createdRule = createRule({
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 5
      });

      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce(createdRule);

      const result = await service.create(input, 101);

      expect(mockCreate).toHaveBeenCalledWith(input, 101);
      expect(result.insertionType).toBe("AFTER_N_ITEMS");
      expect(result.insertionPosition).toBe(5);
    });

    it("should create a BETWEEN_SECTIONS placement rule", async () => {
      const input: CreatePlacementRuleInput = {
        advertisementId: 10,
        placementId: 20,
        insertionType: "BETWEEN_SECTIONS",
        insertionPosition: 2
      };

      const createdRule = createRule({
        insertionType: "BETWEEN_SECTIONS",
        insertionPosition: 2
      });

      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce(createdRule);

      const result = await service.create(input, 101);

      expect(mockCreate).toHaveBeenCalledWith(input, 101);
      expect(result.insertionType).toBe("BETWEEN_SECTIONS");
      expect(result.insertionPosition).toBe(2);
    });

    it("should reject a rule for a missing advertisement", async () => {
      mockGetRuleReferenceState.mockResolvedValueOnce({
        advertisementExists: false,
        placementExists: true
      });

      await expect(
        service.create({ advertisementId: 999, placementId: 20 }, 101)
      ).rejects.toThrow("Advertisement not found");
      expect(mockFindByAdvertisementAndPlacement).not.toHaveBeenCalled();
    });

    it("should reject a rule for a missing placement", async () => {
      mockGetRuleReferenceState.mockResolvedValueOnce({
        advertisementExists: true,
        placementExists: false
      });

      await expect(
        service.create({ advertisementId: 10, placementId: 999 }, 101)
      ).rejects.toThrow("Advertisement placement not found");
      expect(mockFindByAdvertisementAndPlacement).not.toHaveBeenCalled();
    });

    it("should reject a duplicate advertisement and placement combination", async () => {
      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(createRule());

      await expect(
        service.create(
          {
            advertisementId: 10,
            placementId: 20
          },
          101
        )
      ).rejects.toThrow(
        "An advertisement placement rule already exists for this advertisement and placement"
      );

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should reject a FIXED rule with an insertion position", async () => {
      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            advertisementId: 10,
            placementId: 20,
            insertionType: "FIXED",
            insertionPosition: 1
          },
          101
        )
      ).rejects.toThrow(
        "insertionPosition must be null when insertionType is FIXED"
      );

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should reject AFTER_N_ITEMS without an insertion position", async () => {
      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            advertisementId: 10,
            placementId: 20,
            insertionType: "AFTER_N_ITEMS"
          },
          101
        )
      ).rejects.toThrow(
        "insertionPosition is required and must be positive when insertionType is AFTER_N_ITEMS"
      );

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should reject BETWEEN_SECTIONS without an insertion position", async () => {
      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            advertisementId: 10,
            placementId: 20,
            insertionType: "BETWEEN_SECTIONS"
          },
          101
        )
      ).rejects.toThrow(
        "insertionPosition is required and must be positive when insertionType is BETWEEN_SECTIONS"
      );

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should reject a non-positive insertion position", async () => {
      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            advertisementId: 10,
            placementId: 20,
            insertionType: "AFTER_N_ITEMS",
            insertionPosition: 0
          },
          101
        )
      ).rejects.toThrow(
        "insertionPosition is required and must be positive when insertionType is AFTER_N_ITEMS"
      );

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should translate a database duplicate error into the duplicate message", async () => {
      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(null);

      mockCreate.mockRejectedValueOnce({
        code: "23505"
      });

      await expect(
        service.create(
          {
            advertisementId: 10,
            placementId: 20
          },
          101
        )
      ).rejects.toThrow(
        "An advertisement placement rule already exists for this advertisement and placement"
      );
    });

    it("should rethrow non-duplicate repository errors", async () => {
      const error = new Error("Database unavailable");

      mockFindByAdvertisementAndPlacement.mockResolvedValueOnce(null);
      mockCreate.mockRejectedValueOnce(error);

      await expect(
        service.create(
          {
            advertisementId: 10,
            placementId: 20
          },
          101
        )
      ).rejects.toBe(error);
    });
  });

  describe("update", () => {
    it("should update a placement rule", async () => {
      const existing = createRule();

      const input: UpdatePlacementRuleInput = {
        displayOrder: 5
      };

      const updated = createRule({
        displayOrder: 5,
        updatedBy: 202
      });

      mockFindById.mockResolvedValueOnce(existing);
      mockUpdate.mockResolvedValueOnce(updated);

      const result = await service.update(1, input, 202);

      expect(mockFindById).toHaveBeenCalledWith(1);
      expect(mockUpdate).toHaveBeenCalledWith(1, input, 202);
      expect(result).toEqual(updated);
    });

    it("should preserve the existing insertion type when only the position is unchanged", async () => {
      const existing = createRule({
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 3
      });

      const input: UpdatePlacementRuleInput = {
        displayOrder: 5
      };

      const updated = createRule({
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 3,
        displayOrder: 5
      });

      mockFindById.mockResolvedValueOnce(existing);
      mockUpdate.mockResolvedValueOnce(updated);

      const result = await service.update(1, input, 202);

      expect(mockUpdate).toHaveBeenCalledWith(1, input, 202);
      expect(result.insertionType).toBe("AFTER_N_ITEMS");
      expect(result.insertionPosition).toBe(3);
    });

    it("should reject changing insertion type to FIXED while retaining a position", async () => {
      const existing = createRule({
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 3
      });

      mockFindById.mockResolvedValueOnce(existing);

      await expect(
        service.update(
          1,
          {
            insertionType: "FIXED"
          },
          202
        )
      ).rejects.toThrow(
        "insertionPosition must be null when insertionType is FIXED"
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should reject changing insertion type to AFTER_N_ITEMS without a position", async () => {
      const existing = createRule({
        insertionType: "FIXED",
        insertionPosition: null
      });

      mockFindById.mockResolvedValueOnce(existing);

      await expect(
        service.update(
          1,
          {
            insertionType: "AFTER_N_ITEMS"
          },
          202
        )
      ).rejects.toThrow(
        "insertionPosition is required and must be positive when insertionType is AFTER_N_ITEMS"
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should allow changing a FIXED rule to AFTER_N_ITEMS when a position is supplied", async () => {
      const existing = createRule();

      const input: UpdatePlacementRuleInput = {
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 5
      };

      const updated = createRule({
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 5,
        updatedBy: 202
      });

      mockFindById.mockResolvedValueOnce(existing);
      mockUpdate.mockResolvedValueOnce(updated);

      const result = await service.update(1, input, 202);

      expect(mockUpdate).toHaveBeenCalledWith(1, input, 202);
      expect(result.insertionType).toBe("AFTER_N_ITEMS");
      expect(result.insertionPosition).toBe(5);
    });

    it("should return the existing rule when no update fields are supplied", async () => {
      const existing = createRule();

      mockFindById.mockResolvedValueOnce(existing);
      mockUpdate.mockResolvedValueOnce(existing);

      const result = await service.update(1, {}, 202);

      expect(mockUpdate).toHaveBeenCalledWith(1, {}, 202);
      expect(result).toEqual(existing);
    });

    it("should throw when the placement rule does not exist", async () => {
      mockFindById.mockResolvedValueOnce(null);

      await expect(
        service.update(999, { displayOrder: 5 }, 202)
      ).rejects.toThrow("Advertisement placement rule not found");

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("deactivate", () => {
    it("should deactivate an active placement rule", async () => {
      const existing = createRule();

      const deactivated = createRule({
        status: "INACTIVE",
        updatedBy: 202
      });

      mockFindById.mockResolvedValueOnce(existing);
      mockDeactivate.mockResolvedValueOnce(deactivated);

      const result = await service.deactivate(1, 202);

      expect(mockFindById).toHaveBeenCalledWith(1);
      expect(mockDeactivate).toHaveBeenCalledWith(1, 202);
      expect(result).toEqual(deactivated);
    });

    it("should reject deactivation of an already inactive rule", async () => {
      mockFindById.mockResolvedValueOnce(
        createRule({
          status: "INACTIVE"
        })
      );

      await expect(service.deactivate(1, 202)).rejects.toThrow(
        "Advertisement placement rule is already inactive"
      );

      expect(mockDeactivate).not.toHaveBeenCalled();
    });

    it("should throw when the placement rule does not exist", async () => {
      mockFindById.mockResolvedValueOnce(null);

      await expect(service.deactivate(999, 202)).rejects.toThrow(
        "Advertisement placement rule not found"
      );

      expect(mockDeactivate).not.toHaveBeenCalled();
    });

    it("should throw when repository deactivation returns null", async () => {
      mockFindById.mockResolvedValueOnce(createRule());
      mockDeactivate.mockResolvedValueOnce(null);

      await expect(service.deactivate(1, 202)).rejects.toThrow(
        "Advertisement placement rule not found"
      );
    });
  });
});
