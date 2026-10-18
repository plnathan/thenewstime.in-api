import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import { findEligibleCandidates } from "../delivery.repository.js";

import type {
  AdvertisementDeliveryContext,
  AdvertisementDeliveryPlacementType
} from "../delivery.types.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

type MockQueryResult = {
  rows: Record<string, unknown>[];
};

type MockQueryFunction = {
  (queryText: string, values?: unknown[]): Promise<MockQueryResult>;
};

const mockedPoolQuery = pool.query as unknown as ReturnType<
  typeof vi.fn<MockQueryFunction>
>;

function createDbRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    advertisement_id: "100",
    advertisement_name: "Test Advertisement",
    advertisement_type: "DISPLAY",
    destination_url: "https://example.com",
    priority: 10,
    open_in_new_tab: true,
    is_clickable: true,

    placement_id: "10",
    placement_code: "NEWS_DETAIL_TOP",
    placement_display_name: "News Detail Top",
    placement_description: "News detail top advertisement",
    page_type: "NEWS_DETAIL",
    placement_type: "NEWS_DETAIL_TOP",
    placement_insertion_type: "FIXED",
    placement_display_order: 1,
    collapse_when_empty: true,
    fallback_behavior: "HIDE",
    display_frequency: null,
    frequency_value: null,
    auto_close_enabled: false,
    auto_close_seconds: null,
    close_button_enabled: true,
    close_on_overlay_click: true,

    placement_rule_id: "20",
    placement_rule_display_order: 2,
    placement_rule_insertion_type: "AFTER_N_ITEMS",
    insertion_position: 3,
    max_impressions: 100,

    schedule_id: "30",
    schedule_priority: 5,

    creative_id: "40",
    creative_type: "IMAGE",
    creative_title: "Test Creative",
    creative_alt_text: "Test advertisement",
    creative_media_url: "https://cdn.example.com/ad.jpg",
    creative_thumbnail_url: "https://cdn.example.com/ad-thumb.jpg",
    creative_width_px: 728,
    creative_height_px: 90,
    creative_display_order: 1,
    creative_is_primary: true,

    format_id: "50",
    format_code: "LEADERBOARD",
    format_display_name: "Leaderboard",
    format_width_px: 728,
    format_height_px: 90,
    format_is_responsive: true,

    targets: [],

    ...overrides
  };
}

function mockQueryRows(rows: Record<string, unknown>[]): void {
  mockedPoolQuery.mockResolvedValue({
    rows
  });
}

function getLastQueryCall(): [string, unknown[] | undefined] {
  const calls = mockedPoolQuery.mock.calls;

  const call = calls[0];

  if (!call) {
    throw new Error("Expected pool.query to have been called.");
  }

  return [call[0], call[1]];
}

