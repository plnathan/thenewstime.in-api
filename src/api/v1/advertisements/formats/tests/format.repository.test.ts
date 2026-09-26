import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdvertisementFormatStatus } from "../format.types.js";

interface MockQueryResult<T = unknown> {
  rows: T[];
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

import * as repository from "../format.repository.js";

interface FormatDbRow {
  id: string | number;
  code: string;
  display_name: string;
  description: string | null;
  width_px: number | null;
  height_px: number | null;
  is_responsive: boolean;
  is_system_format: boolean;
  status: AdvertisementFormatStatus;
  display_order: number;
  created_at: Date | string;
  updated_at: Date | string;
}

const createDbRow = (overrides: Partial<FormatDbRow> = {}): FormatDbRow => ({
  id: "101",
  code: "HOME_BANNER",
  display_name: "Home Banner",
  description: "Homepage banner advertisement format",
  width_px: 1200,
  height_px: 300,
  is_responsive: true,
  is_system_format: true,
  status: "ACTIVE",
  display_order: 1,
  created_at: new Date("2026-01-01T10:00:00.000Z"),
  updated_at: new Date("2026-01-02T10:00:00.000Z"),
  ...overrides
});

const getLastQueryCall = (): unknown[] => {
  const calls = queryMock.mock.calls;

  if (calls.length === 0) {
    throw new Error("Expected queryMock to have been called.");
  }

  return calls[calls.length - 1] as unknown[];
};

describe("format.repository", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  describe("findById", () => {
    it("should return the mapped format when a row exists", async () => {
      queryMock.mockResolvedValue({
        rows: [createDbRow()]
      });

      const result = await repository.findById(101);

      expect(result).toEqual({
        id: 101,
        code: "HOME_BANNER",
        displayName: "Home Banner",
        description: "Homepage banner advertisement format",
        widthPx: 1200,
        heightPx: 300,
        isResponsive: true,
        isSystemFormat: true,
        status: "ACTIVE",
        displayOrder: 1,
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-02T10:00:00.000Z")
      });
    });

    it("should convert a numeric string id to a number", async () => {
      queryMock.mockResolvedValue({
        rows: [createDbRow({ id: "987654321" })]
      });

      const result = await repository.findById(987654321);

      expect(result?.id).toBe(987654321);
      expect(typeof result?.id).toBe("number");
    });

    it("should return null when the format does not exist", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it("should pass the id as the first query parameter", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      await repository.findById(42);

      const call = getLastQueryCall();

      expect(call[1]).toEqual([42]);
    });

    it("should query advertisement_formats by id", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      await repository.findById(42);

      const call = getLastQueryCall();
      const sql = String(call[0]);

      expect(sql).toContain("FROM advertisement_formats");
      expect(sql).toContain("WHERE id = $1");
      expect(sql).toContain("LIMIT 1");
    });

    it("should propagate database errors", async () => {
      queryMock.mockRejectedValue(new Error("database failure"));

      await expect(repository.findById(42)).rejects.toThrow("database failure");
    });

    it("should use the supplied database client", async () => {
      const clientQuery = vi.fn<MockQueryFunction>();

      clientQuery.mockResolvedValue({
        rows: [createDbRow({ id: 55 })]
      });

      const client = {
        query: clientQuery
      };

      const result = await repository.findById(55, client as never);

      expect(result?.id).toBe(55);
      expect(clientQuery).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe("findByCode", () => {
    it("should return the mapped format when a row exists", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            id: 202,
            code: "NEWS_DETAIL_MODAL",
            display_name: "News Detail Modal",
            description: "Modal advertisement for news detail pages",
            width_px: 600,
            height_px: 400,
            is_responsive: false,
            is_system_format: false,
            status: "ACTIVE",
            display_order: 5
          })
        ]
      });

      const result = await repository.findByCode("NEWS_DETAIL_MODAL");

      expect(result).toEqual({
        id: 202,
        code: "NEWS_DETAIL_MODAL",
        displayName: "News Detail Modal",
        description: "Modal advertisement for news detail pages",
        widthPx: 600,
        heightPx: 400,
        isResponsive: false,
        isSystemFormat: false,
        status: "ACTIVE",
        displayOrder: 5,
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-02T10:00:00.000Z")
      });
    });

