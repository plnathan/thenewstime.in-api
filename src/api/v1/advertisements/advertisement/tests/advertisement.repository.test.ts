import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, connectMock, releaseMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  releaseMock: vi.fn()
}));

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: queryMock,
    connect: connectMock
  }
}));

vi.mock("../advertisement.db.mapper.js", () => ({
  mapAdvertisementListRow: vi.fn((row) => row.mappedValue),
  mapAdvertisementRow: vi.fn((row) => row.mappedValue),
  mapClientRow: vi.fn((row) => row.mappedValue)
}));

import * as repository from "../advertisement.repository.js";

import type {
  Advertisement,
  AdvertisementClient,
  AdvertisementListItem
} from "../advertisement.types.js";

import type { AdvertisementRuntimePlacement } from "../advertisement.repository.js";

const mockDbClient = {
  query: queryMock,
  release: releaseMock
};

const createClient = (): AdvertisementClient => ({
  id: 1,
  clientCode: "CLI001",
  name: "Test Client",
  displayName: "Test Client",
  businessName: "Test Business",
  businessTypeId: null,
  businessType: null,
  website: null,
  primaryAddress: null,
  communicationAddress: null,
  contactPerson: "Test Contact",
  contactNo: "9876543210",
  alternateMobile: null,
  email: "test@example.com",
  alternateEmail: null,
  websiteUrl: null,
  status: "ACTIVE",
  notes: null,
  adCreationHold: false,
  adCreationHoldType: null,
  adCreationHoldReason: null,
  adCreationHoldRemarks: null,
  adCreationHoldAt: null,
  adCreationHoldBy: null,
  adCreationUnholdAt: null,
  adCreationUnholdBy: null,
  adCreationUnholdReason: null,
  paymentAttentionRequired: false,
  createdBy: 1,
  updatedBy: null,
  createdAt: new Date("2026-09-01T10:00:00Z"),
  updatedAt: new Date("2026-09-01T10:00:00Z")
});

const createRuntimePlacement = (): AdvertisementRuntimePlacement => ({
  id: 10,
  code: "HOMEPAGE_TOP",
  displayName: "Homepage Top",
  description: "Homepage top advertisement placement.",
  pageType: "HOME",
  placementType: "BANNER",
  insertionType: "FIXED",
  displayOrder: 1,
  isEnabled: true,
  collapseWhenEmpty: false,
  fallbackBehavior: "HIDE",
  displayFrequency: "EVERY_VISIT",
  frequencyValue: null,
  autoCloseEnabled: false,
  autoCloseSeconds: null,
  closeButtonEnabled: true,
  closeOnOverlayClick: false,
  status: "ACTIVE",
  formatId: 20,
  format: {
    id: 20,
    code: "DESKTOP_BANNER",
    displayName: "Desktop Banner",
    description: "Desktop banner format.",
    widthPx: 728,
    heightPx: 90,
    mobileWidthPx: 320,
    mobileHeightPx: 100,
    isResponsive: false
  },
  createdBy: 1,
  updatedBy: null,
  createdAt: new Date("2026-09-01T10:00:00Z"),
  updatedAt: new Date("2026-09-01T10:00:00Z")
});

const createAdvertisement = (): Advertisement & {
  placement: AdvertisementRuntimePlacement | null;
} => ({
  id: 100,
  advertiserId: 1,
  clientId: 1,
  isHouseAd: false,
  campaignId: null,
  name: "Test Advertisement",
  internalName: "TEST_AD_001",
  advertisementType: "DISPLAY",
  destinationUrl: "https://example.com",
  priority: 0,
  status: "DRAFT",
  startAt: null,
  endAt: null,
  isClickable: true,
  openInNewTab: true,
  notes: null,
  workflowStatus: "DRAFT",
  submittedAt: null,
  submittedBy: null,
  approvedAt: null,
  approvedBy: null,
  rejectedAt: null,
  rejectedBy: null,
  rejectionReason: null,
  onHoldAt: null,
  onHoldBy: null,
  onHoldReason: null,

  advertisementAmount: 10000,

  standardAmount: null,
  pricingPlacementId: null,
  pricingUnit: null,
  pricingQuantity: null,

  discountPercentage: 0,
  discountAmount: 0,

  advancePercentage: 0,
  advanceAmount: 0,

  adjustmentAmount: 0,
  adjustmentReason: null,
  adjustmentBy: null,
  adjustmentAt: null,

  currencyCode: "INR",

  createdBy: 1,
  updatedBy: null,

  createdAt: new Date("2026-09-01T10:00:00Z"),
  updatedAt: new Date("2026-09-01T10:00:00Z"),

  client: createClient(),

  placement: createRuntimePlacement()
});