describe("delivery.repository.findEligibleCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute the eligible advertisement query using the requested page and placement", async () => {
    mockQueryRows([createDbRow()]);

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP"
    );

    expect(result).toHaveLength(1);

    expect(mockedPoolQuery).toHaveBeenCalledTimes(1);

    const [query, values] = getLastQueryCall();

    expect(query).toContain("advertisements");
    expect(query).toContain("advertisement_placement_rules");
    expect(query).toContain("advertisement_placements");
    expect(query).toContain("advertisement_schedules");

    expect(values).toHaveLength(3);
    expect(values?.[0]).toBe("NEWS_DETAIL");
    expect(values?.[1]).toBe("NEWS_DETAIL_TOP");
    expect(values?.[2]).toBeInstanceOf(Date);
  });

  it("should include placementId in the query when provided", async () => {
    mockQueryRows([createDbRow()]);

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP",
      10
    );

    expect(result).toHaveLength(1);

    expect(mockedPoolQuery).toHaveBeenCalledTimes(1);

    const [query, values] = getLastQueryCall();

    expect(query).toContain("placement_id");

    expect(values).toHaveLength(4);
    expect(values?.[0]).toBe("NEWS_DETAIL");
    expect(values?.[1]).toBe("NEWS_DETAIL_TOP");
    expect(values?.[2]).toBeInstanceOf(Date);
    expect(values?.[3]).toBe(10);
  });

  it("should not add placementId filtering when placementId is undefined", async () => {
    mockQueryRows([createDbRow()]);

    await findEligibleCandidates("NEWS_DETAIL", "NEWS_DETAIL_TOP", undefined);

    expect(mockedPoolQuery).toHaveBeenCalledTimes(1);

    const [, values] = getLastQueryCall();

    expect(values).toHaveLength(3);
    expect(values?.[0]).toBe("NEWS_DETAIL");
    expect(values?.[1]).toBe("NEWS_DETAIL_TOP");
    expect(values?.[2]).toBeInstanceOf(Date);
  });

  it("should pass the supplied now value to the schedule eligibility query", async () => {
    mockQueryRows([createDbRow()]);

    const now = new Date("2026-09-20T01:00:00.000Z");

    await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP",
      undefined,
      undefined,
      now
    );

    expect(mockedPoolQuery).toHaveBeenCalledTimes(1);

    const [query, values] = getLastQueryCall();

    expect(query).toContain("start_at");
    expect(query).toContain("end_at");

    expect(values).toHaveLength(3);
    expect(values?.[0]).toBe("NEWS_DETAIL");
    expect(values?.[1]).toBe("NEWS_DETAIL_TOP");
    expect(values?.[2]).toEqual(now);
  });

  it("should map advertisement fields correctly", async () => {
    mockQueryRows([
      createDbRow({
        advertisement_id: "123",
        advertisement_name: "Summer Campaign",
        advertisement_type: "BANNER",
        destination_url: "https://example.com/summer",
        priority: 25,
        open_in_new_tab: false,
        is_clickable: true
      })
    ]);

    const result = await findEligibleCandidates("HOME", "HOME_TOP");

    expect(result[0]).toMatchObject({
      advertisementId: 123,
      advertisementName: "Summer Campaign",
      advertisementType: "BANNER",
      destinationUrl: "https://example.com/summer",
      priority: 25,
      openInNewTab: false,
      isClickable: true
    });
  });

  it("should map placement fields correctly", async () => {
    mockQueryRows([
      createDbRow({
        placement_id: "101",
        placement_code: "HOME_BANNER",
        placement_display_name: "Home Banner",
        placement_description: "Homepage banner",
        page_type: "HOME",
        placement_type: "HOME_BANNER",
        placement_insertion_type: "BETWEEN_SECTIONS",
        placement_display_order: 7,
        collapse_when_empty: false,
        fallback_behavior: "HIDE",
        display_frequency: "ONCE_PER_DAY",
        frequency_value: 1,
        auto_close_enabled: true,
        auto_close_seconds: 10,
        close_button_enabled: false,
        close_on_overlay_click: false
      })
    ]);

    const result = await findEligibleCandidates("HOME", "HOME_BANNER");

    expect(result[0]).toMatchObject({
      placementId: 101,
      placementCode: "HOME_BANNER",
      placementDisplayName: "Home Banner",
      placementDescription: "Homepage banner",
      pageType: "HOME",
      placementType: "HOME_BANNER",
      placementInsertionType: "BETWEEN_SECTIONS",
      placementDisplayOrder: 7,
      collapseWhenEmpty: false,
      fallbackBehavior: "HIDE",
      displayFrequency: "ONCE_PER_DAY",
      frequencyValue: 1,
      autoCloseEnabled: true,
      autoCloseSeconds: 10,
      closeButtonEnabled: false,
      closeOnOverlayClick: false
    });
  });

  it("should map placement rule fields correctly", async () => {
    mockQueryRows([
      createDbRow({
        placement_rule_id: "201",
        placement_rule_display_order: 4,
        placement_rule_insertion_type: "AFTER_N_ITEMS",
        insertion_position: 5,
        max_impressions: 250
      })
    ]);

    const result = await findEligibleCandidates(
      "NEWS_LIST",
      "NEWS_LIST_BETWEEN"
    );

    expect(result[0]).toMatchObject({
      placementRuleId: 201,
      placementRuleDisplayOrder: 4,
      placementRuleInsertionType: "AFTER_N_ITEMS",
      insertionPosition: 5,
      maxImpressions: 250
    });
  });

  it("should map schedule fields correctly", async () => {
    mockQueryRows([
      createDbRow({
        schedule_id: "301",
        schedule_priority: 18
      })
    ]);

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP"
    );

    expect(result[0]).toMatchObject({
      scheduleId: 301,
      schedulePriority: 18
    });
  });

  it("should map an active creative correctly", async () => {
    mockQueryRows([
      createDbRow({
        creative_id: "401",
        creative_type: "IMAGE",
        creative_title: "Hero Banner",
        creative_alt_text: "Hero advertisement",
        creative_media_url: "https://cdn.example.com/hero.jpg",
        creative_thumbnail_url: "https://cdn.example.com/hero-thumb.jpg",
        creative_width_px: 1200,
        creative_height_px: 300,
        creative_display_order: 1,
        creative_is_primary: true
      })
    ]);

    const result = await findEligibleCandidates("HOME", "HOME_BANNER");

    expect(result[0]?.creative).toEqual({
      id: 401,
      creativeType: "IMAGE",
      title: "Hero Banner",
      altText: "Hero advertisement",
      mediaUrl: "https://cdn.example.com/hero.jpg",
      thumbnailUrl: "https://cdn.example.com/hero-thumb.jpg",
      widthPx: 1200,
      heightPx: 300,
      displayOrder: 1,
      isPrimary: true
    });
  });

  it("should map nullable creative fields correctly", async () => {
    mockQueryRows([
      createDbRow({
        creative_thumbnail_url: null,
        creative_width_px: null,
        creative_height_px: null
      })
    ]);

    const result = await findEligibleCandidates("HOME", "HOME_TOP");

    expect(result[0]?.creative).toEqual({
      id: 40,
      creativeType: "IMAGE",
      title: "Test Creative",
      altText: "Test advertisement",
      mediaUrl: "https://cdn.example.com/ad.jpg",
      thumbnailUrl: null,
      widthPx: null,
      heightPx: null,
      displayOrder: 1,
      isPrimary: true
    });
  });

  it("should map an active format correctly", async () => {
    mockQueryRows([
      createDbRow({
        format_id: "501",
        format_code: "MOBILE_BANNER",
        format_display_name: "Mobile Banner",
        format_width_px: 320,
        format_height_px: 100,
        format_is_responsive: false
      })
    ]);

    const result = await findEligibleCandidates("HOME", "HOME_TOP");

    expect(result[0]?.format).toEqual({
      id: 501,
      code: "MOBILE_BANNER",
      displayName: "Mobile Banner",
      widthPx: 320,
      heightPx: 100,
      isResponsive: false
    });
  });

  it("should map a null format correctly", async () => {
    mockQueryRows([
      createDbRow({
        format_id: null,
        format_code: null,
        format_display_name: null,
        format_width_px: null,
        format_height_px: null,
        format_is_responsive: null
      })
    ]);

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP"
    );

    expect(result[0]?.format).toBeNull();
  });

  it("should map empty target rows to an empty target array", async () => {
    mockQueryRows([
      createDbRow({
        targets: []
      })
    ]);

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP"
    );

    expect(result[0]?.targets).toEqual([]);
  });

  it("should map include and exclude target rows correctly", async () => {
    mockQueryRows([
      createDbRow({
        targets: [
          {
            id: "601",
            targetType: "STATE",
            targetValue: "tamil-nadu",
            isInclude: true
          },
          {
            id: "602",
            targetType: "DISTRICT",
            targetValue: "chennai",
            isInclude: false
          }
        ]
      })
    ]);

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP"
    );

    expect(result[0]?.targets).toEqual([
      {
        id: 601,
        targetType: "STATE",
        targetValue: "tamil-nadu",
        isInclude: true
      },
      {
        id: 602,
        targetType: "DISTRICT",
        targetValue: "chennai",
        isInclude: false
      }
    ]);
  });

  it("should map bigint-style target ids to numbers", async () => {
    mockQueryRows([
      createDbRow({
        targets: [
          {
            id: "900719925",
            targetType: "SITE",
            targetValue: "thenewstime.in",
            isInclude: true
          }
        ]
      })
    ]);

    const result = await findEligibleCandidates("HOME", "HOME_TOP");

    expect(result[0]?.targets[0]?.id).toBe(900719925);

    expect(typeof result[0]?.targets[0]?.id).toBe("number");
  });

  it("should pass targeting context to the repository query call contract", async () => {
    mockQueryRows([createDbRow()]);

    const context: AdvertisementDeliveryContext = {
      site: "thenewstime.in",
      newsId: 123,
      category: "politics",
      state: "tamil-nadu",
      district: "chennai",
      country: "india"
    };

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP",
      undefined,
      context
    );

    expect(result).toHaveLength(1);
    expect(mockedPoolQuery).toHaveBeenCalledTimes(1);
  });

  it("should return multiple database rows in the same order", async () => {
    mockQueryRows([
      createDbRow({
        advertisement_id: "100"
      }),
      createDbRow({
        advertisement_id: "101"
      }),
      createDbRow({
        advertisement_id: "102"
      })
    ]);

    const result = await findEligibleCandidates("HOME", "HOME_TOP");

    expect(result).toHaveLength(3);

    expect(result.map((item) => item.advertisementId)).toEqual([100, 101, 102]);
  });

  it("should return an empty array when the database returns no rows", async () => {
    mockQueryRows([]);

    const result = await findEligibleCandidates("NEWS_LIST", "NEWS_LIST_TOP");

    expect(result).toEqual([]);
  });

  it("should preserve nullable database values according to the repository mapping", async () => {
    mockQueryRows([
      createDbRow({
        destination_url: null,
        placement_description: null,
        placement_rule_id: null,
        placement_rule_insertion_type: null,
        insertion_position: null,
        max_impressions: null,
        creative_id: null,
        creative_type: null,
        creative_title: null,
        creative_alt_text: null,
        creative_media_url: null,
        creative_thumbnail_url: null,
        creative_width_px: null,
        creative_height_px: null,
        creative_display_order: null,
        creative_is_primary: null,
        format_id: null,
        format_code: null,
        format_display_name: null,
        format_width_px: null,
        format_height_px: null,
        format_is_responsive: null
      })
    ]);

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_BOTTOM"
    );

    expect(result[0]).toMatchObject({
      destinationUrl: null,
      placementDescription: null,
      placementRuleId: 0,
      placementRuleInsertionType: null,
      insertionPosition: null,
      maxImpressions: null,
      creative: null,
      format: null
    });
  });

  it("should propagate database errors", async () => {
    const databaseError = new Error("Database connection failed");

    mockedPoolQuery.mockRejectedValue(databaseError);

    await expect(findEligibleCandidates("HOME", "HOME_TOP")).rejects.toThrow(
      "Database connection failed"
    );
  });

  it("should use the supplied database client when provided", async () => {
    const clientQuery = vi.fn().mockResolvedValue({
      rows: [createDbRow()]
    });

    const client = {
      query: clientQuery
    } as never;

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP",
      undefined,
      undefined,
      new Date("2026-09-20T01:00:00.000Z"),
      client
    );

    expect(result).toHaveLength(1);
    expect(clientQuery).toHaveBeenCalledTimes(1);
    expect(mockedPoolQuery).not.toHaveBeenCalled();
  });

  it("should convert all numeric identifier fields from database strings to numbers", async () => {
    mockQueryRows([
      createDbRow({
        advertisement_id: "1001",
        placement_id: "1002",
        placement_rule_id: "1003",
        schedule_id: "1004",
        creative_id: "1005",
        format_id: "1006"
      })
    ]);

    const result = await findEligibleCandidates(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP"
    );

    const candidate = result[0];

    expect(candidate).toBeDefined();

    expect(candidate?.advertisementId).toBe(1001);

    expect(candidate?.placementId).toBe(1002);

    expect(candidate?.placementRuleId).toBe(1003);

    expect(candidate?.scheduleId).toBe(1004);

    expect(candidate?.creative?.id).toBe(1005);

    expect(candidate?.format?.id).toBe(1006);

    expect(typeof candidate?.advertisementId).toBe("number");

    expect(typeof candidate?.placementId).toBe("number");

    expect(typeof candidate?.placementRuleId).toBe("number");

    expect(typeof candidate?.scheduleId).toBe("number");

    expect(typeof candidate?.creative?.id).toBe("number");

    expect(typeof candidate?.format?.id).toBe("number");
  });

  it("should contain the expected eligibility conditions in the SQL", async () => {
    mockQueryRows([createDbRow()]);

    await findEligibleCandidates("NEWS_DETAIL", "NEWS_DETAIL_TOP");

    const [query] = getLastQueryCall();

    expect(query).toContain("workflow_status");

    expect(query).toContain("APPROVED");

    expect(query).toContain("status");

    expect(query).toContain("ACTIVE");

    expect(query).toContain("start_at");

    expect(query).toContain("end_at");
  });

  it("should contain active placement and placement-rule conditions in the SQL", async () => {
    mockQueryRows([createDbRow()]);

    await findEligibleCandidates("HOME", "HOME_TOP");

    const [query] = getLastQueryCall();

    expect(query).toContain("advertisement_placement_rules");

    expect(query).toContain("advertisement_placements");

    expect(query).toContain("is_enabled");
  });

  it("should contain the expected ordering in the SQL", async () => {
    mockQueryRows([createDbRow()]);

    await findEligibleCandidates("NEWS_DETAIL", "NEWS_DETAIL_TOP");

    const [query] = getLastQueryCall();

    expect(query).toContain("s.priority DESC");

    expect(query).toContain("a.priority DESC");

    expect(query).toContain("pr.display_order ASC");

    expect(query).toContain("p.display_order ASC");

    expect(query).toContain("a.id ASC");

    expect(query).toContain("pr.id ASC");
    expect(query).toContain(
      "COALESCE(p.rotation_enabled, FALSE) = FALSE OR rm.id IS NOT NULL"
    );
  });

  it("should accept every supported page type and placement type combination", async () => {
    const cases: Array<
      ["HOME" | "NEWS_LIST" | "NEWS_DETAIL", AdvertisementDeliveryPlacementType]
    > = [
      ["HOME", "HOME_BANNER"],
      ["HOME", "HOME_TOP"],
      ["HOME", "HOME_BETWEEN_SECTIONS"],
      ["HOME", "HOME_SIDEBAR"],
      ["NEWS_LIST", "NEWS_LIST_TOP"],
      ["NEWS_LIST", "NEWS_LIST_BETWEEN"],
      ["NEWS_LIST", "NEWS_LIST_BOTTOM"],
      ["NEWS_DETAIL", "NEWS_DETAIL_TOP"],
      ["NEWS_DETAIL", "NEWS_DETAIL_BETWEEN"],
      ["NEWS_DETAIL", "NEWS_DETAIL_SIDEBAR"],
      ["NEWS_DETAIL", "NEWS_DETAIL_BOTTOM"],
      ["NEWS_DETAIL", "NEWS_DETAIL_MODAL"]
    ];

    for (const [pageType, placementType] of cases) {
      vi.clearAllMocks();

      mockQueryRows([createDbRow()]);

      await findEligibleCandidates(pageType, placementType);

      expect(mockedPoolQuery).toHaveBeenCalledTimes(1);
    }
  });
});
