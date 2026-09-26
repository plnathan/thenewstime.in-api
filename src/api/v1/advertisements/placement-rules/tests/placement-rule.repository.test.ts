import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn()
}));

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: queryMock
  }
}));

import * as repository from "../placement-rule.repository.js";

describe("placement-rule.repository", () => {
  const createRow = (overrides: Record<string, unknown> = {}) => ({
    id: "1",
    advertisement_id: "10",
    placement_id: "20",
    display_order: 0,
    insertion_type: "FIXED",
    insertion_position: null,
    max_impressions: null,
    status: "ACTIVE",
    created_by: "101",
    updated_by: "101",
    created_at: new Date("2026-09-18T10:00:00Z"),
    updated_at: new Date("2026-09-18T10:00:00Z"),
    ...overrides
  });

  beforeEach(() => {
    queryMock.mockReset();
  });

  describe("findAll", () => {
    it("should retrieve all placement rules without filters", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createRow(),
          createRow({
            id: "2",
            placement_id: "21",
            display_order: 1
          })
        ]
      });

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        advertisementId: 10,
        placementId: 20,
        displayOrder: 0,
        insertionType: "FIXED",
        insertionPosition: null,
        maxImpressions: null,
        status: "ACTIVE",
        createdBy: 101,
        updatedBy: 101
      });

      expect(result[1]).toMatchObject({
        id: 2,
        placementId: 21,
        displayOrder: 1
      });

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock.mock.calls[0]?.[1]).toEqual([]);
    });

    it("should filter by advertisement ID", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [createRow()]
      });

      await repository.findAll({
        advertisementId: 10
      });

      expect(queryMock.mock.calls[0]?.[1]).toEqual([10]);
      expect(queryMock.mock.calls[0]?.[0]).toContain("advertisement_id = $1");
    });

    it("should filter by placement ID", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [createRow()]
      });

      await repository.findAll({
        placementId: 20
      });

      expect(queryMock.mock.calls[0]?.[1]).toEqual([20]);
      expect(queryMock.mock.calls[0]?.[0]).toContain("placement_id = $1");
    });

    it("should filter by status", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createRow({
            status: "INACTIVE"
          })
        ]
      });

      await repository.findAll({
        status: "INACTIVE"
      });

      expect(queryMock.mock.calls[0]?.[1]).toEqual(["INACTIVE"]);
      expect(queryMock.mock.calls[0]?.[0]).toContain("status = $1");
    });

    it("should combine all supported filters", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [createRow()]
      });

      await repository.findAll({
        advertisementId: 10,
        placementId: 20,
        status: "ACTIVE"
      });

      expect(queryMock.mock.calls[0]?.[1]).toEqual([10, 20, "ACTIVE"]);

      const sql = String(queryMock.mock.calls[0]?.[0]);

      expect(sql).toContain("advertisement_id = $1");
      expect(sql).toContain("placement_id = $2");
      expect(sql).toContain("status = $3");
      expect(sql).toContain("ORDER BY display_order ASC, id ASC");
    });

    it("should return an empty array when there are no rows", async () => {
      queryMock.mockResolvedValueOnce({
        rows: []
      });

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should retrieve a placement rule by ID", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [createRow()]
      });

      const result = await repository.findById(1);

      expect(result).toMatchObject({
        id: 1,
        advertisementId: 10,
        placementId: 20
      });

      expect(queryMock.mock.calls[0]?.[1]).toEqual([1]);
    });

    it("should return null when the placement rule does not exist", async () => {
      queryMock.mockResolvedValueOnce({
        rows: []
      });

      const result = await repository.findById(999);

      expect(result).toBeNull();
      expect(queryMock.mock.calls[0]?.[1]).toEqual([999]);
    });
  });

  describe("findByAdvertisementAndPlacement", () => {
    it("should retrieve a rule for an advertisement and placement combination", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [createRow()]
      });

      const result = await repository.findByAdvertisementAndPlacement(10, 20);

      expect(result).toMatchObject({
        id: 1,
        advertisementId: 10,
        placementId: 20
      });

      expect(queryMock.mock.calls[0]?.[1]).toEqual([10, 20]);
    });

    it("should return null when the combination does not exist", async () => {
      queryMock.mockResolvedValueOnce({
        rows: []
      });

      const result = await repository.findByAdvertisementAndPlacement(10, 999);

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create a FIXED placement rule with default values", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [createRow()]
      });

      const result = await repository.create(
        {
          advertisementId: 10,
          placementId: 20
        },
        101
      );

      expect(result).toMatchObject({
        id: 1,
        advertisementId: 10,
        placementId: 20,
        displayOrder: 0,
        insertionType: "FIXED",
        insertionPosition: null,
        maxImpressions: null,
        status: "ACTIVE",
        createdBy: 101,
        updatedBy: 101
      });

      const values = queryMock.mock.calls[0]?.[1];

      expect(values).toEqual([10, 20, 0, "FIXED", null, null, "ACTIVE", 101]);
    });

    it("should create an AFTER_N_ITEMS placement rule", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createRow({
            insertion_type: "AFTER_N_ITEMS",
            insertion_position: 5,
            max_impressions: 1000
          })
        ]
      });

      const result = await repository.create(
        {
          advertisementId: 10,
          placementId: 20,
          displayOrder: 2,
          insertionType: "AFTER_N_ITEMS",
          insertionPosition: 5,
          maxImpressions: 1000
        },
        101
      );

      expect(result.insertionType).toBe("AFTER_N_ITEMS");
      expect(result.insertionPosition).toBe(5);
      expect(result.maxImpressions).toBe(1000);

      expect(queryMock.mock.calls[0]?.[1]).toEqual([
        10,
        20,
        2,
        "AFTER_N_ITEMS",
        5,
        1000,
        "ACTIVE",
        101
      ]);
    });
  });

  describe("update", () => {
    it("should update the supplied fields", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createRow({
            display_order: 5,
            insertion_type: "AFTER_N_ITEMS",
            insertion_position: 3,
            max_impressions: 500,
            updated_by: "202"
          })
        ]
      });

      const result = await repository.update(
        1,
        {
          displayOrder: 5,
          insertionType: "AFTER_N_ITEMS",
          insertionPosition: 3,
          maxImpressions: 500
        },
        202
      );

      expect(result).toMatchObject({
        id: 1,
        displayOrder: 5,
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 3,
        maxImpressions: 500,
        updatedBy: 202
      });

      const values = queryMock.mock.calls[0]?.[1];

      expect(values).toEqual([5, "AFTER_N_ITEMS", 3, 500, 202, 1]);
    });

    it("should update status", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createRow({
            status: "INACTIVE",
            updated_by: "202"
          })
        ]
      });

      const result = await repository.update(
        1,
        {
          status: "INACTIVE"
        },
        202
      );

      expect(result?.status).toBe("INACTIVE");

      expect(queryMock.mock.calls[0]?.[1]).toEqual(["INACTIVE", 202, 1]);
    });

    it("should return the existing rule when no fields are supplied", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [createRow()]
      });

      const result = await repository.update(1, {}, 202);

      expect(result).toMatchObject({
        id: 1,
        advertisementId: 10,
        placementId: 20
      });

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock.mock.calls[0]?.[1]).toEqual([1]);
    });

    it("should return null when the rule does not exist", async () => {
      queryMock.mockResolvedValueOnce({
        rows: []
      });

      const result = await repository.update(
        999,
        {
          displayOrder: 5
        },
        202
      );

      expect(result).toBeNull();
    });
  });

  describe("deactivate", () => {
    it("should deactivate a placement rule", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createRow({
            status: "INACTIVE",
            updated_by: "202"
          })
        ]
      });

      const result = await repository.deactivate(1, 202);

      expect(result).toMatchObject({
        id: 1,
        status: "INACTIVE",
        updatedBy: 202
      });

      expect(queryMock.mock.calls[0]?.[1]).toEqual(["INACTIVE", 202, 1]);
    });
  });
});