const createAdvertisementListItem = (): AdvertisementListItem => ({
  id: 100,
  advertiserId: 1,
  clientId: 1,
  clientName: "Test Client",
  clientCode: "CLI001",
  name: "Test Advertisement",
  advertisementType: "DISPLAY",
  priority: 0,
  status: "DRAFT",
  workflowStatus: "DRAFT",
  startAt: null,
  endAt: null,

  advertisementAmount: 10000,

  standardAmount: null,
  pricingPlacementId: null,
  pricingUnit: null,
  pricingQuantity: null,

  discountPercentage: 0,
  discountAmount: 0,

  advancePercentage: 0,
  advanceAmount: 0,

  adjustmentAmount: 0,

  currencyCode: "INR",

  createdAt: new Date("2026-09-01T10:00:00Z"),
  updatedAt: new Date("2026-09-01T10:00:00Z")
});

const createClientDbRow = (mappedValue: AdvertisementClient) => ({
  id: 1,
  client_code: "CLI001",
  name: "Test Client",
  display_name: "Test Client",
  business_name: "Test Business",

  business_type_id: null,
  business_type_code: null,
  business_type_display_name: null,
  business_type_description: null,
  business_type_display_order: null,
  business_type_status: null,

  website: null,
  primary_address: null,
  communication_address: null,

  contact_person: "Test Contact",
  contact_no: "9876543210",
  alternate_mobile: null,

  email: "test@example.com",
  alternate_email: null,

  website_url: null,

  status: "ACTIVE" as const,

  notes: null,

  ad_creation_hold: false,
  ad_creation_hold_type: null,
  ad_creation_hold_reason: null,
  ad_creation_hold_remarks: null,
  ad_creation_hold_at: null,
  ad_creation_hold_by: null,

  ad_creation_unhold_at: null,
  ad_creation_unhold_by: null,
  ad_creation_unhold_reason: null,

  payment_attention_required: false,

  created_by: 1,
  updated_by: null,

  created_at: new Date("2026-09-01T10:00:00Z"),
  updated_at: new Date("2026-09-01T10:00:00Z"),

  mappedValue
});

const createAdvertisementDbRow = (
  mappedValue: Advertisement
): Record<string, unknown> => ({
  id: 100,

  advertiser_id: 1,
  client_id: 1,
  campaign_id: null,

  name: "Test Advertisement",
  internal_name: "TEST_AD_001",

  advertisement_type: "DISPLAY" as const,

  destination_url: "https://example.com",

  priority: 0,

  status: "DRAFT" as const,

  start_at: null,
  end_at: null,

  is_clickable: true,
  open_in_new_tab: true,

  notes: null,

  workflow_status: "DRAFT" as const,

  submitted_at: null,
  submitted_by: null,

  approved_at: null,
  approved_by: null,

  rejected_at: null,
  rejected_by: null,

  rejection_reason: null,

  on_hold_at: null,
  on_hold_by: null,
  on_hold_reason: null,

  advertisement_amount: 10000,

  standard_amount: null,
  pricing_placement_id: null,
  pricing_unit: null,
  pricing_quantity: null,

  discount_percentage: 0,
  discount_amount: 0,

  advance_percentage: 0,
  advance_amount: 0,

  adjustment_amount: 0,
  adjustment_reason: null,
  adjustment_by: null,
  adjustment_at: null,

  currency_code: "INR",

  created_by: 1,
  updated_by: null,

  created_at: new Date("2026-09-01T10:00:00Z"),
  updated_at: new Date("2026-09-01T10:00:00Z"),

  client_id_join: 1,
  client_code: "CLI001",
  client_name: "Test Client",

  is_house_ad: false,

  mappedValue
});

