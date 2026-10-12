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
    created_by: string | number | null;
    updated_by: string | number | null;
    created_by_name: string | null;
    updated_by_name: string | null;
    created_at: Date | string;
    updated_at: Date | string;
  }> = {}
) => ({
  id: overrides.id ?? "101",
  advertisement_id: overrides.advertisement_id ?? "202",
  target_type: overrides.target_type ?? "STATE",
  target_value: overrides.target_value ?? "tamil-nadu",
  is_include: overrides.is_include ?? true,
  created_by: overrides.created_by ?? null,
  updated_by: overrides.updated_by ?? null,
  created_by_name: overrides.created_by_name ?? null,
  updated_by_name: overrides.updated_by_name ?? null,
  created_at: overrides.created_at ?? "2026-09-19T10:00:00.000Z",
  updated_at: overrides.updated_at ?? "2026-09-19T11:00:00.000Z"
});

const createClient = () => ({
  query: vi.fn<MockQueryFunction>()
});

const expectTargetOrdering = (sql: unknown, includeTargetType: boolean) => {
  const normalizedSql = String(sql).replace(/\s+/g, " ").trim();

  const expectedOrdering = includeTargetType
    ? [
        "ORDER BY",
        "target.is_include DESC,",
        "target.target_type ASC,",
        "target.target_value ASC,",
        "target.id ASC"
      ].join(" ")
    : [
        "ORDER BY",
        "target.is_include DESC,",
        "target.target_value ASC,",
        "target.id ASC"
      ].join(" ");

  expect(normalizedSql).toContain(expectedOrdering);
};

