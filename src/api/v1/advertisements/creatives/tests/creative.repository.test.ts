import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PoolClient } from "pg";

import type {
  AdvertisementCreative,
  CreateAdvertisementCreativeInput,
  UpdateAdvertisementCreativeInput
} from "../creative.types.js";

const { queryMock, connectMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  connectMock: vi.fn()
}));

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: queryMock,
    connect: connectMock
  }
}));

import * as repository from "../creative.repository.js";

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

interface CreativeDbRow {
  id: number | string;
  advertisement_id: number | string;
  format_id: number | string | null;
  creative_type: "IMAGE" | "VIDEO" | "HTML";
  variant: "DESKTOP" | "MOBILE";
  title: string | null;
  alt_text: string | null;
  media_url: string;
  thumbnail_url: string | null;
  width_px: number | null;
  height_px: number | null;
  display_order: number;
  is_primary: boolean;
  status: "ACTIVE" | "INACTIVE";
  created_by: number | string | null;
  updated_by: number | string | null;
  created_at: Date;
  updated_at: Date;
}

interface AdvertisementDbRow {
  id: number;
  workflow_status: string;
  status: string;
}

interface FormatDbRow {
  id: number;
  width_px: number;
  height_px: number;
  mobile_width_px: number;
  mobile_height_px: number;
  status: string;
}

const mockClient: MockClient = {
  query: vi.fn(),
  release: vi.fn()
};

const baseCreativeRow: CreativeDbRow = {
  id: 101,
  advertisement_id: 10,
  format_id: 20,
  creative_type: "IMAGE",
  variant: "DESKTOP",
  title: "Test Creative",
  alt_text: "Test advertisement",
  media_url: "https://cdn.example.com/ad.jpg",
  thumbnail_url: "https://cdn.example.com/ad-thumb.jpg",
  width_px: 728,
  height_px: 90,
  display_order: 1,
  is_primary: true,
  status: "ACTIVE",
  created_by: 5,
  updated_by: 5,
  created_at: new Date("2026-09-27T10:00:00.000Z"),
  updated_at: new Date("2026-09-27T10:00:00.000Z")
};

const baseAdvertisementRow: AdvertisementDbRow = {
  id: 10,
  workflow_status: "DRAFT",
  status: "ACTIVE"
};

const baseFormatRow: FormatDbRow = {
  id: 20,
  width_px: 728,
  height_px: 90,
  mobile_width_px: 320,
  mobile_height_px: 100,
  status: "ACTIVE"
};

function createCreativeRow(
  overrides: Partial<CreativeDbRow> = {}
): CreativeDbRow {
  return {
    ...baseCreativeRow,
    ...overrides
  };
}

function createAdvertisementRow(
  overrides: Partial<AdvertisementDbRow> = {}
): AdvertisementDbRow {
  return {
    ...baseAdvertisementRow,
    ...overrides
  };
}

function createFormatRow(overrides: Partial<FormatDbRow> = {}): FormatDbRow {
  return {
    ...baseFormatRow,
    ...overrides
  };
}

function createCreative(
  overrides: Partial<AdvertisementCreative> = {}
): AdvertisementCreative {
  return {
    id: 101,
    advertisementId: 10,
    formatId: 20,
    creativeType: "IMAGE",
    variant: "DESKTOP",
    title: "Test Creative",
    altText: "Test advertisement",
    mediaUrl: "https://cdn.example.com/ad.jpg",
    thumbnailUrl: "https://cdn.example.com/ad-thumb.jpg",
    widthPx: 728,
    heightPx: 90,
    displayOrder: 1,
    isPrimary: true,
    status: "ACTIVE",
    createdBy: 5,
    updatedBy: 5,
    createdAt: new Date("2026-09-27T10:00:00.000Z"),
    updatedAt: new Date("2026-09-27T10:00:00.000Z"),
    ...overrides
  };
}