    it("should return null when the code does not exist", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findByCode("UNKNOWN_FORMAT");

      expect(result).toBeNull();
    });

    it("should pass the code as the first query parameter", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      await repository.findByCode("HOME_TOP");

      const call = getLastQueryCall();

      expect(call[1]).toEqual(["HOME_TOP"]);
    });

    it("should query advertisement_formats by code", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      await repository.findByCode("HOME_TOP");

      const call = getLastQueryCall();
      const sql = String(call[0]);

      expect(sql).toContain("FROM advertisement_formats");
      expect(sql).toContain("WHERE code = $1");
      expect(sql).toContain("LIMIT 1");
    });

    it("should propagate database errors", async () => {
      queryMock.mockRejectedValue(new Error("format lookup failed"));

      await expect(repository.findByCode("HOME_TOP")).rejects.toThrow(
        "format lookup failed"
      );
    });

    it("should use the supplied database client", async () => {
      const clientQuery = vi.fn<MockQueryFunction>();

      clientQuery.mockResolvedValue({
        rows: [createDbRow({ id: 77 })]
      });

      const client = {
        query: clientQuery
      };

      const result = await repository.findByCode("HOME_TOP", client as never);

      expect(result?.id).toBe(77);
      expect(clientQuery).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return all formats when no status is supplied", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            id: 1,
            code: "FORMAT_A",
            display_name: "Format A",
            display_order: 1
          }),
          createDbRow({
            id: 2,
            code: "FORMAT_B",
            display_name: "Format B",
            display_order: 2
          })
        ]
      });

      const result = await repository.findAll();

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        id: 1,
        code: "FORMAT_A",
        displayName: "Format A",
        description: "Homepage banner advertisement format",
        widthPx: 1200,
        heightPx: 300,
        isResponsive: true,
        isSystemFormat: true,
        status: "ACTIVE",
        displayOrder: 1,
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-02T10:00:00.000Z")
      });

      expect(result[1]?.id).toBe(2);
      expect(result[1]?.code).toBe("FORMAT_B");
    });

    it("should pass an empty parameter array when no status is supplied", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      await repository.findAll();

      const call = getLastQueryCall();

      expect(call[1]).toEqual([]);
    });

    it("should filter by ACTIVE status", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            id: 10,
            status: "ACTIVE"
          })
        ]
      });

      const result = await repository.findAll("ACTIVE");

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe("ACTIVE");

      const call = getLastQueryCall();

      expect(call[1]).toEqual(["ACTIVE"]);

      const sql = String(call[0]);

      expect(sql).toContain("WHERE status = $1");
    });

    it("should filter by INACTIVE status", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            id: 11,
            status: "INACTIVE"
          })
        ]
      });

      const result = await repository.findAll("INACTIVE");

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe("INACTIVE");

      const call = getLastQueryCall();

      expect(call[1]).toEqual(["INACTIVE"]);
    });

    it("should preserve database row order", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            id: 20,
            display_order: 1
          }),
          createDbRow({
            id: 10,
            display_order: 2
          })
        ]
      });

      const result = await repository.findAll();

      expect(result.map((format) => format.id)).toEqual([20, 10]);
    });

    it("should include display order ascending in the SQL", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      await repository.findAll();

      const call = getLastQueryCall();
      const sql = String(call[0]);

      expect(sql).toContain("ORDER BY");
      expect(sql).toContain("display_order ASC");
      expect(sql).toContain("id ASC");
    });

    it("should return an empty array when no formats exist", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it("should propagate database errors", async () => {
      queryMock.mockRejectedValue(new Error("database failure"));

      await expect(repository.findAll()).rejects.toThrow("database failure");
    });

    it("should use the supplied database client", async () => {
      const clientQuery = vi.fn<MockQueryFunction>();

      clientQuery.mockResolvedValue({
        rows: [createDbRow({ id: 88 })]
      });

      const client = {
        query: clientQuery
      };

      const result = await repository.findAll("ACTIVE", client as never);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(88);
      expect(clientQuery).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe("row mapping", () => {
    it("should preserve nullable description", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            description: null
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result?.description).toBeNull();
    });

    it("should preserve nullable width and height", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            width_px: null,
            height_px: null
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result?.widthPx).toBeNull();
      expect(result?.heightPx).toBeNull();
    });

    it("should preserve responsive and system format flags", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            is_responsive: false,
            is_system_format: false
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result?.isResponsive).toBe(false);
      expect(result?.isSystemFormat).toBe(false);
    });

    it("should map ACTIVE status", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            status: "ACTIVE"
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result?.status).toBe("ACTIVE");
    });

    it("should map INACTIVE status", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            status: "INACTIVE"
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result?.status).toBe("INACTIVE");
    });

    it("should convert string timestamps to Date objects", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            created_at: "2026-05-10T12:30:00.000Z",
            updated_at: "2026-05-11T13:30:00.000Z"
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result?.createdAt).toEqual(new Date("2026-05-10T12:30:00.000Z"));
      expect(result?.updatedAt).toEqual(new Date("2026-05-11T13:30:00.000Z"));
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it("should preserve Date timestamps as Date objects", async () => {
      const createdAt = new Date("2026-06-01T10:00:00.000Z");
      const updatedAt = new Date("2026-06-02T10:00:00.000Z");

      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            created_at: createdAt,
            updated_at: updatedAt
          })
        ]
      });

      const result = await repository.findById(101);

      expect(result?.createdAt).toBe(createdAt);
      expect(result?.updatedAt).toBe(updatedAt);
    });
  });

  describe("findActiveById", () => {
    it("should return an active format", async () => {
      queryMock.mockResolvedValue({
        rows: [
          createDbRow({
            id: 303,
            status: "ACTIVE"
          })
        ]
      });

      const result = await repository.findActiveById(303);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(303);
      expect(result?.status).toBe("ACTIVE");
    });

    it("should return null when no active format exists", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findActiveById(404);

      expect(result).toBeNull();
    });

    it("should pass the id as the first query parameter", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      await repository.findActiveById(404);

      const call = getLastQueryCall();

      expect(call[1]).toEqual([404]);
    });

    it("should include the ACTIVE status condition in SQL", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      await repository.findActiveById(404);

      const call = getLastQueryCall();
      const sql = String(call[0]);

      expect(sql).toContain("FROM advertisement_formats");
      expect(sql).toContain("WHERE id = $1");
      expect(sql).toContain("AND status = 'ACTIVE'");
      expect(sql).toContain("LIMIT 1");
    });

    it("should propagate database errors", async () => {
      queryMock.mockRejectedValue(new Error("active format lookup failed"));

      await expect(repository.findActiveById(404)).rejects.toThrow(
        "active format lookup failed"
      );
    });

    it("should use the supplied database client", async () => {
      const clientQuery = vi.fn<MockQueryFunction>();

      clientQuery.mockResolvedValue({
        rows: [
          createDbRow({
            id: 505,
            status: "ACTIVE"
          })
        ]
      });

      const client = {
        query: clientQuery
      };

      const result = await repository.findActiveById(505, client as never);

      expect(result?.id).toBe(505);
      expect(clientQuery).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe("SQL select columns", () => {
    it("should select all format fields required by the mapper", async () => {
      queryMock.mockResolvedValue({
        rows: []
      });

      await repository.findById(1);

      const call = getLastQueryCall();
      const sql = String(call[0]);

      expect(sql).toContain("id");
      expect(sql).toContain("code");
      expect(sql).toContain("display_name");
      expect(sql).toContain("description");
      expect(sql).toContain("width_px");
      expect(sql).toContain("height_px");
      expect(sql).toContain("is_responsive");
      expect(sql).toContain("is_system_format");
      expect(sql).toContain("status");
      expect(sql).toContain("display_order");
      expect(sql).toContain("created_at");
      expect(sql).toContain("updated_at");
    });
  });
});
