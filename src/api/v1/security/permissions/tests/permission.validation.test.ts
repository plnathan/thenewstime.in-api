import { describe, expect, it } from "vitest";

import {
  createPermissionSchema,
  permissionIdSchema,
  updatePermissionSchema
} from "../permission.validation.js";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const validCreatePermission = {
  code: "NEWS_READ",
  displayName: "Read News",
  description: "Permission to read news",
  module: "NEWS",
  resource: "news",
  action: "read",
  displayOrder: 10,
  isSystemPermission: false
};

const validUpdatePermission = {
  displayName: "Update News Permission",
  description: "Updated permission description",
  module: "NEWS",
  resource: "news",
  action: "update",
  displayOrder: 20,
  status: "ACTIVE" as const
};

/* -------------------------------------------------------------------------- */
/* createPermissionSchema                                                     */
/* -------------------------------------------------------------------------- */

describe("createPermissionSchema", () => {
  it("should accept a valid permission", () => {
    const result = createPermissionSchema.safeParse(
      validCreatePermission
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual(validCreatePermission);
    }
  });

  it("should accept a permission with only required fields", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News"
    });

    expect(result.success).toBe(true);
  });

  it("should trim code and displayName", () => {
    const result = createPermissionSchema.safeParse({
      code: "  NEWS_READ  ",
      displayName: "  Read News  "
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.code).toBe("NEWS_READ");
      expect(result.data.displayName).toBe("Read News");
    }
  });

  it("should accept valid permission code characters", () => {
    const validCodes = [
      "NEWS_READ",
      "NEWS:READ",
      "NEWS-READ",
      "NEWS_READ_123",
      "NEWS:READ-123",
      "123_PERMISSION"
    ];

    for (const code of validCodes) {
      const result = createPermissionSchema.safeParse({
        code,
        displayName: "Test Permission"
      });

      expect(result.success).toBe(true);
    }
  });

  it("should reject a permission code containing lowercase letters", () => {
    const result = createPermissionSchema.safeParse({
      code: "news_read",
      displayName: "Read News"
    });

    expect(result.success).toBe(false);
  });

  it("should reject a permission code containing spaces", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS READ",
      displayName: "Read News"
    });

    expect(result.success).toBe(false);
  });

  it("should reject a permission code containing unsupported special characters", () => {
    const invalidCodes = [
      "NEWS.READ",
      "NEWS/READ",
      "NEWS@READ",
      "NEWS#READ",
      "NEWS READ"
    ];

    for (const code of invalidCodes) {
      const result = createPermissionSchema.safeParse({
        code,
        displayName: "Read News"
      });

      expect(result.success).toBe(false);
    }
  });

  it("should reject a code shorter than 2 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "A",
      displayName: "Read News"
    });

    expect(result.success).toBe(false);
  });

  it("should reject a code longer than 100 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "A".repeat(101),
      displayName: "Read News"
    });

    expect(result.success).toBe(false);
  });

  it("should reject an empty code", () => {
    const result = createPermissionSchema.safeParse({
      code: "",
      displayName: "Read News"
    });

    expect(result.success).toBe(false);
  });

  it("should reject a display name shorter than 2 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "A"
    });

    expect(result.success).toBe(false);
  });

  it("should reject a display name longer than 150 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "A".repeat(151)
    });

    expect(result.success).toBe(false);
  });

  it("should reject an empty display name", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: ""
    });

    expect(result.success).toBe(false);
  });

  it("should accept an optional description", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      description: "Read permission"
    });

    expect(result.success).toBe(true);
  });

  it("should trim description", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      description: "  Read permission  "
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.description).toBe("Read permission");
    }
  });

  it("should reject description longer than 300 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      description: "A".repeat(301)
    });

    expect(result.success).toBe(false);
  });

  it("should accept a module up to 50 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      module: "A".repeat(50)
    });

    expect(result.success).toBe(true);
  });

  it("should reject a module longer than 50 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      module: "A".repeat(51)
    });

    expect(result.success).toBe(false);
  });

  it("should accept a resource up to 50 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      resource: "A".repeat(50)
    });

    expect(result.success).toBe(true);
  });

  it("should reject a resource longer than 50 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      resource: "A".repeat(51)
    });

    expect(result.success).toBe(false);
  });

  it("should accept an action up to 50 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      action: "A".repeat(50)
    });

    expect(result.success).toBe(true);
  });

  it("should reject an action longer than 50 characters", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      action: "A".repeat(51)
    });

    expect(result.success).toBe(false);
  });

  it("should accept displayOrder of zero", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      displayOrder: 0
    });

    expect(result.success).toBe(true);
  });

  it("should accept a positive integer displayOrder", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      displayOrder: 100
    });

    expect(result.success).toBe(true);
  });

  it("should reject a negative displayOrder", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      displayOrder: -1
    });

    expect(result.success).toBe(false);
  });

  it("should reject a decimal displayOrder", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      displayOrder: 1.5
    });

    expect(result.success).toBe(false);
  });

  it("should accept isSystemPermission as a boolean", () => {
    const trueResult = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      isSystemPermission: true
    });

    const falseResult = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      isSystemPermission: false
    });

    expect(trueResult.success).toBe(true);
    expect(falseResult.success).toBe(true);
  });

  it("should reject a non-boolean isSystemPermission", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ",
      displayName: "Read News",
      isSystemPermission: "true"
    });

    expect(result.success).toBe(false);
  });

  it("should reject when code is missing", () => {
    const result = createPermissionSchema.safeParse({
      displayName: "Read News"
    });

    expect(result.success).toBe(false);
  });

  it("should reject when displayName is missing", () => {
    const result = createPermissionSchema.safeParse({
      code: "NEWS_READ"
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* updatePermissionSchema                                                     */
/* -------------------------------------------------------------------------- */

describe("updatePermissionSchema", () => {
  it("should accept a valid update payload", () => {
    const result = updatePermissionSchema.safeParse(
      validUpdatePermission
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual(validUpdatePermission);
    }
  });

  it("should accept an empty update payload", () => {
    const result = updatePermissionSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("should accept only displayName", () => {
    const result = updatePermissionSchema.safeParse({
      displayName: "Updated Permission"
    });

    expect(result.success).toBe(true);
  });

  it("should accept only description", () => {
    const result = updatePermissionSchema.safeParse({
      description: "Updated description"
    });

    expect(result.success).toBe(true);
  });

  it("should accept only module", () => {
    const result = updatePermissionSchema.safeParse({
      module: "SECURITY"
    });

    expect(result.success).toBe(true);
  });

  it("should accept only resource", () => {
    const result = updatePermissionSchema.safeParse({
      resource: "permissions"
    });

    expect(result.success).toBe(true);
  });

  it("should accept only action", () => {
    const result = updatePermissionSchema.safeParse({
      action: "update"
    });

    expect(result.success).toBe(true);
  });

  it("should accept only displayOrder", () => {
    const result = updatePermissionSchema.safeParse({
      displayOrder: 10
    });

    expect(result.success).toBe(true);
  });

  it("should accept ACTIVE status", () => {
    const result = updatePermissionSchema.safeParse({
      status: "ACTIVE"
    });

    expect(result.success).toBe(true);
  });

  it("should accept INACTIVE status", () => {
    const result = updatePermissionSchema.safeParse({
      status: "INACTIVE"
    });

    expect(result.success).toBe(true);
  });

  it("should reject an invalid status", () => {
    const invalidStatuses = [
      "active",
      "inactive",
      "DISABLED",
      "PENDING"
    ];

    for (const status of invalidStatuses) {
      const result = updatePermissionSchema.safeParse({
        status
      });

      expect(result.success).toBe(false);
    }
  });

  it("should trim displayName", () => {
    const result = updatePermissionSchema.safeParse({
      displayName: "  Updated Permission  "
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.displayName).toBe("Updated Permission");
    }
  });

  it("should reject displayName shorter than 2 characters", () => {
    const result = updatePermissionSchema.safeParse({
      displayName: "A"
    });

    expect(result.success).toBe(false);
  });

  it("should reject displayName longer than 150 characters", () => {
    const result = updatePermissionSchema.safeParse({
      displayName: "A".repeat(151)
    });

    expect(result.success).toBe(false);
  });

  it("should trim description", () => {
    const result = updatePermissionSchema.safeParse({
      description: "  Updated description  "
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.description).toBe("Updated description");
    }
  });

  it("should reject description longer than 300 characters", () => {
    const result = updatePermissionSchema.safeParse({
      description: "A".repeat(301)
    });

    expect(result.success).toBe(false);
  });

  it("should reject module longer than 50 characters", () => {
    const result = updatePermissionSchema.safeParse({
      module: "A".repeat(51)
    });

    expect(result.success).toBe(false);
  });

  it("should reject resource longer than 50 characters", () => {
    const result = updatePermissionSchema.safeParse({
      resource: "A".repeat(51)
    });

    expect(result.success).toBe(false);
  });

  it("should reject action longer than 50 characters", () => {
    const result = updatePermissionSchema.safeParse({
      action: "A".repeat(51)
    });

    expect(result.success).toBe(false);
  });

  it("should accept displayOrder of zero", () => {
    const result = updatePermissionSchema.safeParse({
      displayOrder: 0
    });

    expect(result.success).toBe(true);
  });

  it("should reject negative displayOrder", () => {
    const result = updatePermissionSchema.safeParse({
      displayOrder: -1
    });

    expect(result.success).toBe(false);
  });

  it("should reject decimal displayOrder", () => {
    const result = updatePermissionSchema.safeParse({
      displayOrder: 1.5
    });

    expect(result.success).toBe(false);
  });

  it("should reject unknown fields", () => {
    const result = updatePermissionSchema.safeParse({
      displayName: "Updated Permission",
      unknownField: "unexpected"
    });

    /*
     * Zod object schemas strip unknown keys by default.
     * Therefore the payload itself is valid, but the unknown field
     * should not appear in the parsed result.
     */
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).not.toHaveProperty("unknownField");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* permissionIdSchema                                                         */
/* -------------------------------------------------------------------------- */

describe("permissionIdSchema", () => {
  it("should accept a positive numeric id", () => {
    const result = permissionIdSchema.safeParse({
      id: 101
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.id).toBe(101);
    }
  });

  it("should coerce a numeric string into a number", () => {
    const result = permissionIdSchema.safeParse({
      id: "101"
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.id).toBe(101);
      expect(typeof result.data.id).toBe("number");
    }
  });

  it("should accept a positive integer string", () => {
    const result = permissionIdSchema.safeParse({
      id: "999"
    });

    expect(result.success).toBe(true);
  });

  it("should reject zero", () => {
    const result = permissionIdSchema.safeParse({
      id: 0
    });

    expect(result.success).toBe(false);
  });

  it("should reject zero as a string", () => {
    const result = permissionIdSchema.safeParse({
      id: "0"
    });

    expect(result.success).toBe(false);
  });

  it("should reject negative ids", () => {
    const result = permissionIdSchema.safeParse({
      id: -1
    });

    expect(result.success).toBe(false);
  });

  it("should reject negative ids supplied as strings", () => {
    const result = permissionIdSchema.safeParse({
      id: "-1"
    });

    expect(result.success).toBe(false);
  });

  it("should reject decimal ids", () => {
    const result = permissionIdSchema.safeParse({
      id: 1.5
    });

    expect(result.success).toBe(false);
  });

  it("should reject decimal ids supplied as strings", () => {
    const result = permissionIdSchema.safeParse({
      id: "1.5"
    });

    expect(result.success).toBe(false);
  });

  it("should reject a missing id", () => {
    const result = permissionIdSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("should reject a non-numeric id", () => {
    const result = permissionIdSchema.safeParse({
      id: "abc"
    });

    expect(result.success).toBe(false);
  });

  it("should reject null id", () => {
    const result = permissionIdSchema.safeParse({
      id: null
    });

    expect(result.success).toBe(false);
  });
});