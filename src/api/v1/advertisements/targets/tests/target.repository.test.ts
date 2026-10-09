import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdvertisementTargetType } from "../target.types.js";

interface MockQueryResult<T = unknown> {
  rows: T[];
  rowCount?: number | null;
}

type MockQueryFunction = (...args: unknown[]) => Promise<MockQueryResult>;

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn<MockQueryFunction>()
}));

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: queryMock
  }
}));

import * as repository from "../target.repository.js";

const createTargetRow = (
  overrides: Partial<{
    id: string | number;
    advertisement_id: string | number;
    target_type: AdvertisementTargetType;
    target_value: string;
    is_include: boolean;
    created_at: Date | string;
    updated_at: Date | string;
  }> = {}
) => ({
  id: overrides.id ?? "101",
  advertisement_id: overrides.advertisement_id ?? "202",
  target_type: overrides.target_type ?? "STATE",
  target_value: overrides.target_value ?? "tamil-nadu",
  is_include: overrides.is_include ?? true,
  created_at: overrides.created_at ?? "2026-09-19T10:00:00.000Z",
  updated_at: overrides.updated_at ?? "2026-09-19T11:00:00.000Z"
});

const createClient = () => ({
  query: vi.fn<MockQueryFunction>()
});

describe("target.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns the mapped target when a row exists", async () => {
      const createdAt = new Date("2026-09-19T10:00:00.000Z");
      const updatedAt = new Date("2026-09-19T11:00:00.000Z");

      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            id: "101",
            advertisement_id: "202",
            target_type: "STATE",
            target_value: "tamil-nadu",
            is_include: true,
            created_at: createdAt,
            updated_at: updatedAt
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result).toEqual({
        id: 101,
        advertisementId: 202,
        targetType: "STATE",
        targetValue: "tamil-nadu",
        isInclude: true,
        createdAt,
        updatedAt
      });

      expect(queryMock).toHaveBeenCalledTimes(1);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("FROM advertisement_targets");
      expect(sql).toContain("WHERE id = $1");
      expect(sql).toContain("LIMIT 1");
      expect(values).toEqual([101]);
    });

    it("returns null when no row exists", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findById(999);

      expect(result).toBeNull();
      expect(queryMock).toHaveBeenCalledTimes(1);

      const [, values] = queryMock.mock.calls[0] ?? [];

      expect(values).toEqual([999]);
    });

    it("maps numeric database IDs correctly", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            id: 301,
            advertisement_id: 401
          })
        ]
      });

      const result = await repository.findById(301);

      expect(result?.id).toBe(301);
      expect(result?.advertisementId).toBe(401);
    });

    it("converts string dates to Date instances", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            created_at: "2026-09-19T12:00:00.000Z",
            updated_at: "2026-09-19T13:00:00.000Z"
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);

      expect(result?.createdAt.toISOString()).toBe("2026-09-19T12:00:00.000Z");
      expect(result?.updatedAt.toISOString()).toBe("2026-09-19T13:00:00.000Z");
    });

    it("preserves Date instances without recreating them", async () => {
      const createdAt = new Date("2026-09-19T12:00:00.000Z");
      const updatedAt = new Date("2026-09-19T13:00:00.000Z");

      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            created_at: createdAt,
            updated_at: updatedAt
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result?.createdAt).toBe(createdAt);
      expect(result?.updatedAt).toBe(updatedAt);
    });

    it("passes the supplied PoolClient to the database query", async () => {
      const client = createClient();

      client.query.mockResolvedValueOnce({
        rows: [createTargetRow()]
      });

      const result = await repository.findById(101, client as never);

      expect(result).not.toBeNull();
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();

      const [, values] = client.query.mock.calls[0] ?? [];

      expect(values).toEqual([101]);
    });

    it("propagates database errors", async () => {
      queryMock.mockRejectedValueOnce(new Error("database failure"));

      await expect(repository.findById(101)).rejects.toThrow(
        "database failure"
      );
    });
  });

  describe("findByAdvertisementId", () => {
    it("returns all targets for an advertisement", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            id: "101",
            advertisement_id: "202",
            target_type: "SITE",
            target_value: "thenewstime.in",
            is_include: true
          }),
          createTargetRow({
            id: "102",
            advertisement_id: "202",
            target_type: "STATE",
            target_value: "tamil-nadu",
            is_include: false
          })
        ]
      });

      const result = await repository.findByAdvertisementId(202);

      expect(result).toHaveLength(2);

      expect(result[0]?.id).toBe(101);
      expect(result[0]?.advertisementId).toBe(202);
      expect(result[0]?.targetType).toBe("SITE");
      expect(result[0]?.targetValue).toBe("thenewstime.in");
      expect(result[0]?.isInclude).toBe(true);

      expect(result[1]?.id).toBe(102);
      expect(result[1]?.advertisementId).toBe(202);
      expect(result[1]?.targetType).toBe("STATE");
      expect(result[1]?.isInclude).toBe(false);
    });

    it("returns an empty array when the advertisement has no targets", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByAdvertisementId(202);

      expect(result).toEqual([]);
    });

    it("uses the advertisement ID as the only query parameter", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      await repository.findByAdvertisementId(202);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("FROM advertisement_targets");
      expect(sql).toContain("WHERE advertisement_id = $1");
      expect(sql).not.toContain("advertisement_id = $2");
      expect(values).toEqual([202]);
    });

    it("uses the expected ordering", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      await repository.findByAdvertisementId(202);

      const [sql] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain(
        "ORDER BY\n        is_include DESC,\n        target_type ASC,\n        target_value ASC,\n        id ASC"
      );
    });

    it("maps all supported target types", async () => {
      const targetTypes: AdvertisementTargetType[] = [
        "SITE",
        "NEWS",
        "CATEGORY",
        "STATE",
        "DISTRICT",
        "COUNTRY"
      ];

      queryMock.mockResolvedValueOnce({
        rows: targetTypes.map((targetType, index) =>
          createTargetRow({
            id: index + 1,
            advertisement_id: 202,
            target_type: targetType,
            target_value: `value-${index + 1}`
          })
        )
      });

      const result = await repository.findByAdvertisementId(202);

      expect(result.map((target) => target.targetType)).toEqual(targetTypes);
    });

    it("maps include and exclude targets correctly", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            id: 101,
            is_include: true
          }),
          createTargetRow({
            id: 102,
            is_include: false
          })
        ]
      });

      const result = await repository.findByAdvertisementId(202);

      expect(result[0]?.isInclude).toBe(true);
      expect(result[1]?.isInclude).toBe(false);
    });

    it("passes the supplied PoolClient to the database query", async () => {
      const client = createClient();

      client.query.mockResolvedValueOnce({
        rows: [createTargetRow()]
      });

      const result = await repository.findByAdvertisementId(
        202,
        client as never
      );

      expect(result).toHaveLength(1);
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();

      const [, values] = client.query.mock.calls[0] ?? [];

      expect(values).toEqual([202]);
    });

    it("propagates database errors", async () => {
      queryMock.mockRejectedValueOnce(new Error("database failure"));

      await expect(repository.findByAdvertisementId(202)).rejects.toThrow(
        "database failure"
      );
    });
  });

  describe("findByAdvertisementIdAndType", () => {
    it("returns targets matching the advertisement and target type", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            id: "101",
            advertisement_id: "202",
            target_type: "STATE",
            target_value: "tamil-nadu",
            is_include: true
          }),
          createTargetRow({
            id: "102",
            advertisement_id: "202",
            target_type: "STATE",
            target_value: "kerala",
            is_include: false
          })
        ]
      });

      const result = await repository.findByAdvertisementIdAndType(
        202,
        "STATE"
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.targetType).toBe("STATE");
      expect(result[1]?.targetType).toBe("STATE");
      expect(result[0]?.advertisementId).toBe(202);
      expect(result[1]?.advertisementId).toBe(202);
    });

    it("returns an empty array when no matching targets exist", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByAdvertisementIdAndType(
        202,
        "COUNTRY"
      );

      expect(result).toEqual([]);
    });

    it("passes both advertisement ID and target type as parameters", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      await repository.findByAdvertisementIdAndType(202, "STATE");

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("WHERE advertisement_id = $1");
      expect(sql).toContain("AND target_type = $2");
      expect(values).toEqual([202, "STATE"]);
    });

    it("uses the expected ordering", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      await repository.findByAdvertisementIdAndType(202, "STATE");

      const [sql] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain(
        "ORDER BY\n        is_include DESC,\n        target_value ASC,\n        id ASC"
      );
    });

    it("supports every target type", async () => {
      const targetTypes: AdvertisementTargetType[] = [
        "SITE",
        "NEWS",
        "CATEGORY",
        "STATE",
        "DISTRICT",
        "COUNTRY"
      ];

      for (const targetType of targetTypes) {
        queryMock.mockResolvedValueOnce({
          rows: [
            createTargetRow({
              target_type: targetType
            })
          ]
        });

        const result = await repository.findByAdvertisementIdAndType(
          202,
          targetType
        );

        expect(result).toHaveLength(1);
        expect(result[0]?.targetType).toBe(targetType);
      }

      expect(queryMock).toHaveBeenCalledTimes(targetTypes.length);
    });

    it("passes the supplied PoolClient to the database query", async () => {
      const client = createClient();

      client.query.mockResolvedValueOnce({
        rows: [createTargetRow()]
      });

      const result = await repository.findByAdvertisementIdAndType(
        202,
        "STATE",
        client as never
      );

      expect(result).toHaveLength(1);
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();

      const [, values] = client.query.mock.calls[0] ?? [];

      expect(values).toEqual([202, "STATE"]);
    });

    it("propagates database errors", async () => {
      queryMock.mockRejectedValueOnce(new Error("database failure"));

      await expect(
        repository.findByAdvertisementIdAndType(202, "STATE")
      ).rejects.toThrow("database failure");
    });
  });

  describe("create", () => {
    it("inserts a target and returns the mapped database row", async () => {
      const createdAt = new Date("2026-09-19T10:00:00.000Z");
      const updatedAt = new Date("2026-09-19T11:00:00.000Z");

      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            id: 301,
            advertisement_id: 202,
            target_type: "SITE",
            target_value: "thenewstime.in",
            is_include: false,
            created_at: createdAt,
            updated_at: updatedAt
          })
        ]
      });

      const result = await repository.create({
        advertisementId: 202,
        targetType: "SITE",
        targetValue: "thenewstime.in",
        isInclude: false
      });

      expect(result).toEqual({
        id: 301,
        advertisementId: 202,
        targetType: "SITE",
        targetValue: "thenewstime.in",
        isInclude: false,
        createdAt,
        updatedAt
      });

      expect(queryMock).toHaveBeenCalledTimes(1);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("INSERT INTO advertisement_targets");
      expect(sql).toContain("advertisement_id");
      expect(sql).toContain("target_type");
      expect(sql).toContain("target_value");
      expect(sql).toContain("is_include");
      expect(sql).toContain("RETURNING");
      expect(values).toEqual([202, "SITE", "thenewstime.in", false]);
    });

    it("trims the target value before inserting", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            target_value: "tamil-nadu"
          })
        ]
      });

      const result = await repository.create({
        advertisementId: 202,
        targetType: "STATE",
        targetValue: "  tamil-nadu  "
      });

      const [, values] = queryMock.mock.calls[0] ?? [];

      expect(values).toEqual([202, "STATE", "tamil-nadu", true]);
      expect(result.targetValue).toBe("tamil-nadu");
    });

    it("defaults isInclude to true when it is omitted", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            is_include: true
          })
        ]
      });

      await repository.create({
        advertisementId: 202,
        targetType: "STATE",
        targetValue: "tamil-nadu"
      });

      const [, values] = queryMock.mock.calls[0] ?? [];

      expect(values).toEqual([202, "STATE", "tamil-nadu", true]);
    });

    it("preserves an explicit false isInclude value", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            is_include: false
          })
        ]
      });

      await repository.create({
        advertisementId: 202,
        targetType: "STATE",
        targetValue: "tamil-nadu",
        isInclude: false
      });

      const [, values] = queryMock.mock.calls[0] ?? [];

      expect(values).toEqual([202, "STATE", "tamil-nadu", false]);
    });

    it("throws when the insert returns no row", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      await expect(
        repository.create({
          advertisementId: 202,
          targetType: "STATE",
          targetValue: "tamil-nadu"
        })
      ).rejects.toThrow("Failed to create advertisement targeting rule.");
    });

    it("uses the supplied PoolClient for insertion", async () => {
      const client = createClient();

      client.query.mockResolvedValueOnce({
        rows: [createTargetRow()]
      });

      const result = await repository.create(
        {
          advertisementId: 202,
          targetType: "STATE",
          targetValue: "tamil-nadu"
        },
        client as never
      );

      expect(result.id).toBe(101);
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();

      const [sql, values] = client.query.mock.calls[0] ?? [];

      expect(sql).toContain("INSERT INTO advertisement_targets");
      expect(values).toEqual([202, "STATE", "tamil-nadu", true]);
    });

    it("propagates database errors", async () => {
      queryMock.mockRejectedValueOnce(new Error("database failure"));

      await expect(
        repository.create({
          advertisementId: 202,
          targetType: "STATE",
          targetValue: "tamil-nadu"
        })
      ).rejects.toThrow("database failure");
    });
  });

  describe("update", () => {
    it("updates all supplied fields and returns the mapped row", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            id: 101,
            advertisement_id: 202,
            target_type: "DISTRICT",
            target_value: "chennai",
            is_include: false
          })
        ]
      });

      const result = await repository.update(101, {
        targetType: "DISTRICT",
        targetValue: "chennai",
        isInclude: false
      });

      expect(result).toMatchObject({
        id: 101,
        advertisementId: 202,
        targetType: "DISTRICT",
        targetValue: "chennai",
        isInclude: false
      });

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("UPDATE advertisement_targets");
      expect(sql).toContain("target_type = $1");
      expect(sql).toContain("target_value = $2");
      expect(sql).toContain("is_include = $3");
      expect(sql).toContain("WHERE id = $4");
      expect(sql).toContain("RETURNING");
      expect(values).toEqual(["DISTRICT", "chennai", false, 101]);
    });

    it("updates only the target type when it is the only supplied field", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            target_type: "COUNTRY"
          })
        ]
      });

      await repository.update(101, {
        targetType: "COUNTRY"
      });

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("target_type = $1");
      expect(sql).not.toContain("target_value =");
      expect(sql).not.toContain("is_include =");
      expect(sql).toContain("WHERE id = $2");
      expect(values).toEqual(["COUNTRY", 101]);
    });

    it("trims targetValue when updating it", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            target_value: "kerala"
          })
        ]
      });

      await repository.update(101, {
        targetValue: "  kerala  "
      });

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("target_value = $1");
      expect(values).toEqual(["kerala", 101]);
    });

    it("updates isInclude when its value is false", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            is_include: false
          })
        ]
      });

      await repository.update(101, {
        isInclude: false
      });

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("is_include = $1");
      expect(values).toEqual([false, 101]);
    });

    it("returns null when the target does not exist", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const result = await repository.update(999, {
        targetValue: "kerala"
      });

      expect(result).toBeNull();
    });

    it("does not execute an UPDATE when no fields are supplied", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [createTargetRow()]
      });

      const result = await repository.update(101, {});

      expect(result?.id).toBe(101);
      expect(queryMock).toHaveBeenCalledTimes(1);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("WHERE id = $1");
      expect(sql).not.toContain("UPDATE advertisement_targets");
      expect(values).toEqual([101]);
    });

    it("returns null for an empty update when the target does not exist", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const result = await repository.update(999, {});

      expect(result).toBeNull();
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("uses the supplied PoolClient for updates", async () => {
      const client = createClient();

      client.query.mockResolvedValueOnce({
        rows: [
          createTargetRow({
            target_value: "kerala"
          })
        ]
      });

      const result = await repository.update(
        101,
        {
          targetValue: "kerala"
        },
        client as never
      );

      expect(result?.targetValue).toBe("kerala");
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();

      const [sql, values] = client.query.mock.calls[0] ?? [];

      expect(sql).toContain("UPDATE advertisement_targets");
      expect(values).toEqual(["kerala", 101]);
    });

    it("uses the supplied PoolClient for an empty update lookup", async () => {
      const client = createClient();

      client.query.mockResolvedValueOnce({
        rows: [createTargetRow()]
      });

      const result = await repository.update(101, {}, client as never);

      expect(result?.id).toBe(101);
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });

    it("propagates database errors", async () => {
      queryMock.mockRejectedValueOnce(new Error("database failure"));

      await expect(
        repository.update(101, {
          targetValue: "kerala"
        })
      ).rejects.toThrow("database failure");
    });
  });

  describe("deleteById", () => {
    it("returns true when a target is deleted", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 1
      });

      const result = await repository.deleteById(101);

      expect(result).toBe(true);
      expect(queryMock).toHaveBeenCalledTimes(1);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("DELETE FROM advertisement_targets");
      expect(sql).toContain("WHERE id = $1");
      expect(values).toEqual([101]);
    });

    it("returns false when no target is deleted", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const result = await repository.deleteById(999);

      expect(result).toBe(false);
    });

    it("returns false when rowCount is null", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: null
      });

      const result = await repository.deleteById(101);

      expect(result).toBe(false);
    });

    it("uses the supplied PoolClient for deletion", async () => {
      const client = createClient();

      client.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1
      });

      const result = await repository.deleteById(101, client as never);

      expect(result).toBe(true);
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();

      const [sql, values] = client.query.mock.calls[0] ?? [];

      expect(sql).toContain("DELETE FROM advertisement_targets");
      expect(values).toEqual([101]);
    });

    it("propagates database errors", async () => {
      queryMock.mockRejectedValueOnce(new Error("database failure"));

      await expect(repository.deleteById(101)).rejects.toThrow(
        "database failure"
      );
    });
  });

  describe("deleteByAdvertisementId", () => {
    it("returns the number of deleted targets", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 3
      });

      const result = await repository.deleteByAdvertisementId(202);

      expect(result).toBe(3);
      expect(queryMock).toHaveBeenCalledTimes(1);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("DELETE FROM advertisement_targets");
      expect(sql).toContain("WHERE advertisement_id = $1");
      expect(values).toEqual([202]);
    });

    it("returns zero when no targets are deleted", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const result = await repository.deleteByAdvertisementId(202);

      expect(result).toBe(0);
    });

    it("returns zero when rowCount is null", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: null
      });

      const result = await repository.deleteByAdvertisementId(202);

      expect(result).toBe(0);
    });

    it("uses the supplied PoolClient for deletion", async () => {
      const client = createClient();

      client.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 2
      });

      const result = await repository.deleteByAdvertisementId(
        202,
        client as never
      );

      expect(result).toBe(2);
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();

      const [sql, values] = client.query.mock.calls[0] ?? [];

      expect(sql).toContain("DELETE FROM advertisement_targets");
      expect(sql).toContain("WHERE advertisement_id = $1");
      expect(values).toEqual([202]);
    });

    it("propagates database errors", async () => {
      queryMock.mockRejectedValueOnce(new Error("database failure"));

      await expect(repository.deleteByAdvertisementId(202)).rejects.toThrow(
        "database failure"
      );
    });
  });
});
