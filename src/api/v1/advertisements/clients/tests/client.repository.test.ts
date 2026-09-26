import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../client.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

const poolQueryMock = vi.mocked(pool.query);

const createdAt = new Date("2026-09-21T10:00:00.000Z");
const updatedAt = new Date("2026-09-21T11:00:00.000Z");

const clientRow = {
  id: 101,
  client_code: "TEST-CLIENT-001",
  name: "Test Client",
  display_name: "Test Client Display",
  business_name: "Test Business",

  business_type_id: 10,
  business_type_code: "RETAIL",
  business_type_display_name: "Retail",
  business_type_description: "Retail business",
  business_type_display_order: 1,
  business_type_status: "ACTIVE" as const,

  website: "https://example.com",

  primary_address: "Primary Address",
  communication_address: "Communication Address",

  contact_person: "Test Contact",
  contact_no: "9876543210",
  alternate_mobile: "9123456780",

  email: "test@example.com",
  alternate_email: "alternate@example.com",

  website_url: "https://example.com",

  status: "ACTIVE" as const,

  notes: "Test notes",

  ad_creation_hold: false,
  ad_creation_hold_type: null,
  ad_creation_hold_reason: null,
  ad_creation_hold_remarks: null,
  ad_creation_hold_at: null,
  ad_creation_hold_by: null,

  ad_creation_unhold_at: null,
  ad_creation_unhold_by: null,
  ad_creation_unhold_reason: null,

  created_by: 1,
  updated_by: 1,

  created_at: createdAt,
  updated_at: updatedAt
};

