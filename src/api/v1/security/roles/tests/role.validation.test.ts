import { describe, expect, it } from "vitest";

import {
  assignRoleSchema,
  createRoleSchema,
  roleIdSchema,
  updateRoleSchema,
  userIdParamSchema,
  userRoleParamSchema
} from "../role.validation.js";

describe("Role Validation", () => {
  // ---------------------------------------------------------------------------
  // createRoleSchema
  // ---------------------------------------------------------------------------

  describe("createRoleSchema", () => {
    it("should accept a valid role", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor",
        description: "Content editor role",
        displayOrder: 10
      });

      expect(result.success).toBe(true);
    });

    it("should accept a valid role without optional fields", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor"
      });

      expect(result.success).toBe(true);
    });

    it("should trim code and display name", () => {
      const result = createRoleSchema.safeParse({
        code: " EDITOR ",
        displayName: " Editor "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.code).toBe("EDITOR");
        expect(result.data.displayName).toBe("Editor");
      }
    });

    it("should reject code shorter than 2 characters", () => {
      const result = createRoleSchema.safeParse({
        code: "A",
        displayName: "Editor"
      });

      expect(result.success).toBe(false);
    });

    it("should reject code longer than 30 characters", () => {
      const result = createRoleSchema.safeParse({
        code: "A".repeat(31),
        displayName: "Editor"
      });

      expect(result.success).toBe(false);
    });

    it("should accept uppercase letters in role code", () => {
      const result = createRoleSchema.safeParse({
        code: "CONTENT_EDITOR",
        displayName: "Content Editor"
      });

      expect(result.success).toBe(true);
    });

    it("should accept numbers and underscores in role code", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR_123",
        displayName: "Editor 123"
      });

      expect(result.success).toBe(true);
    });

    it("should reject lowercase letters in role code", () => {
      const result = createRoleSchema.safeParse({
        code: "editor",
        displayName: "Editor"
      });

      expect(result.success).toBe(false);
    });

    it("should reject spaces in role code", () => {
      const result = createRoleSchema.safeParse({
        code: "CONTENT EDITOR",
        displayName: "Content Editor"
      });

      expect(result.success).toBe(false);
    });

    it("should reject hyphens in role code", () => {
      const result = createRoleSchema.safeParse({
        code: "CONTENT-EDITOR",
        displayName: "Content Editor"
      });

      expect(result.success).toBe(false);
    });

    it("should reject special characters in role code", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR@123",
        displayName: "Editor"
      });

      expect(result.success).toBe(false);
    });

    it("should reject empty display name", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: ""
      });

      expect(result.success).toBe(false);
    });

    it("should reject display name shorter than 2 characters", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "E"
      });

      expect(result.success).toBe(false);
    });

    it("should reject display name longer than 100 characters", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "E".repeat(101)
      });

      expect(result.success).toBe(false);
    });

    it("should accept description up to 300 characters", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor",
        description: "D".repeat(300)
      });

      expect(result.success).toBe(true);
    });

    it("should reject description longer than 300 characters", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor",
        description: "D".repeat(301)
      });

      expect(result.success).toBe(false);
    });

    it("should trim description", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor",
        description: "  Content editor role  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.description).toBe("Content editor role");
      }
    });

    it("should accept displayOrder of zero", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor",
        displayOrder: 0
      });

      expect(result.success).toBe(true);
    });

    it("should accept a positive integer displayOrder", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor",
        displayOrder: 100
      });

      expect(result.success).toBe(true);
    });

    it("should reject negative displayOrder", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor",
        displayOrder: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal displayOrder", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor",
        displayOrder: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-number displayOrder", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR",
        displayName: "Editor",
        displayOrder: "10"
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing code", () => {
      const result = createRoleSchema.safeParse({
        displayName: "Editor"
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing displayName", () => {
      const result = createRoleSchema.safeParse({
        code: "EDITOR"
      });

      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // updateRoleSchema
  // ---------------------------------------------------------------------------

  describe("updateRoleSchema", () => {
    it("should accept a valid displayName update", () => {
      const result = updateRoleSchema.safeParse({
        displayName: "Senior Editor"
      });

      expect(result.success).toBe(true);
    });

    it("should accept a valid description update", () => {
      const result = updateRoleSchema.safeParse({
        description: "Updated role description"
      });

      expect(result.success).toBe(true);
    });

    it("should accept a valid displayOrder update", () => {
      const result = updateRoleSchema.safeParse({
        displayOrder: 20
      });

      expect(result.success).toBe(true);
    });

    it("should accept ACTIVE status", () => {
      const result = updateRoleSchema.safeParse({
        status: "ACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should accept INACTIVE status", () => {
      const result = updateRoleSchema.safeParse({
        status: "INACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should accept SUSPENDED status", () => {
      const result = updateRoleSchema.safeParse({
        status: "SUSPENDED"
      });

      expect(result.success).toBe(true);
    });

    it("should accept multiple update fields", () => {
      const result = updateRoleSchema.safeParse({
        displayName: "Senior Editor",
        description: "Updated description",
        displayOrder: 5,
        status: "ACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should accept an empty update object", () => {
      const result = updateRoleSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should trim displayName", () => {
      const result = updateRoleSchema.safeParse({
        displayName: "  Senior Editor  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.displayName).toBe("Senior Editor");
      }
    });

    it("should reject displayName shorter than 2 characters", () => {
      const result = updateRoleSchema.safeParse({
        displayName: "E"
      });

      expect(result.success).toBe(false);
    });

    it("should reject displayName longer than 100 characters", () => {
      const result = updateRoleSchema.safeParse({
        displayName: "E".repeat(101)
      });

      expect(result.success).toBe(false);
    });

    it("should reject description longer than 300 characters", () => {
      const result = updateRoleSchema.safeParse({
        description: "D".repeat(301)
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative displayOrder", () => {
      const result = updateRoleSchema.safeParse({
        displayOrder: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal displayOrder", () => {
      const result = updateRoleSchema.safeParse({
        displayOrder: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject invalid status", () => {
      const result = updateRoleSchema.safeParse({
        status: "DELETED"
      });

      expect(result.success).toBe(false);
    });

    it("should reject lowercase status", () => {
      const result = updateRoleSchema.safeParse({
        status: "active"
      });

      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // roleIdSchema
  // ---------------------------------------------------------------------------

  describe("roleIdSchema", () => {
    it("should accept a positive numeric ID", () => {
      const result = roleIdSchema.safeParse({
        id: 10
      });

      expect(result.success).toBe(true);
    });

    it("should coerce a numeric string to a number", () => {
      const result = roleIdSchema.safeParse({
        id: "10"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(10);
        expect(typeof result.data.id).toBe("number");
      }
    });

    it("should reject zero", () => {
      const result = roleIdSchema.safeParse({
        id: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative ID", () => {
      const result = roleIdSchema.safeParse({
        id: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal ID", () => {
      const result = roleIdSchema.safeParse({
        id: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric ID", () => {
      const result = roleIdSchema.safeParse({
        id: "abc"
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing ID", () => {
      const result = roleIdSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // userIdParamSchema
  // ---------------------------------------------------------------------------

  describe("userIdParamSchema", () => {
    it("should accept a positive numeric user ID", () => {
      const result = userIdParamSchema.safeParse({
        userId: 10
      });

      expect(result.success).toBe(true);
    });

    it("should coerce a numeric string to a number", () => {
      const result = userIdParamSchema.safeParse({
        userId: "10"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.userId).toBe(10);
      }
    });

    it("should reject zero", () => {
      const result = userIdParamSchema.safeParse({
        userId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative user ID", () => {
      const result = userIdParamSchema.safeParse({
        userId: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal user ID", () => {
      const result = userIdParamSchema.safeParse({
        userId: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric user ID", () => {
      const result = userIdParamSchema.safeParse({
        userId: "abc"
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing user ID", () => {
      const result = userIdParamSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // assignRoleSchema
  // ---------------------------------------------------------------------------

  describe("assignRoleSchema", () => {
    it("should accept a positive numeric user ID", () => {
      const result = assignRoleSchema.safeParse({
        userId: 10
      });

      expect(result.success).toBe(true);
    });

    it("should coerce a numeric string to a number", () => {
      const result = assignRoleSchema.safeParse({
        userId: "10"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.userId).toBe(10);
      }
    });

    it("should reject zero user ID", () => {
      const result = assignRoleSchema.safeParse({
        userId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative user ID", () => {
      const result = assignRoleSchema.safeParse({
        userId: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal user ID", () => {
      const result = assignRoleSchema.safeParse({
        userId: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric user ID", () => {
      const result = assignRoleSchema.safeParse({
        userId: "abc"
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing user ID", () => {
      const result = assignRoleSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // userRoleParamSchema
  // ---------------------------------------------------------------------------

  describe("userRoleParamSchema", () => {
    it("should accept valid user and role IDs", () => {
      const result = userRoleParamSchema.safeParse({
        userId: 10,
        roleId: 20
      });

      expect(result.success).toBe(true);
    });

    it("should coerce numeric strings to numbers", () => {
      const result = userRoleParamSchema.safeParse({
        userId: "10",
        roleId: "20"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.userId).toBe(10);
        expect(result.data.roleId).toBe(20);
      }
    });

    it("should reject zero user ID", () => {
      const result = userRoleParamSchema.safeParse({
        userId: 0,
        roleId: 20
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero role ID", () => {
      const result = userRoleParamSchema.safeParse({
        userId: 10,
        roleId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative user ID", () => {
      const result = userRoleParamSchema.safeParse({
        userId: -1,
        roleId: 20
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative role ID", () => {
      const result = userRoleParamSchema.safeParse({
        userId: 10,
        roleId: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal user ID", () => {
      const result = userRoleParamSchema.safeParse({
        userId: 1.5,
        roleId: 20
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal role ID", () => {
      const result = userRoleParamSchema.safeParse({
        userId: 10,
        roleId: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric user ID", () => {
      const result = userRoleParamSchema.safeParse({
        userId: "abc",
        roleId: 20
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric role ID", () => {
      const result = userRoleParamSchema.safeParse({
        userId: 10,
        roleId: "abc"
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing user ID", () => {
      const result = userRoleParamSchema.safeParse({
        roleId: 20
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing role ID", () => {
      const result = userRoleParamSchema.safeParse({
        userId: 10
      });

      expect(result.success).toBe(false);
    });
  });
});
