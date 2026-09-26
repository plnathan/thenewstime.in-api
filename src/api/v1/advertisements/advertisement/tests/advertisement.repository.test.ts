import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn()
}));

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: queryMock
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

const createAdvertisement = (): Advertisement => ({
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

  client: createClient()
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

const createAdvertisementDbRow = (mappedValue: Advertisement) => ({
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

  /*
   * Current advertisement financial field.
   */
  advertisement_amount: 10000,

  /*
   * 8C pricing fields.
   */
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

const createAdvertisementListDbRow = (mappedValue: AdvertisementListItem) => ({
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

beforeEach(() => {
  queryMock.mockReset();
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

    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [createAdvertisementDbRow(advertisement)]
    });

    const result = await repository.findById(100);

    expect(result).toEqual(advertisement);

    expect(queryMock).toHaveBeenCalledTimes(1);

    expect(queryMock.mock.calls[0]?.[1]).toEqual([100]);
  });

  it("should return null when the advertisement does not exist", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 0,
      rows: []
    });

    const result = await repository.findById(999);

    expect(result).toBeNull();
  });
});

describe("create()", () => {
  it("should create and load an advertisement", async () => {
    const advertisement = createAdvertisement();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 100 }]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createAdvertisementDbRow(advertisement)]
      });

    const input = {
      clientId: 1,
      name: "Test Advertisement",
      destinationUrl: "https://example.com",
      advertisementType: "DISPLAY" as const,
      priority: 0,
      isClickable: true,
      openInNewTab: true
    };

    const result = await repository.create(input, 10);

    expect(result).toEqual(advertisement);

    expect(queryMock).toHaveBeenCalledTimes(2);

    expect(queryMock.mock.calls[0]?.[1]).toEqual([
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
    ]);

    expect(queryMock.mock.calls[1]?.[1]).toEqual([100]);
  });

  it("should create with pricing fields when calculated pricing is supplied", async () => {
    const advertisement = createAdvertisement();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 100 }]
      })
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
      });

    const input = {
      clientId: 1,
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
  });

  it("should throw when the client does not exist", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 0,
      rows: []
    });

    const input = {
      clientId: 999,
      name: "Test Advertisement",
      destinationUrl: "https://example.com",
      advertisementType: "DISPLAY" as const
    };

    await expect(repository.create(input, 10)).rejects.toThrow(
      "Advertisement client was not found."
    );

    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("should throw when the inserted advertisement ID is not returned", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: []
    });

    const input = {
      clientId: 1,
      name: "Test Advertisement",
      destinationUrl: "https://example.com",
      advertisementType: "DISPLAY" as const
    };

    await expect(repository.create(input, 10)).rejects.toThrow(
      "Advertisement was created but its ID was not returned."
    );

    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("should throw when the created advertisement cannot be loaded", async () => {
    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 100 }]
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });

    const input = {
      clientId: 1,
      name: "Test Advertisement",
      destinationUrl: "https://example.com",
      advertisementType: "DISPLAY" as const
    };

    await expect(repository.create(input, 10)).rejects.toThrow(
      "Advertisement was created but could not be loaded."
    );

    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});

describe("update()", () => {
  it("should return the existing advertisement when there are no update fields", async () => {
    const advertisement = createAdvertisement();

    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [createAdvertisementDbRow(advertisement)]
    });

    const result = await repository.update(100, {}, 20);

    expect(result).toEqual(advertisement);

    expect(queryMock).toHaveBeenCalledTimes(1);

    expect(queryMock.mock.calls[0]?.[1]).toEqual([100]);
  });

  it("should update an advertisement", async () => {
    const advertisement = createAdvertisement();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 100 }]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [createAdvertisementDbRow(advertisement)]
      });

    const input = {
      name: "Updated Advertisement",
      priority: 5,
      destinationUrl: "https://example.com/updated"
    };

    const result = await repository.update(100, input, 20);

    expect(result).toEqual(advertisement);

    expect(queryMock).toHaveBeenCalledTimes(2);

    expect(queryMock.mock.calls[0]?.[1]).toEqual([
      "Updated Advertisement",
      "https://example.com/updated",
      5,
      20,
      100
    ]);

    expect(queryMock.mock.calls[1]?.[1]).toEqual([100]);
  });

  it("should return null when the advertisement does not exist", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 0,
      rows: []
    });

    const result = await repository.update(
      999,
      {
        name: "Updated Advertisement"
      },
      20
    );

    expect(result).toBeNull();
  });

  it("should return null when the update does not return an ID", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: []
    });

    const result = await repository.update(
      100,
      {
        name: "Updated Advertisement"
      },
      20
    );

    expect(result).toBeNull();
  });
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