const createAdvertisementListDbRow = (
  mappedValue: AdvertisementListItem
): Record<string, unknown> => ({
  id: 100,

  advertiser_id: 1,
  client_id: 1,
  campaign_id: null,

  name: "Test Advertisement",
  internal_name: "TEST_AD_001",

  advertisement_type: "DISPLAY" as const,

  destination_url: "https://example.com",

  priority: 0,

  status: "DRAFT" as const,

  start_at: null,
  end_at: null,

  is_clickable: true,
  open_in_new_tab: true,

  notes: null,

  workflow_status: "DRAFT" as const,

  submitted_at: null,
  submitted_by: null,

  approved_at: null,
  approved_by: null,

  rejected_at: null,
  rejected_by: null,

  rejection_reason: null,

  on_hold_at: null,
  on_hold_by: null,
  on_hold_reason: null,

  advertisement_amount: 10000,

  standard_amount: null,
  pricing_placement_id: null,
  pricing_unit: null,
  pricing_quantity: null,

  discount_percentage: 0,
  discount_amount: 0,

  advance_percentage: 0,
  advance_amount: 0,

  adjustment_amount: 0,
  adjustment_reason: null,
  adjustment_by: null,
  adjustment_at: null,

  currency_code: "INR",

  created_by: 1,
  updated_by: null,

  created_at: new Date("2026-09-01T10:00:00Z"),
  updated_at: new Date("2026-09-01T10:00:00Z"),

  client_id_join: 1,
  client_code: "CLI001",
  client_name: "Test Client",

  is_house_ad: false,

  mappedValue
});

const createRuntimePlacementDbRow = () => ({
  id: 10,
  code: "HOMEPAGE_TOP",
  display_name: "Homepage Top",
  description: "Homepage top advertisement placement.",
  page_type: "HOME",
  placement_type: "BANNER",
  insertion_type: "FIXED",
  display_order: 1,
  is_enabled: true,
  collapse_when_empty: false,
  fallback_behavior: "HIDE",

  display_frequency: "EVERY_VISIT",

  frequency_value: null,
  auto_close_enabled: false,
  auto_close_seconds: null,
  close_button_enabled: true,
  close_on_overlay_click: false,
  status: "ACTIVE",
  format_id: 20,

  format_code: "DESKTOP_BANNER",
  format_display_name: "Desktop Banner",
  format_description: "Desktop banner format.",
  format_width_px: 728,
  format_height_px: 90,
  format_mobile_width_px: 320,
  format_mobile_height_px: 100,
  format_is_responsive: false,

  created_by: 1,
  updated_by: null,
  created_at: new Date("2026-09-01T10:00:00Z"),
  updated_at: new Date("2026-09-01T10:00:00Z")
});

const mockAdvertisementLoad = (
  advertisement: Advertisement & {
    placement?: AdvertisementRuntimePlacement | null;
  },
  includePlacement = true
): void => {
  queryMock
    .mockResolvedValueOnce({
      rowCount: 1,
      rows: [createAdvertisementDbRow(advertisement as Advertisement)]
    })
    .mockResolvedValueOnce({
      rowCount: 1,
      rows: [createClientDbRow(createClient())]
    });

  if (includePlacement) {
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [createRuntimePlacementDbRow()]
    });
  }
};

const mockTransactionBegin = (): void => {
  queryMock.mockResolvedValueOnce({
    rowCount: 0,
    rows: []
  });
};

const mockTransactionCommit = (): void => {
  queryMock.mockResolvedValueOnce({
    rowCount: 0,
    rows: []
  });
};

const mockTransactionRollback = (): void => {
  queryMock.mockResolvedValueOnce({
    rowCount: 0,
    rows: []
  });
};

const mockScheduleSyncWithoutDates = (): void => {
  /*
   * syncAdvertisementSchedule() first loads the current
   * advertisement schedule and active placement rule.
   */
  queryMock.mockResolvedValueOnce({
    rowCount: 1,
    rows: [
      {
        start_at: null,
        end_at: null,
        priority: 0,
        notes: null,
        placement_rule_id: null,
        placement_id: null
      }
    ]
  });

  /*
   * With no complete schedule, the repository cancels any
   * previously scheduled row rather than inserting a new one.
   */
  queryMock.mockResolvedValueOnce({
    rowCount: 0,
    rows: []
  });
};

beforeEach(() => {
  queryMock.mockReset();
  connectMock.mockReset();
  releaseMock.mockReset();

  connectMock.mockResolvedValue(mockDbClient);
});

