import { describe, expect, it } from "vitest";

import {
  createUserSchema,
  updateUserSchema,
  userIdSchema
} from "../user.validation.js";

describe("User Validation", () => {
  // ===========================================================================
  // Fixtures
  // ===========================================================================

  const validCreateInput = {
    fullName: "Test User",
    displayName: "Test",
    username: "test.user_01",
    email: "test@example.com",
    mobile: "9876543210",
    password: "password123",
    roleId: 2,
    profileImageUrl: "https://example.com/profile.jpg",
    mustChangePassword: true,
    passwordExpiresAt: "2026-12-31T23:59:59.000Z"
  };

  // ===========================================================================
  // createUserSchema
  // ===========================================================================

  describe("createUserSchema", () => {
    it("should accept a valid create-user payload", () => {
      const result = createUserSchema.safeParse(validCreateInput);

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual(validCreateInput);
      }
    });

    it("should trim fullName, displayName and username", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        fullName: "  Test User  ",
        displayName: "  Test User  ",
        username: "  test.user  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.fullName).toBe("Test User");

        expect(result.data.displayName).toBe("Test User");

        expect(result.data.username).toBe("test.user");
      }
    });

    it("should reject fullName shorter than 2 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        fullName: "A"
      });

      expect(result.success).toBe(false);
    });

    it("should reject fullName longer than 200 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        fullName: "A".repeat(201)
      });

      expect(result.success).toBe(false);
    });

    it("should reject displayName shorter than 2 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        displayName: "A"
      });

      expect(result.success).toBe(false);
    });

    it("should reject displayName longer than 200 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        displayName: "A".repeat(201)
      });

      expect(result.success).toBe(false);
    });

    it("should accept valid usernames", () => {
      const usernames = [
        "abc",
        "user123",
        "user.name",
        "user_name",
        "user-name",
        "User.Name_123-Test"
      ];

      for (const username of usernames) {
        const result = createUserSchema.safeParse({
          ...validCreateInput,
          username
        });

        expect(result.success).toBe(true);
      }
    });

    it("should reject username shorter than 3 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        username: "ab"
      });

      expect(result.success).toBe(false);
    });

    it("should reject username longer than 100 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        username: "a".repeat(101)
      });

      expect(result.success).toBe(false);
    });

    it("should reject usernames containing unsupported characters", () => {
      const invalidUsernames = [
        "user name",
        "user@name",
        "user#name",
        "user/name",
        "user\\name",
        "user+name"
      ];

      for (const username of invalidUsernames) {
        const result = createUserSchema.safeParse({
          ...validCreateInput,
          username
        });

        expect(result.success).toBe(false);
      }
    });

    it("should reject invalid email addresses", () => {
      const invalidEmails = [
        "invalid",
        "invalid@",
        "@example.com",
        "user@example",
        "user example@example.com"
      ];

      for (const email of invalidEmails) {
        const result = createUserSchema.safeParse({
          ...validCreateInput,
          email
        });

        expect(result.success).toBe(false);
      }
    });

    it("should reject email longer than 200 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        email: `${"a".repeat(190)}@example.com`
      });

      expect(result.success).toBe(false);
    });

    it("should accept a valid mobile number", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        mobile: "9876543210"
      });

      expect(result.success).toBe(true);
    });

    it("should reject mobile shorter than 7 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        mobile: "123456"
      });

      expect(result.success).toBe(false);
    });

    it("should reject mobile longer than 20 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        mobile: "1".repeat(21)
      });

      expect(result.success).toBe(false);
    });

    it("should reject password shorter than 8 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        password: "1234567"
      });

      expect(result.success).toBe(false);
    });

    it("should reject password longer than 100 characters", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        password: "a".repeat(101)
      });

      expect(result.success).toBe(false);
    });

    it("should accept password at the minimum and maximum lengths", () => {
      const minimum = createUserSchema.safeParse({
        ...validCreateInput,
        password: "a".repeat(8)
      });

      const maximum = createUserSchema.safeParse({
        ...validCreateInput,
        password: "a".repeat(100)
      });

      expect(minimum.success).toBe(true);
      expect(maximum.success).toBe(true);
    });

    it("should coerce roleId from a numeric string", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        roleId: "5"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.roleId).toBe(5);
        expect(typeof result.data.roleId).toBe("number");
      }
    });

    it("should reject zero or negative roleId", () => {
      const zero = createUserSchema.safeParse({
        ...validCreateInput,
        roleId: 0
      });

      const negative = createUserSchema.safeParse({
        ...validCreateInput,
        roleId: -1
      });

      expect(zero.success).toBe(false);
      expect(negative.success).toBe(false);
    });

    it("should reject non-integer roleId", () => {
      const result = createUserSchema.safeParse({
        ...validCreateInput,
        roleId: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should validate profileImageUrl as a URL", () => {
      const valid = createUserSchema.safeParse({
        ...validCreateInput,
        profileImageUrl: "https://cdn.example.com/profile.jpg"
      });

      const invalid = createUserSchema.safeParse({
        ...validCreateInput,
        profileImageUrl: "not-a-url"
      });

      expect(valid.success).toBe(true);
      expect(invalid.success).toBe(false);
    });

    it("should validate passwordExpiresAt as an ISO datetime", () => {
      const valid = createUserSchema.safeParse({
        ...validCreateInput,
        passwordExpiresAt: "2026-12-31T23:59:59.000Z"
      });

      const invalid = createUserSchema.safeParse({
        ...validCreateInput,
        passwordExpiresAt: "31-12-2026"
      });

      expect(valid.success).toBe(true);
      expect(invalid.success).toBe(false);
    });

    it("should allow optional create-user fields to be omitted", () => {
      const result = createUserSchema.safeParse({
        fullName: "Test User",
        displayName: "Test User",
        username: "testuser",
        password: "password123",
        roleId: 2
      });

      expect(result.success).toBe(true);
    });

    it("should reject missing required create-user fields", () => {
      const result = createUserSchema.safeParse({});

      expect(result.success).toBe(false);

      if (!result.success) {
        const fields = result.error.issues.map((issue) => issue.path[0]);

        expect(fields).toContain("fullName");
        expect(fields).toContain("displayName");
        expect(fields).toContain("username");
        expect(fields).toContain("password");
        expect(fields).toContain("roleId");
      }
    });
  });

  // ===========================================================================
  // updateUserSchema
  // ===========================================================================

  describe("updateUserSchema", () => {
    it("should accept a valid update payload", () => {
      const result = updateUserSchema.safeParse({
        fullName: "Updated User",
        displayName: "Updated",
        email: "updated@example.com",
        mobile: "9876543211",
        profileImageUrl: "https://example.com/updated.jpg",
        status: "ACTIVE",
        mustChangePassword: false,
        password: "newpassword123",
        passwordExpiresAt: "2027-12-31T23:59:59.000Z"
      });

      expect(result.success).toBe(true);
    });

    it("should allow an empty update payload", () => {
      const result = updateUserSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should validate allowed user statuses", () => {
      const statuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"];

      for (const status of statuses) {
        const result = updateUserSchema.safeParse({
          status
        });

        expect(result.success).toBe(true);
      }
    });

    it("should reject unsupported user statuses", () => {
      const statuses = ["DISABLED", "DELETED", "PENDING", "ACTIVE_USER"];

      for (const status of statuses) {
        const result = updateUserSchema.safeParse({
          status
        });

        expect(result.success).toBe(false);
      }
    });

    it("should validate optional update password", () => {
      const valid = updateUserSchema.safeParse({
        password: "password123"
      });

      const invalid = updateUserSchema.safeParse({
        password: "short"
      });

      expect(valid.success).toBe(true);
      expect(invalid.success).toBe(false);
    });

    it("should validate update email and mobile", () => {
      const valid = updateUserSchema.safeParse({
        email: "updated@example.com",
        mobile: "9876543210"
      });

      const invalid = updateUserSchema.safeParse({
        email: "invalid-email",
        mobile: "123"
      });

      expect(valid.success).toBe(true);
      expect(invalid.success).toBe(false);
    });

    it("should reject invalid profileImageUrl during update", () => {
      const result = updateUserSchema.safeParse({
        profileImageUrl: "invalid-url"
      });

      expect(result.success).toBe(false);
    });

    it("should reject invalid passwordExpiresAt during update", () => {
      const result = updateUserSchema.safeParse({
        passwordExpiresAt: "2026-12-31"
      });

      expect(result.success).toBe(false);
    });

    it("should validate boolean mustChangePassword", () => {
      const valid = updateUserSchema.safeParse({
        mustChangePassword: false
      });

      const invalid = updateUserSchema.safeParse({
        mustChangePassword: "false"
      });

      expect(valid.success).toBe(true);
      expect(invalid.success).toBe(false);
    });
  });

  // ===========================================================================
  // userIdSchema
  // ===========================================================================

  describe("userIdSchema", () => {
    it("should accept a positive integer id", () => {
      const result = userIdSchema.safeParse({
        id: 101
      });

      expect(result.success).toBe(true);
    });

    it("should coerce a numeric string id to a number", () => {
      const result = userIdSchema.safeParse({
        id: "101"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(101);
        expect(typeof result.data.id).toBe("number");
      }
    });

    it("should reject zero, negative and decimal ids", () => {
      const zero = userIdSchema.safeParse({
        id: 0
      });

      const negative = userIdSchema.safeParse({
        id: -10
      });

      const decimal = userIdSchema.safeParse({
        id: 10.5
      });

      expect(zero.success).toBe(false);
      expect(negative.success).toBe(false);
      expect(decimal.success).toBe(false);
    });

    it("should reject missing id", () => {
      const result = userIdSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric id", () => {
      const result = userIdSchema.safeParse({
        id: "abc"
      });

      expect(result.success).toBe(false);
    });
  });
});