function createCreateInput(
  overrides: Partial<CreateAdvertisementCreativeInput> = {}
): CreateAdvertisementCreativeInput {
  return {
    formatId: 20,
    creativeType: "IMAGE",
    variant: "DESKTOP",
    title: "Test Creative",
    altText: "Test advertisement",
    mediaUrl: "https://cdn.example.com/ad.jpg",
    thumbnailUrl: "https://cdn.example.com/ad-thumb.jpg",
    widthPx: 728,
    heightPx: 90,
    displayOrder: 1,
    isPrimary: true,
    ...overrides
  };
}

function createUpdateInput(
  overrides: Partial<UpdateAdvertisementCreativeInput> = {}
): UpdateAdvertisementCreativeInput {
  return {
    title: "Updated Creative",
    altText: "Updated advertisement",
    mediaUrl: "https://cdn.example.com/updated.jpg",
    thumbnailUrl: "https://cdn.example.com/updated-thumb.jpg",
    widthPx: 728,
    heightPx: 90,
    ...overrides
  };
}

function setQueryResults(...results: unknown[]): void {
  queryMock.mockReset().mockImplementation(async () => ({
    rows: results.shift() ?? []
  }));
}

describe("Advertisement Creative Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    queryMock.mockReset();
    connectMock.mockReset();

    mockClient.query.mockReset();
    mockClient.release.mockReset();

    connectMock.mockResolvedValue(mockClient);
  });

  describe("findById", () => {
    it("should return a mapped creative when the record exists", async () => {
      setQueryResults([createCreativeRow()]);

      const result = await repository.findById(101);

      expect(result).toEqual(
        createCreative({
          id: 101,
          advertisementId: 10
        })
      );

      expect(queryMock).toHaveBeenCalledTimes(1);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("FROM advertisement_creatives");
      expect(sql).toContain("WHERE id = $1");
      expect(values).toEqual([101]);
    });

    it("should return null when the creative does not exist", async () => {
      setQueryResults([]);

      const result = await repository.findById(999);

      expect(result).toBeNull();
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("should use the supplied transaction client", async () => {
      mockClient.query.mockResolvedValue({
        rows: [createCreativeRow()]
      });

      const result = await repository.findById(
        101,
        mockClient as unknown as PoolClient
      );

      expect(result).not.toBeNull();
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe("findByAdvertisementId", () => {
    it("should return all creatives for an advertisement", async () => {
      setQueryResults([
        createCreativeRow({
          id: 101,
          variant: "DESKTOP",
          is_primary: true
        }),
        createCreativeRow({
          id: 102,
          variant: "MOBILE",
          is_primary: false,
          display_order: 2
        })
      ]);

      const result = await repository.findByAdvertisementId(10);

      expect(result).toHaveLength(2);

      expect(result[0]).toMatchObject({
        id: 101,
        advertisementId: 10,
        variant: "DESKTOP"
      });

      expect(result[1]).toMatchObject({
        id: 102,
        advertisementId: 10,
        variant: "MOBILE"
      });

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("FROM advertisement_creatives");
      expect(sql).toContain("WHERE advertisement_id = $1");
      expect(sql).toContain("variant ASC");
      expect(sql).toContain("is_primary DESC");
      expect(values).toEqual([10]);
    });

    it("should return an empty array when no creatives exist", async () => {
      setQueryResults([]);

      const result = await repository.findByAdvertisementId(10);

      expect(result).toEqual([]);
    });
  });

  describe("findActiveByAdvertisementId", () => {
    it("should return only active creatives", async () => {
      setQueryResults([
        createCreativeRow({
          id: 101,
          status: "ACTIVE"
        })
      ]);

      const result = await repository.findActiveByAdvertisementId(10);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe("ACTIVE");

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("FROM advertisement_creatives");
      expect(sql).toContain("WHERE advertisement_id = $1");
      expect(sql).toContain("status = 'ACTIVE'");
      expect(values).toEqual([10]);
    });

    it("should return an empty array when there are no active creatives", async () => {
      setQueryResults([]);

      const result = await repository.findActiveByAdvertisementId(10);

      expect(result).toEqual([]);
    });
  });

  describe("findAdvertisement", () => {
    it("should return advertisement workflow information", async () => {
      setQueryResults([createAdvertisementRow()]);

      const result = await repository.findAdvertisement(10);

      expect(result).toEqual({
        id: 10,
        workflowStatus: "DRAFT",
        status: "ACTIVE"
      });

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("FROM advertisements");
      expect(sql).toContain("WHERE id = $1");
      expect(values).toEqual([10]);
    });

    it("should return null when the advertisement does not exist", async () => {
      setQueryResults([]);

      const result = await repository.findAdvertisement(999);

      expect(result).toBeNull();
    });
  });

  describe("findFormat", () => {
    it("should return desktop and mobile dimensions", async () => {
      setQueryResults([createFormatRow()]);

      const result = await repository.findFormat(20);

      expect(result).toEqual({
        id: 20,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        status: "ACTIVE"
      });

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("FROM advertisement_formats");
      expect(sql).toContain("mobile_width_px");
      expect(sql).toContain("mobile_height_px");
      expect(values).toEqual([20]);
    });

    it("should return null when the format does not exist", async () => {
      setQueryResults([]);

      const result = await repository.findFormat(999);

      expect(result).toBeNull();
    });
  });

  describe("clearPrimaryForVariant", () => {
    it("should clear the primary flag for all creatives in the variant", async () => {
      mockClient.query.mockResolvedValue({
        rows: []
      });

      await repository.clearPrimaryForVariant(
        10,
        "DESKTOP",
        undefined,
        mockClient as unknown as PoolClient
      );

      expect(mockClient.query).toHaveBeenCalledTimes(1);

      const [sql, values] = mockClient.query.mock.calls[0] ?? [];

      expect(sql).toContain("UPDATE advertisement_creatives");
      expect(sql).toContain("is_primary = FALSE");
      expect(sql).toContain("advertisement_id = $1");
      expect(sql).toContain("variant = $2");
      expect(sql).toContain("is_primary = TRUE");
      expect(sql).not.toContain("id <> $3");
      expect(values).toEqual([10, "DESKTOP"]);
    });

    it("should exclude a specified creative when clearing primary status", async () => {
      mockClient.query.mockResolvedValue({
        rows: []
      });

      await repository.clearPrimaryForVariant(
        10,
        "MOBILE",
        102,
        mockClient as unknown as PoolClient
      );

      const [sql, values] = mockClient.query.mock.calls[0] ?? [];

      expect(sql).toContain("id <> $3");
      expect(values).toEqual([10, "MOBILE", 102]);
    });
  });

  describe("create", () => {
    it("should create and return a creative", async () => {
      const input = createCreateInput();

      setQueryResults([createCreativeRow()]);

      const result = await repository.create(10, input, 5);

      expect(result).toEqual(createCreative());

      expect(queryMock).toHaveBeenCalledTimes(1);

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("INSERT INTO advertisement_creatives");
      expect(sql).toContain("RETURNING");

      expect(values).toEqual([
        10,
        20,
        "IMAGE",
        "DESKTOP",
        "Test Creative",
        "Test advertisement",
        "https://cdn.example.com/ad.jpg",
        "https://cdn.example.com/ad-thumb.jpg",
        728,
        90,
        1,
        true,
        "ACTIVE",
        5
      ]);
    });

    it("should support a mobile creative", async () => {
      const input = createCreateInput({
        variant: "MOBILE",
        widthPx: 320,
        heightPx: 100,
        isPrimary: false
      });

      setQueryResults([
        createCreativeRow({
          variant: "MOBILE",
          width_px: 320,
          height_px: 100,
          is_primary: false
        })
      ]);

      const result = await repository.create(10, input, 5);

      expect(result.variant).toBe("MOBILE");
      expect(result.widthPx).toBe(320);
      expect(result.heightPx).toBe(100);
      expect(result.isPrimary).toBe(false);
    });

    it("should use a transaction client when supplied", async () => {
      mockClient.query.mockResolvedValue({
        rows: [createCreativeRow()]
      });

      const result = await repository.create(
        10,
        createCreateInput(),
        5,
        mockClient as unknown as PoolClient
      );

      expect(result.id).toBe(101);
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update and return the creative", async () => {
      const input = createUpdateInput();

      setQueryResults([
        createCreativeRow({
          title: "Updated Creative",
          alt_text: "Updated advertisement",
          media_url: "https://cdn.example.com/updated.jpg",
          thumbnail_url: "https://cdn.example.com/updated-thumb.jpg"
        })
      ]);

      const result = await repository.update(101, input, 7);

      expect(result).toMatchObject({
        id: 101,
        title: "Updated Creative",
        altText: "Updated advertisement",
        mediaUrl: "https://cdn.example.com/updated.jpg"
      });

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("UPDATE advertisement_creatives");
      expect(sql).toContain("WHERE id = $");
      expect(sql).toContain("RETURNING");

      expect(values).toContain(101);
      expect(values).toContain(7);
    });

    it("should update only supplied fields", async () => {
      setQueryResults([
        createCreativeRow({
          title: "Only Title Updated"
        })
      ]);

      const result = await repository.update(
        101,
        {
          title: "Only Title Updated"
        },
        7
      );

      expect(result?.title).toBe("Only Title Updated");

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("title =");
      expect(values).toContain("Only Title Updated");
      expect(values).toContain(101);
      expect(values).toContain(7);
    });

    it("should return null when the creative does not exist", async () => {
      setQueryResults([]);

      const result = await repository.update(
        999,
        {
          title: "Updated"
        },
        7
      );

      expect(result).toBeNull();
    });

    it("should use the supplied transaction client", async () => {
      mockClient.query.mockResolvedValue({
        rows: [createCreativeRow()]
      });

      const result = await repository.update(
        101,
        {
          title: "Updated"
        },
        7,
        mockClient as unknown as PoolClient
      );

      expect(result).not.toBeNull();
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should deactivate a creative", async () => {
      setQueryResults([
        createCreativeRow({
          status: "INACTIVE",
          updated_by: 7
        })
      ]);

      const result = await repository.remove(101, 7);

      expect(result).toMatchObject({
        id: 101,
        status: "INACTIVE",
        updatedBy: 7
      });

      const [sql, values] = queryMock.mock.calls[0] ?? [];

      expect(sql).toContain("UPDATE advertisement_creatives");
      expect(sql).toContain("status = 'INACTIVE'");
      expect(values).toContain(101);
      expect(values).toContain(7);
    });

    it("should return null when the creative does not exist", async () => {
      setQueryResults([]);

      const result = await repository.remove(999, 7);

      expect(result).toBeNull();
    });
  });

  describe("query mapping", () => {
    it("should convert numeric database identifiers to numbers", async () => {
      setQueryResults([
        createCreativeRow({
          id: "101",
          advertisement_id: "10",
          format_id: "20",
          created_by: "5",
          updated_by: "6"
        })
      ]);

      const result = await repository.findById(101);

      expect(result).toEqual(
        expect.objectContaining({
          id: 101,
          advertisementId: 10,
          formatId: 20,
          createdBy: 5,
          updatedBy: 6
        })
      );
    });

    it("should preserve null format and optional metadata values", async () => {
      setQueryResults([
        createCreativeRow({
          format_id: null,
          title: null,
          alt_text: null,
          thumbnail_url: null,
          width_px: null,
          height_px: null,
          created_by: null,
          updated_by: null
        })
      ]);

      const result = await repository.findById(101);

      expect(result).toEqual(
        expect.objectContaining({
          formatId: null,
          title: null,
          altText: null,
          thumbnailUrl: null,
          widthPx: null,
          heightPx: null,
          createdBy: null,
          updatedBy: null
        })
      );
    });
  });
});