describe("findClientById()", () => {
  it("should return a client when the client exists", async () => {
    const client = createClient();

    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [createClientDbRow(client)]
    });

    const result = await repository.findClientById(1);

    expect(result).toEqual(client);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]?.[1]).toEqual([1]);
  });

  it("should return null when the client does not exist", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 0,
      rows: []
    });

    const result = await repository.findClientById(999);

    expect(result).toBeNull();
  });
});

describe("findById()", () => {
  it("should return an advertisement when it exists", async () => {
    const advertisement = createAdvertisement();

    mockAdvertisementLoad(advertisement);

    const result = await repository.findById(100);

    expect(result).toEqual(advertisement);

    expect(queryMock).toHaveBeenCalledTimes(3);

    expect(queryMock.mock.calls[0]?.[1]).toEqual([100]);
    expect(queryMock.mock.calls[1]?.[1]).toEqual([1]);
    expect(queryMock.mock.calls[2]?.[1]).toEqual([100]);
  });

  it("should return null when the advertisement does not exist", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 0,
      rows: []
    });

    const result = await repository.findById(999);

    expect(result).toBeNull();

    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("create()", () => {
  it("should create and load an advertisement", async () => {
    const advertisement = createAdvertisement();

    mockTransactionBegin();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 100 }]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createRuntimePlacementDbRow()]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: []
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: []
      });

    mockScheduleSyncWithoutDates();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createAdvertisementDbRow(advertisement)]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createClientDbRow(createClient())]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createRuntimePlacementDbRow()]
      });

    mockTransactionCommit();

    const input = {
      clientId: 1,
      placementId: 10,
      name: "Test Advertisement",
      destinationUrl: "https://example.com",
      advertisementType: "DISPLAY" as const,
      priority: 0,
      isClickable: true,
      openInNewTab: true
    };

    const result = await repository.create(input, 10);

    expect(result).toEqual(advertisement);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(releaseMock).toHaveBeenCalledTimes(1);

    expect(queryMock).toHaveBeenCalled();

    expect(queryMock.mock.calls).toContainEqual([
      expect.anything(),
      [
        1,
        null,
        "Test Advertisement",
        null,
        "DISPLAY",
        "https://example.com",
        0,
        null,
        null,
        true,
        true,
        null,
        null,
        0,
        0,
        0,
        0,
        "INR",
        false,
        10
      ]
    ]);
  });

    it("should create with pricing fields when calculated pricing is supplied", async () => {
      const advertisement = createAdvertisement();

      mockTransactionBegin();

      queryMock
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 100 }]
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [createRuntimePlacementDbRow()]
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: []
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: []
        });

      // Required: create() synchronizes the schedule before reloading the advertisement.
      mockScheduleSyncWithoutDates();

      queryMock
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            createAdvertisementDbRow({
              ...advertisement,
              standardAmount: 5000,
              pricingPlacementId: 10,
              pricingUnit: "DAY",
              pricingQuantity: 5
            })
          ]
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [createClientDbRow(createClient())]
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [createRuntimePlacementDbRow()]
        });

      mockTransactionCommit();

      const input = {
        clientId: 1,
        placementId: 10,
        name: "Priced Advertisement",
        destinationUrl: "https://example.com",
        advertisementType: "DISPLAY" as const,
        priority: 0,
        isClickable: true,
        openInNewTab: true,

        standardAmount: 5000,
        pricingPlacementId: 10,
        pricingUnit: "DAY" as const,
        pricingQuantity: 5
      };

      const result = await repository.create(input, 10);

      expect(result.standardAmount).toBe(5000);
      expect(result.pricingPlacementId).toBe(10);
      expect(result.pricingUnit).toBe("DAY");
      expect(result.pricingQuantity).toBe(5);

      expect(connectMock).toHaveBeenCalledTimes(1);
      expect(releaseMock).toHaveBeenCalledTimes(1);
    });

  it("should throw when the client does not exist", async () => {
    mockTransactionBegin();

    queryMock.mockResolvedValueOnce({
      rowCount: 0,
      rows: []
    });

    mockTransactionRollback();

    const input = {
      clientId: 999,
      name: "Test Advertisement",
      destinationUrl: "https://example.com",
      advertisementType: "DISPLAY" as const
    };

    await expect(repository.create(input, 10)).rejects.toThrow(
      "Advertisement client was not found."
    );

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("should throw when the inserted advertisement ID is not returned", async () => {
    mockTransactionBegin();

    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: []
    });

    mockTransactionRollback();

    const input = {
      clientId: 1,
      name: "Test Advertisement",
      destinationUrl: "https://example.com",
      advertisementType: "DISPLAY" as const
    };

    await expect(repository.create(input, 10)).rejects.toThrow(
      "Advertisement was created but its ID was not returned."
    );

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("should throw when the created advertisement cannot be loaded", async () => {
    mockTransactionBegin();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 100 }]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createRuntimePlacementDbRow()]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: []
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: []
      });

    mockScheduleSyncWithoutDates();

    queryMock.mockResolvedValueOnce({
      rowCount: 0,
      rows: []
    });

    mockTransactionRollback();

    const input = {
      clientId: 1,
      placementId: 10,
      name: "Test Advertisement",
      destinationUrl: "https://example.com",
      advertisementType: "DISPLAY" as const
    };

    await expect(repository.create(input, 10)).rejects.toThrow(
      "Advertisement was created but could not be loaded."
    );

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});

  it("should return the existing advertisement when there are no update fields", async () => {
    const advertisement = createAdvertisement();

    mockTransactionBegin();

    // Required: update() synchronizes the schedule before reloading the advertisement.
    mockScheduleSyncWithoutDates();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createAdvertisementDbRow(advertisement)]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createClientDbRow(createClient())]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createRuntimePlacementDbRow()]
      });

    mockTransactionCommit();

    const result = await repository.update(100, {}, 20);

    expect(result).toEqual(advertisement);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

