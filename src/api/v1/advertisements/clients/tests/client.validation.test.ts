import { describe, expect, it } from "vitest";

import {
  clientIdSchema,
  clientQuerySchema,
  createClientSchema,
  updateClientSchema
} from "../client.validation.js";

describe("Advertisement Client Validation", () => {
  describe("createClientSchema", () => {
    it("accepts a valid minimal client", () => {
      const result = createClientSchema.safeParse({
        clientCode: "TEST-CLIENT-001",
        name: "Test Client"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          clientCode: "TEST-CLIENT-001",
          name: "Test Client"
        });
      }
    });

    it("accepts a complete valid client", () => {
      const result = createClientSchema.safeParse({
        clientCode: "TEST-CLIENT-001",
        name: "Test Client",
        displayName: "Test Client Display",
        businessName: "Test Business",
        businessTypeId: "10",
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
        notes: "Test notes"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.businessTypeId).toBe(10);
      }
    });

    it("rejects a missing client code", () => {
      const result = createClientSchema.safeParse({
        name: "Test Client"
      });

      expect(result.success).toBe(false);
    });

    it("rejects a missing name", () => {
      const result = createClientSchema.safeParse({
        clientCode: "TEST-001"
      });

      expect(result.success).toBe(false);
    });

    it("rejects a client code shorter than two characters", () => {
      const result = createClientSchema.safeParse({
        clientCode: "A",
        name: "Test Client"
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid client code characters", () => {
      const result = createClientSchema.safeParse({
        clientCode: "TEST CLIENT!",
        name: "Test Client"
      });

      expect(result.success).toBe(false);
    });

    it("rejects an invalid email", () => {
      const result = createClientSchema.safeParse({
        clientCode: "TEST-001",
        name: "Test Client",
        email: "invalid-email"
      });

      expect(result.success).toBe(false);
    });

    it("rejects an invalid status", () => {
      const result = createClientSchema.safeParse({
        clientCode: "TEST-001",
        name: "Test Client",
        status: "PENDING"
      });

      expect(result.success).toBe(false);
    });

    it("rejects a non-positive business type id", () => {
      const result = createClientSchema.safeParse({
        clientCode: "TEST-001",
        name: "Test Client",
        businessTypeId: 0
      });

      expect(result.success).toBe(false);
    });

    it("trims string values", () => {
      const result = createClientSchema.safeParse({
        clientCode: "  TEST-001  ",
        name: "  Test Client  ",
        displayName: "  Display Name  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.clientCode).toBe("TEST-001");
        expect(result.data.name).toBe("Test Client");
        expect(result.data.displayName).toBe("Display Name");
      }
    });
  });

  describe("updateClientSchema", () => {
    it("accepts an empty update object", () => {
      const result = updateClientSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("accepts a partial update", () => {
      const result = updateClientSchema.safeParse({
        name: "Updated Client",
        status: "INACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("rejects an invalid update name", () => {
      const result = updateClientSchema.safeParse({
        name: "A"
      });

      expect(result.success).toBe(false);
    });

    it("rejects an invalid update email", () => {
      const result = updateClientSchema.safeParse({
        email: "invalid"
      });

      expect(result.success).toBe(false);
    });

    it("rejects an invalid update status", () => {
      const result = updateClientSchema.safeParse({
        status: "PENDING"
      });

      expect(result.success).toBe(false);
    });

    it("coerces business type id to number", () => {
      const result = updateClientSchema.safeParse({
        businessTypeId: "25"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.businessTypeId).toBe(25);
      }
    });
  });

  describe("clientIdSchema", () => {
    it("accepts a positive numeric id", () => {
      const result = clientIdSchema.safeParse({
        id: "101"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(101);
      }
    });

    it("rejects zero", () => {
      const result = clientIdSchema.safeParse({
        id: "0"
      });

      expect(result.success).toBe(false);
    });

    it("rejects a negative id", () => {
      const result = clientIdSchema.safeParse({
        id: "-1"
      });

      expect(result.success).toBe(false);
    });

    it("rejects a non-numeric id", () => {
      const result = clientIdSchema.safeParse({
        id: "abc"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("clientQuerySchema", () => {
    it("uses default page and pageSize", () => {
      const result = clientQuerySchema.parse({});

      expect(result).toEqual({
        page: 1,
        pageSize: 20
      });
    });

    it("accepts valid query parameters", () => {
      const result = clientQuerySchema.safeParse({
        page: "2",
        pageSize: "50",
        search: "test",
        status: "ACTIVE",
        businessTypeId: "10"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          page: 2,
          pageSize: 50,
          search: "test",
          status: "ACTIVE",
          businessTypeId: 10
        });
      }
    });

    it("rejects page size greater than 100", () => {
      const result = clientQuerySchema.safeParse({
        pageSize: "101"
      });

      expect(result.success).toBe(false);
    });

    it("rejects a non-positive page", () => {
      const result = clientQuerySchema.safeParse({
        page: "0"
      });

      expect(result.success).toBe(false);
    });

    it("rejects an invalid status", () => {
      const result = clientQuerySchema.safeParse({
        status: "PENDING"
      });

      expect(result.success).toBe(false);
    });
  });
});