describe("Advertisement Client Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns mapped client when found", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [clientRow],
        rowCount: 1
      } as never);

      const result = await repository.findById(101);

      expect(result).toEqual({
        id: 101,
        clientCode: "TEST-CLIENT-001",
        name: "Test Client",
        displayName: "Test Client Display",
        businessName: "Test Business",

        businessTypeId: 10,
        businessType: {
          id: 10,
          code: "RETAIL",
          displayName: "Retail",
          description: "Retail business",
          displayOrder: 1,
          status: "ACTIVE"
        },

        website: "https://example.com",

        primaryAddress: "Primary Address",
        communicationAddress: "Communication Address",

        contactPerson: "Test Contact",
        contactNo: "9876543210",
        alternateMobile: "9123456780",

        email: "test@example.com",
        alternateEmail: "alternate@example.com",

        websiteUrl: "https://example.com",

        status: "ACTIVE",

        notes: "Test notes",

        adCreationHold: false,
        adCreationHoldType: null,
        adCreationHoldReason: null,
        adCreationHoldRemarks: null,
        adCreationHoldAt: null,
        adCreationHoldBy: null,

        adCreationUnholdAt: null,
        adCreationUnholdBy: null,
        adCreationUnholdReason: null,

        createdBy: 1,
        updatedBy: 1,

        createdAt,
        updatedAt
      });

      expect(poolQueryMock).toHaveBeenCalledTimes(1);
      expect(poolQueryMock.mock.calls[0]?.[1]).toEqual([101]);
    });

    it("returns null when client does not exist", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it("uses the supplied transaction client", async () => {
      const transactionQuery = vi.fn().mockResolvedValueOnce({
        rows: [clientRow],
        rowCount: 1
      });

      const transactionClient = {
        query: transactionQuery
      } as unknown as PoolClient;

      const result = await repository.findById(101, transactionClient);

      expect(result?.id).toBe(101);
      expect(transactionQuery).toHaveBeenCalledTimes(1);
      expect(poolQueryMock).not.toHaveBeenCalled();
    });
  });

  describe("findByClientCode", () => {
    it("finds a client by case-insensitive client code", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [clientRow],
        rowCount: 1
      } as never);

      const result = await repository.findByClientCode("test-client-001");

      expect(result?.clientCode).toBe("TEST-CLIENT-001");

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining("LOWER(c.client_code) = LOWER($1)"),
        ["test-client-001"]
      );
    });

    it("returns null when client code does not exist", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await repository.findByClientCode("UNKNOWN");

      expect(result).toBeNull();
    });
  });

  describe("businessTypeExists", () => {
    it("returns true for an active business type", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [{ exists: true }],
        rowCount: 1
      } as never);

      const result = await repository.businessTypeExists(10);

      expect(result).toBe(true);
      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining("status = 'ACTIVE'"),
        [10]
      );
    });

    it("returns false when business type does not exist", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [{ exists: false }],
        rowCount: 1
      } as never);

      const result = await repository.businessTypeExists(999);

      expect(result).toBe(false);
    });

    it("returns false when the query has no row", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await repository.businessTypeExists(999);

      expect(result).toBe(false);
    });
  });

  describe("create", () => {
    it("creates a client and loads the created record", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [{ id: 102 }],
          rowCount: 1
        } as never)
        .mockResolvedValueOnce({
          rows: [
            {
              ...clientRow,
              id: 102,
              client_code: "NEW-CLIENT",
              name: "New Client"
            }
          ],
          rowCount: 1
        } as never);

      const result = await repository.create(
        {
          clientCode: " NEW-CLIENT ",
          name: " New Client ",
          displayName: " Display Name ",
          businessName: " Business Name ",
          businessTypeId: 10,
          website: " https://example.com ",
          primaryAddress: " Primary Address ",
          communicationAddress: " Communication Address ",
          contactPerson: " Contact ",
          contactNo: " 9876543210 ",
          alternateMobile: " 9123456780 ",
          email: " test@example.com ",
          alternateEmail: " alternate@example.com ",
          websiteUrl: " https://example.com ",
          status: "ACTIVE",
          notes: " Notes "
        },
        5
      );

      expect(result.id).toBe(102);

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO advertisement_clients"),
        [
          "NEW-CLIENT",
          "New Client",
          "Display Name",
          "Business Name",
          10,
          "https://example.com",
          "Primary Address",
          "Communication Address",
          "Contact",
          "9876543210",
          "9123456780",
          "test@example.com",
          "alternate@example.com",
          "https://example.com",
          "ACTIVE",
          "Notes",
          5
        ]
      );

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("SELECT"),
        [102]
      );
    });

    it("uses ACTIVE as the default status", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [{ id: 103 }],
          rowCount: 1
        } as never)
        .mockResolvedValueOnce({
          rows: [
            {
              ...clientRow,
              id: 103
            }
          ],
          rowCount: 1
        } as never);

      await repository.create(
        {
          clientCode: "CLIENT-103",
          name: "Client 103"
        },
        5
      );

      expect(poolQueryMock.mock.calls[0]?.[1]).toEqual([
        "CLIENT-103",
        "Client 103",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        "ACTIVE",
        null,
        5
      ]);
    });

    it("throws when INSERT does not return an id", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      await expect(
        repository.create(
          {
            clientCode: "CLIENT-104",
            name: "Client 104"
          },
          5
        )
      ).rejects.toThrow(
        "Advertisement client was created but its ID was not returned."
      );
    });

    it("throws when the created client cannot be loaded", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [{ id: 105 }],
          rowCount: 1
        } as never)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        } as never);

      await expect(
        repository.create(
          {
            clientCode: "CLIENT-105",
            name: "Client 105"
          },
          5
        )
      ).rejects.toThrow(
        "Advertisement client was created but could not be loaded."
      );
    });
  });

  describe("update", () => {
    it("updates supplied fields and returns the updated client", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [{ id: 101 }],
          rowCount: 1
        } as never)
        .mockResolvedValueOnce({
          rows: [
            {
              ...clientRow,
              name: "Updated Client"
            }
          ],
          rowCount: 1
        } as never);

      const result = await repository.update(
        101,
        {
          name: " Updated Client ",
          displayName: " Updated Display ",
          status: "INACTIVE"
        },
        7
      );

      expect(result?.name).toBe("Updated Client");
      expect(poolQueryMock).toHaveBeenCalledTimes(2);

      const updateCall = poolQueryMock.mock.calls[0];

      expect(updateCall?.[0]).toEqual(
        expect.stringContaining("UPDATE advertisement_clients")
      );

      expect(updateCall?.[1]).toEqual([
        "Updated Client",
        "Updated Display",
        "INACTIVE",
        7,
        101
      ]);
    });

    it("returns existing client when there are no fields to update", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [clientRow],
        rowCount: 1
      } as never);

      const result = await repository.update(101, {}, 7);

      expect(result?.id).toBe(101);
      expect(poolQueryMock).toHaveBeenCalledTimes(1);
      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining("WHERE c.id = $1"),
        [101]
      );
    });

    it("returns null when the update affects no record", async () => {
      poolQueryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await repository.update(
        999,
        {
          name: "Updated"
        },
        7
      );

      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("returns paginated clients and total count", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [{ count: "2" }],
          rowCount: 1
        } as never)
        .mockResolvedValueOnce({
          rows: [clientRow, { ...clientRow, id: 102 }],
          rowCount: 2
        } as never);

      const result = await repository.list({
        page: 2,
        pageSize: 10
      });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe(101);
      expect(result.items[1]?.id).toBe(102);

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("LIMIT $1"),
        [10, 10]
      );
    });

    it("applies search, status and business type filters", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [{ count: "1" }],
          rowCount: 1
        } as never)
        .mockResolvedValueOnce({
          rows: [clientRow],
          rowCount: 1
        } as never);

      const result = await repository.list({
        page: 1,
        pageSize: 20,
        search: "test",
        status: "ACTIVE",
        businessTypeId: 10
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);

      const countQuery = poolQueryMock.mock.calls[0];

      expect(countQuery?.[0]).toContain("ILIKE");
      expect(countQuery?.[0]).toContain("c.status = $2");
      expect(countQuery?.[0]).toContain("c.business_type_id = $3");
      expect(countQuery?.[1]).toEqual(["test", "ACTIVE", 10]);
    });

    it("returns an empty result when no clients are found", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [{ count: "0" }],
          rowCount: 1
        } as never)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        } as never);

      const result = await repository.list({
        page: 1,
        pageSize: 20
      });

      expect(result).toEqual({
        items: [],
        total: 0
      });
    });
  });
});