const expectCreatedTarget = (row: ReturnType<typeof createTargetRow>) => ({
  id: Number(row.id),
  advertisementId: Number(row.advertisement_id),
  targetType: row.target_type,
  targetValue: row.target_value,
  isInclude: row.is_include,
  createdBy: row.created_by == null ? null : Number(row.created_by),
  updatedBy: row.updated_by == null ? null : Number(row.updated_by),
  createdByName: row.created_by_name,
  updatedByName: row.updated_by_name,
  createdAt:
    row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  updatedAt:
    row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)
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
        createdBy: null,
        updatedBy: null,
        createdByName: null,
        updatedByName: null,
        createdAt,
        updatedAt
      });

      expect(queryMock).toHaveBeenCalledTimes(1);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("FROM advertisement_targets AS target");
      expect(sql).toContain("WHERE target.id = $1");
      expect(sql).toContain("LEFT JOIN users AS created_user");
      expect(sql).toContain("LEFT JOIN users AS updated_user");
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

      expect(sql).toContain("FROM advertisement_targets AS target");
      expect(sql).toContain("WHERE target.advertisement_id = $1");
      expect(sql).not.toContain("advertisement_id = $2");
      expect(values).toEqual([202]);
    });

    it("uses the expected ordering", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      await repository.findByAdvertisementId(202);

      const [sql] = queryMock.mock.calls[0] ?? [];

      expectTargetOrdering(sql, true);
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

      expect(sql).toContain("WHERE target.advertisement_id = $1");
      expect(sql).toContain("AND target.target_type = $2");
      expect(values).toEqual([202, "STATE"]);
    });

    it("uses the expected ordering", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      await repository.findByAdvertisementIdAndType(202, "STATE");

      const [sql] = queryMock.mock.calls[0] ?? [];

      expectTargetOrdering(sql, false);
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

      const insertedRow = createTargetRow({
        id: 301,
        advertisement_id: 202,
        target_type: "SITE",
        target_value: "thenewstime.in",
        is_include: false,
        created_by: 1,
        updated_by: 1,
        created_at: createdAt,
        updated_at: updatedAt
      });

      queryMock
        .mockResolvedValueOnce({
          rows: [insertedRow]
        })
        .mockResolvedValueOnce({
          rows: [insertedRow]
        });

      const result = await repository.create({
        advertisementId: 202,
        targetType: "SITE",
        targetValue: "thenewstime.in",
        isInclude: false,
        createdBy: 1,
        updatedBy: 1
      });

      expect(result).toEqual(expectCreatedTarget(insertedRow));
      expect(queryMock).toHaveBeenCalledTimes(2);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("INSERT INTO advertisement_targets");
      expect(sql).toContain("advertisement_id");
      expect(sql).toContain("target_type");
      expect(sql).toContain("target_value");
      expect(sql).toContain("is_include");
      expect(sql).toContain("created_by");
      expect(sql).toContain("updated_by");
      expect(sql).toContain("RETURNING");
      expect(values).toEqual([202, "SITE", "thenewstime.in", false, 1, 1]);
    });

    it("trims the target value before inserting", async () => {
      const row = createTargetRow({
        target_value: "tamil-nadu",
        created_by: 1,
        updated_by: 1
      });

      queryMock
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [row] });

      const result = await repository.create({
        advertisementId: 202,
        targetType: "STATE",
        targetValue: "  tamil-nadu  ",
        createdBy: 1,
        updatedBy: 1
      });

      const [, values] = queryMock.mock.calls[0] ?? [];

      expect(values).toEqual([202, "STATE", "tamil-nadu", true, 1, 1]);
      expect(result.targetValue).toBe("tamil-nadu");
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it("defaults isInclude to true when it is omitted", async () => {
      const row = createTargetRow({
        is_include: true,
        created_by: 1,
        updated_by: 1
      });

      queryMock
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [row] });

      await repository.create({
        advertisementId: 202,
        targetType: "STATE",
        targetValue: "tamil-nadu",
        createdBy: 1,
        updatedBy: 1
      });

      const [, values] = queryMock.mock.calls[0] ?? [];

      expect(values).toEqual([202, "STATE", "tamil-nadu", true, 1, 1]);
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it("preserves an explicit false isInclude value", async () => {
      const row = createTargetRow({
        is_include: false,
        created_by: 1,
        updated_by: 1
      });

      queryMock
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [row] });

      await repository.create({
        advertisementId: 202,
        targetType: "STATE",
        targetValue: "tamil-nadu",
        isInclude: false,
        createdBy: 1,
        updatedBy: 1
      });

      const [, values] = queryMock.mock.calls[0] ?? [];

      expect(values).toEqual([202, "STATE", "tamil-nadu", false, 1, 1]);
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it("throws when the insert returns no row", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      await expect(
        repository.create({
          advertisementId: 202,
          targetType: "STATE",
          targetValue: "tamil-nadu",
          createdBy: 1,
          updatedBy: 1
        })
      ).rejects.toThrow("Failed to create advertisement targeting rule.");

      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("uses the supplied PoolClient for insertion", async () => {
      const client = createClient();
      const row = createTargetRow({
        created_by: 1,
        updated_by: 1
      });

      client.query
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [row] });

      const result = await repository.create(
        {
          advertisementId: 202,
          targetType: "STATE",
          targetValue: "tamil-nadu",
          createdBy: 1,
          updatedBy: 1
        },
        client as never
      );

      expect(result.id).toBe(101);
      expect(client.query).toHaveBeenCalledTimes(2);
      expect(queryMock).not.toHaveBeenCalled();

      const [sql, values] = client.query.mock.calls[0] ?? [];

      expect(sql).toContain("INSERT INTO advertisement_targets");
      expect(values).toEqual([202, "STATE", "tamil-nadu", true, 1, 1]);
    });

    it("propagates database errors", async () => {
      queryMock.mockRejectedValueOnce(new Error("database failure"));

      await expect(
        repository.create({
          advertisementId: 202,
          targetType: "STATE",
          targetValue: "tamil-nadu",
          createdBy: 1,
          updatedBy: 1
        })
      ).rejects.toThrow("database failure");
    });
  });

  describe("update", () => {
    it("updates all supplied fields and returns the mapped row", async () => {
      const row = createTargetRow({
        id: 101,
        advertisement_id: 202,
        target_type: "DISTRICT",
        target_value: "chennai",
        is_include: false,
        updated_by: 1
      });

      queryMock
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [row] });

      const result = await repository.update(
        101,
        {
          targetType: "DISTRICT",
          targetValue: "chennai",
          isInclude: false
        },
        1
      );

      expect(result).toEqual(expectCreatedTarget(row));

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("UPDATE advertisement_targets");
      expect(sql).toContain("target_type = $1");
      expect(sql).toContain("target_value = $2");
      expect(sql).toContain("is_include = $3");
      expect(sql).toContain("updated_by = $4");
      expect(sql).toContain("WHERE id = $5");
      expect(sql).toContain("RETURNING");
      expect(values).toEqual(["DISTRICT", "chennai", false, 1, 101]);
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it("updates only the target type when it is the only supplied field", async () => {
      const row = createTargetRow({
        target_type: "COUNTRY",
        updated_by: 1
      });

      queryMock
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [row] });

      await repository.update(
        101,
        {
          targetType: "COUNTRY"
        },
        1
      );

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("target_type = $1");
      expect(sql).not.toContain("target_value =");
      expect(sql).not.toContain("is_include =");
      expect(sql).toContain("updated_by = $2");
      expect(sql).toContain("WHERE id = $3");
      expect(values).toEqual(["COUNTRY", 1, 101]);
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it("trims targetValue when updating it", async () => {
      const row = createTargetRow({
        target_value: "kerala",
        updated_by: 1
      });

      queryMock
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [row] });

      await repository.update(
        101,
        {
          targetValue: "  kerala  "
        },
        1
      );

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("target_value = $1");
      expect(sql).toContain("updated_by = $2");
      expect(sql).toContain("WHERE id = $3");
      expect(values).toEqual(["kerala", 1, 101]);
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it("updates isInclude when its value is false", async () => {
      const row = createTargetRow({
        is_include: false,
        updated_by: 1
      });

      queryMock
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [row] });

      await repository.update(
        101,
        {
          isInclude: false
        },
        1
      );

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("is_include = $1");
      expect(sql).toContain("updated_by = $2");
      expect(sql).toContain("WHERE id = $3");
      expect(values).toEqual([false, 1, 101]);
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it("returns null when the target does not exist", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const result = await repository.update(
        999,
        {
          targetValue: "kerala"
        },
        1
      );

      expect(result).toBeNull();
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("does not execute an UPDATE when no fields are supplied", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [createTargetRow()]
      });

      const result = await repository.update(101, {}, 1);

      expect(result?.id).toBe(101);
      expect(queryMock).toHaveBeenCalledTimes(1);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("WHERE target.id = $1");
      expect(sql).not.toContain("UPDATE advertisement_targets");
      expect(values).toEqual([101]);
    });

    it("returns null for an empty update when the target does not exist", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const result = await repository.update(999, {}, 1);

      expect(result).toBeNull();
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("uses the supplied PoolClient for updates", async () => {
      const client = createClient();
      const row = createTargetRow({
        target_value: "kerala",
        updated_by: 1
      });

      client.query
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [row] });

      const result = await repository.update(
        101,
        {
          targetValue: "kerala"
        },
        1,
        client as never
      );

      expect(result?.targetValue).toBe("kerala");
      expect(client.query).toHaveBeenCalledTimes(2);
      expect(queryMock).not.toHaveBeenCalled();

      const [sql, values] = client.query.mock.calls[0] ?? [];

      expect(sql).toContain("UPDATE advertisement_targets");
      expect(sql).toContain("updated_by = $2");
      expect(sql).toContain("WHERE id = $3");
      expect(values).toEqual(["kerala", 1, 101]);
    });

    it("uses the supplied PoolClient for an empty update lookup", async () => {
      const client = createClient();

      client.query.mockResolvedValueOnce({
        rows: [createTargetRow()]
      });

      const result = await repository.update(101, {}, 1, client as never);

      expect(result?.id).toBe(101);
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();

      const [sql, values] = client.query.mock.calls[0] ?? [];

      expect(sql).toContain("WHERE target.id = $1");
      expect(values).toEqual([101]);
    });

    it("propagates database errors", async () => {
      queryMock.mockRejectedValueOnce(new Error("database failure"));

      await expect(
        repository.update(
          101,
          {
            targetValue: "kerala"
          },
          1
        )
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