describe("list()", () => {
  it("should return advertisements with total count", async () => {
    const listItem = createAdvertisementListItem();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ count: "1" }]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createAdvertisementListDbRow(listItem)]
      });

    const result = await repository.list({
      page: 1,
      pageSize: 20
    });

    expect(result).toEqual({
      items: [listItem],
      total: 1
    });

    expect(queryMock).toHaveBeenCalledTimes(2);

    expect(queryMock.mock.calls[0]?.[1]).toEqual([]);

    expect(queryMock.mock.calls[1]?.[1]).toEqual([20, 0]);
  });

  it("should apply search filters", async () => {
    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ count: "2" }]
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });

    const result = await repository.list({
      page: 1,
      pageSize: 20,
      search: "homepage"
    });

    expect(result.total).toBe(2);

    expect(result.items).toEqual([]);

    expect(queryMock.mock.calls[0]?.[1]).toEqual(["homepage"]);

    expect(queryMock.mock.calls[1]?.[1]).toEqual(["homepage", 20, 0]);
  });

  it("should apply client, workflow status, and status filters", async () => {
    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ count: "1" }]
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });

    await repository.list({
      page: 2,
      pageSize: 10,
      clientId: 5,
      workflowStatus: "DRAFT",
      status: "DRAFT"
    });

    expect(queryMock.mock.calls[0]?.[1]).toEqual([5, "DRAFT", "DRAFT"]);

    expect(queryMock.mock.calls[1]?.[1]).toEqual([5, "DRAFT", "DRAFT", 10, 10]);
  });

  it("should calculate the correct offset for later pages", async () => {
    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ count: "25" }]
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });

    await repository.list({
      page: 3,
      pageSize: 10
    });

    expect(queryMock.mock.calls[1]?.[1]).toEqual([10, 20]);
  });

  it("should return an empty list when there are no advertisements", async () => {
    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ count: "0" }]
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });

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

describe("existsById()", () => {
  it("should return true when the advertisement exists", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ exists: true }]
    });

    const result = await repository.existsById(100);

    expect(result).toBe(true);

    expect(queryMock.mock.calls[0]?.[1]).toEqual([100]);
  });

  it("should return false when the advertisement does not exist", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ exists: false }]
    });

    const result = await repository.existsById(999);

    expect(result).toBe(false);
  });
});

describe("existsCampaignById()", () => {
  it("should return true when the campaign exists", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ exists: true }]
    });

    const result = await repository.existsCampaignById(50);

    expect(result).toBe(true);

    expect(queryMock.mock.calls[0]?.[1]).toEqual([50]);
  });

  it("should return false when the campaign does not exist", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ exists: false }]
    });

    const result = await repository.existsCampaignById(999);

    expect(result).toBe(false);
  });
});
