import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../placement.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

describe("Advertisement Placement Repository", () => {
  const mockedPool = vi.mocked(pool);

  const dbRow = {
    id: "1",
    code: "HOME_TOP",
    display_name: "Homepage Top",
    description: "Homepage top advertisement",
    page_type: "HOME",
    placement_type: "HOME_TOP",
    insertion_type: "FIXED",
    display_order: 1,
    is_enabled: true,
    collapse_when_empty: true,
    fallback_behavior: "HIDE",
    display_frequency: "EVERY_VISIT",
    frequency_value: null,
    auto_close_enabled: false,
    auto_close_seconds: null,
    close_button_enabled: true,
    close_on_overlay_click: true,
    status: "ACTIVE",
    created_by: "10",
    updated_by: "10",
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all placements ordered by page type, display order and id", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [dbRow],
        rowCount: 1
      } as never);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        code: "HOME_TOP",
        displayName: "Homepage Top",
        pageType: "HOME",
        placementType: "HOME_TOP",
        displayOrder: 1,
        createdBy: 10,
        updatedBy: 10
      });

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      const call = mockedPool.query.mock.calls[0];

      expect(call).toBeDefined();

      if (!call) {
        return;
      }

      const [sql] = call;

      expect(String(sql)).toContain("FROM advertisement_placements");
      expect(String(sql)).toContain(
        "ORDER BY page_type ASC, display_order ASC, id ASC"
      );
    });

    it("should use the supplied client when provided", async () => {
      const client = {
        query: vi.fn().mockResolvedValue({
          rows: [dbRow],
          rowCount: 1
        })
      } as unknown as PoolClient;

      await repository.findAll(client);

      expect(client.query).toHaveBeenCalledTimes(1);
      expect(mockedPool.query).not.toHaveBeenCalled();
    });

    it("should map HOUSE_AD fallback behavior correctly", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [
          {
            ...dbRow,
            fallback_behavior: "HOUSE_AD"
          }
        ],
        rowCount: 1
      } as never);

      const result = await repository.findAll();

      expect(result[0]?.fallbackBehavior).toBe("HOUSE_AD");
    });
  });

  describe("findById", () => {
    it("should return a placement by id", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [dbRow],
        rowCount: 1
      } as never);

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.code).toBe("HOME_TOP");

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1"),
        [1]
      );
    });

    it("should return null when placement does not exist", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      } as never);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it("should use the supplied client when provided", async () => {
      const client = {
        query: vi.fn().mockResolvedValue({
          rows: [dbRow],
          rowCount: 1
        })
      } as unknown as PoolClient;

      const result = await repository.findById(1, client);

      expect(result?.id).toBe(1);
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1"),
        [1]
      );
      expect(mockedPool.query).not.toHaveBeenCalled();
    });
  });

  describe("findByCode", () => {
    it("should find a placement case-insensitively", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [dbRow],
        rowCount: 1
      } as never);

      const result = await repository.findByCode("home_top");

      expect(result?.code).toBe("HOME_TOP");

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining("LOWER(code) = LOWER($1)"),
        ["home_top"]
      );
    });

    it("should return null when code does not exist", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      } as never);

      const result = await repository.findByCode("UNKNOWN");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should insert a placement with default configuration values", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [dbRow],
        rowCount: 1
      } as never);

      const input = {
        code: "HOME_TOP",
        displayName: "Homepage Top",
        pageType: "HOME" as const,
        placementType: "HOME_TOP" as const
      };

      const result = await repository.create(input, 10);

      expect(result.id).toBe(1);
      expect(result.code).toBe("HOME_TOP");

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      const call = mockedPool.query.mock.calls[0];

      expect(call).toBeDefined();

      if (!call) {
        return;
      }

      const [sql, values] = call;

      expect(String(sql)).toContain("INSERT INTO advertisement_placements");
      expect(String(sql)).toContain("RETURNING");

      expect(values).toEqual([
        "HOME_TOP",
        "Homepage Top",
        null,
        "HOME",
        "HOME_TOP",
        "FIXED",
        0,
        true,
        true,
        "HIDE",
        null,
        null,
        false,
        null,
        true,
        true,
        "ACTIVE",
        10
      ]);
    });
  });

  describe("update", () => {
    it("should update supplied fields only", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [
          {
            ...dbRow,
            display_name: "Updated Homepage Top",
            updated_by: "20"
          }
        ],
        rowCount: 1
      } as never);

      const result = await repository.update(
        1,
        {
          displayName: "Updated Homepage Top",
          displayOrder: 5
        },
        20
      );

      expect(result?.displayName).toBe("Updated Homepage Top");
      expect(result?.updatedBy).toBe(20);

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      const call = mockedPool.query.mock.calls[0];

      expect(call).toBeDefined();

      if (!call) {
        return;
      }

      const [sql, values] = call;

      expect(String(sql)).toContain("UPDATE advertisement_placements");
      expect(String(sql)).toContain("display_name = $1");
      expect(String(sql)).toContain("display_order = $2");
      expect(String(sql)).toContain("updated_by = $3");
      expect(String(sql)).toContain("WHERE id = $4");

      expect(values).toEqual(["Updated Homepage Top", 5, 20, 1]);
    });

    it("should return the existing placement when no fields are supplied", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [dbRow],
        rowCount: 1
      } as never);

      const result = await repository.update(1, {}, 20);

      expect(result?.id).toBe(1);
      expect(mockedPool.query).toHaveBeenCalledTimes(1);
      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1"),
        [1]
      );
    });

    it("should return null when the update affects no rows", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      } as never);

      const result = await repository.update(
        999,
        {
          displayName: "Updated"
        },
        20
      );

      expect(result).toBeNull();
    });

    it("should update configuration fields correctly", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [
          {
            ...dbRow,
            display_frequency: "ONCE_PER_PERIOD",
            frequency_value: 3,
            auto_close_enabled: true,
            auto_close_seconds: 15,
            close_button_enabled: false,
            close_on_overlay_click: false
          }
        ],
        rowCount: 1
      } as never);

      const input = {
        displayFrequency: "ONCE_PER_PERIOD" as const,
        frequencyValue: 3,
        autoCloseEnabled: true,
        autoCloseSeconds: 15,
        closeButtonEnabled: false,
        closeOnOverlayClick: false
      };

      const result = await repository.update(1, input, 20);

      expect(result).toMatchObject({
        displayFrequency: "ONCE_PER_PERIOD",
        frequencyValue: 3,
        autoCloseEnabled: true,
        autoCloseSeconds: 15,
        closeButtonEnabled: false,
        closeOnOverlayClick: false
      });

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      const call = mockedPool.query.mock.calls[0];

      expect(call).toBeDefined();

      if (!call) {
        return;
      }

      const [sql, values] = call;

      expect(String(sql)).toContain("display_frequency = $1");
      expect(String(sql)).toContain("frequency_value = $2");
      expect(String(sql)).toContain("auto_close_enabled = $3");
      expect(String(sql)).toContain("auto_close_seconds = $4");
      expect(String(sql)).toContain("close_button_enabled = $5");
      expect(String(sql)).toContain("close_on_overlay_click = $6");

      expect(values).toEqual([
        "ONCE_PER_PERIOD",
        3,
        true,
        15,
        false,
        false,
        20,
        1
      ]);
    });

    it("should deactivate a placement through the generic update method", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [
          {
            ...dbRow,
            is_enabled: false,
            status: "INACTIVE",
            updated_by: "20"
          }
        ],
        rowCount: 1
      } as never);

      const result = await repository.update(
        1,
        {
          status: "INACTIVE",
          isEnabled: false
        },
        20
      );

      expect(result).toMatchObject({
        id: 1,
        isEnabled: false,
        status: "INACTIVE",
        updatedBy: 20
      });

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      const call = mockedPool.query.mock.calls[0];

      expect(call).toBeDefined();

      if (!call) {
        return;
      }

      const [sql, values] = call;

      expect(String(sql)).toContain("is_enabled = $1");
      expect(String(sql)).toContain("status = $2");
      expect(String(sql)).toContain("updated_by = $3");
      expect(String(sql)).toContain("WHERE id = $4");

      expect(values).toEqual([false, "INACTIVE", 20, 1]);
    });

    it("should enable a placement through the generic update method", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [
          {
            ...dbRow,
            is_enabled: true,
            status: "ACTIVE",
            updated_by: "20"
          }
        ],
        rowCount: 1
      } as never);

      const result = await repository.update(
        1,
        {
          status: "ACTIVE",
          isEnabled: true
        },
        20
      );

      expect(result).toMatchObject({
        id: 1,
        isEnabled: true,
        status: "ACTIVE",
        updatedBy: 20
      });

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      const call = mockedPool.query.mock.calls[0];

      expect(call).toBeDefined();

      if (!call) {
        return;
      }

      const [sql, values] = call;

      expect(String(sql)).toContain("is_enabled = $1");
      expect(String(sql)).toContain("status = $2");
      expect(String(sql)).toContain("updated_by = $3");
      expect(String(sql)).toContain("WHERE id = $4");

      expect(values).toEqual([true, "ACTIVE", 20, 1]);
    });

    it("should disable an enabled placement through the generic update method", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [
          {
            ...dbRow,
            is_enabled: false,
            status: "INACTIVE",
            updated_by: "30"
          }
        ],
        rowCount: 1
      } as never);

      const result = await repository.update(
        1,
        {
          status: "INACTIVE",
          isEnabled: false
        },
        30
      );

      expect(result).toMatchObject({
        id: 1,
        isEnabled: false,
        status: "INACTIVE",
        updatedBy: 30
      });

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      const call = mockedPool.query.mock.calls[0];

      expect(call).toBeDefined();

      if (!call) {
        return;
      }

      const [sql, values] = call;

      expect(String(sql)).toContain("is_enabled = $1");
      expect(String(sql)).toContain("status = $2");
      expect(String(sql)).toContain("updated_by = $3");
      expect(String(sql)).toContain("WHERE id = $4");

      expect(values).toEqual([false, "INACTIVE", 30, 1]);
    });

    it("should enable a placement when only isEnabled is changed to true", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [
          {
            ...dbRow,
            is_enabled: true,
            updated_by: "20"
          }
        ],
        rowCount: 1
      } as never);

      const result = await repository.update(
        1,
        {
          isEnabled: true
        },
        20
      );

      expect(result).toMatchObject({
        id: 1,
        isEnabled: true,
        updatedBy: 20
      });

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      const call = mockedPool.query.mock.calls[0];

      expect(call).toBeDefined();

      if (!call) {
        return;
      }

      const [sql, values] = call;

      expect(String(sql)).toContain("is_enabled = $1");
      expect(String(sql)).toContain("updated_by = $2");
      expect(String(sql)).toContain("WHERE id = $3");

      expect(values).toEqual([true, 20, 1]);
    });

    it("should disable a placement when only isEnabled is changed to false", async () => {
      mockedPool.query.mockResolvedValue({
        rows: [
          {
            ...dbRow,
            is_enabled: false,
            updated_by: "30"
          }
        ],
        rowCount: 1
      } as never);

      const result = await repository.update(
        1,
        {
          isEnabled: false
        },
        30
      );

      expect(result).toMatchObject({
        id: 1,
        isEnabled: false,
        updatedBy: 30
      });

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      const call = mockedPool.query.mock.calls[0];

      expect(call).toBeDefined();

      if (!call) {
        return;
      }

      const [sql, values] = call;

      expect(String(sql)).toContain("is_enabled = $1");
      expect(String(sql)).toContain("updated_by = $2");
      expect(String(sql)).toContain("WHERE id = $3");

      expect(values).toEqual([false, 30, 1]);
    });
  });
});
