import { beforeEach, describe, expect, it, vi } from "vitest";

const { connectMock, queryMock, releaseMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  queryMock: vi.fn(),
  releaseMock: vi.fn()
}));

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: queryMock,
    connect: connectMock
  }
}));

import * as repository from "../advertisement.repository.js";
import * as service from "../advertisement.service.js";

import type {
  Advertisement,
  AdvertisementClient,
  AdvertisementListItem,
  AdvertisementWorkflowHistory,
  UpdateAdvertisementInput
} from "../advertisement.types.js";

import type { AdvertisementRuntimePlacement } from "../advertisement.repository.js";

vi.mock("../advertisement.repository.js", () => ({
  findClientById: vi.fn(),
  findById: vi.fn(),
  findByIdForUpdate: vi.fn(),
  existsCampaignById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  list: vi.fn(),
  changeWorkflowStatus: vi.fn(),
  createWorkflowHistory: vi.fn(),
  findWorkflowHistory: vi.fn()
}));

const mockClient = {
  query: queryMock,
  release: releaseMock
};

const createClient = (
  overrides: Partial<AdvertisementClient> = {}
): AdvertisementClient => ({
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
  updatedAt: new Date("2026-09-01T10:00:00Z"),
  ...overrides
});

/*
 * ============================================================================
 * DEFAULT TEST PLACEMENT
 * ============================================================================
 *
 * The production advertisement service requires a valid placement during
 * advertisement creation and requires an existing persisted placement during
 * updates when no new placementId is supplied.
 *
 * Keep one reusable runtime placement fixture so tests that are not explicitly
 * testing placement validation can operate with a valid advertisement.
 */
const createRuntimePlacement = (
  overrides: Partial<AdvertisementRuntimePlacement> = {}
): AdvertisementRuntimePlacement =>
  ({
    id: 10,
    placementId: 10,
    placementCode: "TEST_HOME_TOP",
    pageType: "HOME",
    placementType: "HOME_TOP",
    insertionType: "FIXED",
    formatId: null,
    format: null,
    ...overrides
  }) as AdvertisementRuntimePlacement;

/*
 * ============================================================================
 * DATABASE PLACEMENT ROW
 * ============================================================================
 *
 * validatePlacementSelection() now performs a direct pool.query() and expects
 * a PostgreSQL result containing rows.
 *
 * The service-level tests mock the database, so provide a valid placement row
 * as the default query result. Individual transaction tests can still override
 * this using mockResolvedValueOnce(), which takes precedence over the default
 * implementation.
 *
 * Both the database-style snake_case fields and the runtime-style fields are
 * supplied intentionally because the placement validation/repository layer
 * may consume the database row directly.
 */
const createPlacementQueryResult = () => ({
  rows: [
    {
      id: 10,
      placement_id: 10,
      placement_code: "TEST_HOME_TOP",
      placement_name: "Test Home Top",
      page_type: "HOME",
      placement_type: "HOME_TOP",
      insertion_type: "FIXED",
      format_id: null,
      format: null,
      is_enabled: true,
      status: "ACTIVE"
    }
  ]
});

const createAdvertisement = (
  overrides: Partial<Advertisement> = {}
): Advertisement & {
  placement: AdvertisementRuntimePlacement | null;
} => ({
  id: 100,
  advertiserId: 1,
  clientId: 1,

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
  pricingPlacementId: 10,
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

  isHouseAd: false,

  createdBy: 1,
  updatedBy: null,

  createdAt: new Date("2026-09-01T10:00:00Z"),
  updatedAt: new Date("2026-09-01T10:00:00Z"),

  client: createClient(),

  /*
   * The service requires the advertisement to have a persisted placement
   * when an update does not explicitly provide a new placement.
   */
  placement: createRuntimePlacement(),

  ...overrides
});

const createAdvertisementListItem = (
  overrides: Partial<AdvertisementListItem> = {}
): AdvertisementListItem => ({
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
  updatedAt: new Date("2026-09-01T10:00:00Z"),

  ...overrides
});

const createWorkflowHistory = (
  overrides: Partial<AdvertisementWorkflowHistory> = {}
): AdvertisementWorkflowHistory => ({
  id: 1,
  advertisementId: 100,

  fromStatus: "ARCHIVED",
  toStatus: "DRAFT",

  remarks: "Reactivating archived advertisement for reuse.",

  performedBy: 20,

  performedAt: new Date("2026-09-10T10:00:00Z"),

  ...overrides
});

const baseCreateInput = {
  clientId: 1,
  name: "Test Advertisement",
  destinationUrl: "https://example.com",
  advertisementType: "DISPLAY" as const,
  isClickable: true,
  priority: 0,

  /*
   * Placement is mandatory for advertisement creation.
   */
  placementId: 10
};

const calculatedDefaultFinancials = {
  discountPercentage: 0,
  advancePercentage: 0,
  discountAmount: 0,
  advanceAmount: 0
};

beforeEach(() => {
  vi.clearAllMocks();

  connectMock.mockResolvedValue(mockClient);

  /*
   * validatePlacementSelection() performs pool.query().
   *
   * Provide a valid placement result by default so normal creation tests
   * exercise the actual service flow instead of failing because the database
   * mock returned undefined.
   *
   * Tests which explicitly queue mockResolvedValueOnce() continue to override
   * this default result.
   */
  queryMock.mockResolvedValue(createPlacementQueryResult());
});

describe("createAdvertisement()", () => {
  it("should create an advertisement successfully", async () => {
    vi.mocked(repository.findClientById).mockResolvedValueOnce(createClient());

    vi.mocked(repository.create).mockResolvedValueOnce(createAdvertisement());

    const result = await service.createAdvertisement(baseCreateInput, 10);

    expect(repository.findClientById).toHaveBeenCalledWith(1);

    expect(repository.create).toHaveBeenCalledWith(
      {
        ...baseCreateInput,
        ...calculatedDefaultFinancials
      },
      10
    );

    expect(result.id).toBe(100);
  });

  it("should create an advertisement with calculated pricing fields", async () => {
    const pricedAdvertisement = createAdvertisement({
      standardAmount: 5000,
      pricingPlacementId: 10,
      pricingUnit: "DAY",
      pricingQuantity: 5
    });

    vi.mocked(repository.findClientById).mockResolvedValueOnce(createClient());

    vi.mocked(repository.create).mockResolvedValueOnce(pricedAdvertisement);

    /*
     * This test verifies the Advertisement model contract.
     *
     * The actual 8C-9D calculation/transaction orchestration belongs
     * to the production service implementation and its pricing
     * repository/service mocks.
     */
    const result = await service.createAdvertisement(baseCreateInput, 10);

    expect(result.standardAmount).toBe(5000);
    expect(result.pricingPlacementId).toBe(10);
    expect(result.pricingUnit).toBe("DAY");
    expect(result.pricingQuantity).toBe(5);
  });

  it("should throw 404 when the client does not exist", async () => {
    vi.mocked(repository.findClientById).mockResolvedValueOnce(null);

    await expect(
      service.createAdvertisement(baseCreateInput, 10)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Advertisement client not found."
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should reject creation for an inactive client", async () => {
    vi.mocked(repository.findClientById).mockResolvedValueOnce(
      createClient({
        status: "INACTIVE"
      })
    );

    await expect(
      service.createAdvertisement(baseCreateInput, 10)
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Advertisement cannot be created for an inactive or blocked client."
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should reject creation for a blocked client", async () => {
    vi.mocked(repository.findClientById).mockResolvedValueOnce(
      createClient({
        status: "BLOCKED"
      })
    );

    await expect(
      service.createAdvertisement(baseCreateInput, 10)
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Advertisement cannot be created for an inactive or blocked client."
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should reject creation when the client has an advertisement creation hold", async () => {
    vi.mocked(repository.findClientById).mockResolvedValueOnce(
      createClient({
        adCreationHold: true,
        adCreationHoldReason: "Pending payment"
      })
    );

    await expect(
      service.createAdvertisement(baseCreateInput, 10)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Advertisement creation is currently on hold: Pending payment"
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should reject creation when the client has a hold without a reason", async () => {
    vi.mocked(repository.findClientById).mockResolvedValueOnce(
      createClient({
        adCreationHold: true,
        adCreationHoldReason: null
      })
    );

    await expect(
      service.createAdvertisement(baseCreateInput, 10)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Advertisement creation is currently on hold for this client."
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should check campaign existence when campaignId is supplied", async () => {
    vi.mocked(repository.findClientById).mockResolvedValueOnce(createClient());

    vi.mocked(repository.existsCampaignById).mockResolvedValueOnce(true);

    vi.mocked(repository.create).mockResolvedValueOnce(
      createAdvertisement({
        campaignId: 50
      })
    );

    const input = {
      ...baseCreateInput,
      campaignId: 50
    };

    await service.createAdvertisement(input, 10);

    expect(repository.existsCampaignById).toHaveBeenCalledWith(50);

    expect(repository.create).toHaveBeenCalledWith(
      {
        ...input,
        ...calculatedDefaultFinancials
      },
      10
    );
  });

  it("should throw 404 when the supplied campaign does not exist", async () => {
    vi.mocked(repository.findClientById).mockResolvedValueOnce(createClient());

    vi.mocked(repository.existsCampaignById).mockResolvedValueOnce(false);

    const input = {
      ...baseCreateInput,
      campaignId: 999
    };

    await expect(service.createAdvertisement(input, 10)).rejects.toMatchObject({
      statusCode: 404,
      message: "Advertisement campaign not found."
    });

    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("getAdvertisementById()", () => {
  it("should return an advertisement", async () => {
    const advertisement = createAdvertisement();

    vi.mocked(repository.findById).mockResolvedValueOnce(advertisement);

    const result = await service.getAdvertisementById(100);

    expect(repository.findById).toHaveBeenCalledWith(100);

    expect(result).toEqual(advertisement);
  });

  it("should throw 404 when the advertisement does not exist", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(null);

    await expect(service.getAdvertisementById(999)).rejects.toMatchObject({
      statusCode: 404,
      message: "Advertisement not found."
    });
  });
});

describe("getAdvertisements()", () => {
  it("should return paginated advertisements from the repository", async () => {
    const filters = {
      page: 1,
      pageSize: 20,
      search: "homepage"
    };

    const result = {
      items: [createAdvertisementListItem()],
      total: 1
    };

    vi.mocked(repository.list).mockResolvedValueOnce(result);

    const response = await service.getAdvertisements(filters);

    expect(repository.list).toHaveBeenCalledWith(filters);

    expect(response).toEqual(result);
  });
});

describe("updateAdvertisement()", () => {
  it("should update a draft advertisement successfully", async () => {
    const advertisement = createAdvertisement({
      workflowStatus: "DRAFT"
    });

    const updatedAdvertisement = createAdvertisement({
      name: "Updated Advertisement"
    });

    vi.mocked(repository.findById).mockResolvedValueOnce(advertisement);

    vi.mocked(repository.update).mockResolvedValueOnce(updatedAdvertisement);

    const input = {
      name: "Updated Advertisement"
    };

    const result = await service.updateAdvertisement(100, input, 20);

    expect(repository.findById).toHaveBeenCalledWith(100);

    expect(repository.update).toHaveBeenCalledWith(
      100,
      {
        ...input,
        advertisementAmount: 10000,
        ...calculatedDefaultFinancials
      },
      20
    );

    expect(result).toEqual(updatedAdvertisement);
  });

  it("should throw 404 when updating an unknown advertisement", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(null);

    await expect(
      service.updateAdvertisement(
        999,
        {
          name: "Updated Advertisement"
        },
        20
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Advertisement not found."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should reject editing an approved advertisement", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(
      createAdvertisement({
        workflowStatus: "APPROVED"
      })
    );

    await expect(
      service.updateAdvertisement(
        100,
        {
          name: "Attempted Update"
        },
        20
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Approved advertisements cannot be edited."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should reject editing a submitted advertisement", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(
      createAdvertisement({
        workflowStatus: "SUBMITTED"
      })
    );

    await expect(
      service.updateAdvertisement(
        100,
        {
          name: "Attempted Update"
        },
        20
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Submitted advertisements cannot be edited until the review workflow changes their status."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should reject editing an archived advertisement", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(
      createAdvertisement({
        workflowStatus: "ARCHIVED"
      })
    );

    await expect(
      service.updateAdvertisement(
        100,
        {
          name: "Attempted Update"
        },
        20
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Archived advertisements cannot be edited."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should check campaign existence when changing the campaign", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(createAdvertisement());

    vi.mocked(repository.existsCampaignById).mockResolvedValueOnce(true);

    vi.mocked(repository.update).mockResolvedValueOnce(
      createAdvertisement({
        campaignId: 25
      })
    );

    const input = {
      campaignId: 25
    };

    await service.updateAdvertisement(100, input, 20);

    expect(repository.existsCampaignById).toHaveBeenCalledWith(25);

    expect(repository.update).toHaveBeenCalledWith(
      100,
      {
        ...input,
        advertisementAmount: 10000,
        ...calculatedDefaultFinancials
      },
      20
    );
  });

  it("should reject an unknown campaign during update", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(createAdvertisement());

    vi.mocked(repository.existsCampaignById).mockResolvedValueOnce(false);

    await expect(
      service.updateAdvertisement(
        100,
        {
          campaignId: 999
        },
        20
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Advertisement campaign not found."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should reject making an advertisement clickable when it has no destination URL", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(
      createAdvertisement({
        isClickable: false,
        destinationUrl: null
      })
    );

    await expect(
      service.updateAdvertisement(
        100,
        {
          isClickable: true
        },
        20
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Destination URL is required when the advertisement is clickable."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should allow disabling clickability without a destination URL", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(
      createAdvertisement({
        isClickable: true,
        destinationUrl: "https://example.com"
      })
    );

    vi.mocked(repository.update).mockResolvedValueOnce(
      createAdvertisement({
        isClickable: false,
        destinationUrl: null
      })
    );

    const input: UpdateAdvertisementInput = {
      isClickable: false
    };

    await service.updateAdvertisement(100, input, 20);

    expect(repository.update).toHaveBeenCalledWith(
      100,
      {
        ...input,
        advertisementAmount: 10000,
        ...calculatedDefaultFinancials
      },
      20
    );
  });

  it("should reject an update that creates an invalid date range", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(
      createAdvertisement({
        startAt: new Date("2026-10-01T09:00:00Z"),
        endAt: new Date("2026-10-10T18:00:00Z")
      })
    );

    await expect(
      service.updateAdvertisement(
        100,
        {
          endAt: "2026-09-01T18:00:00Z"
        },
        20
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "End date/time must be after start date/time."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should allow a valid schedule update", async () => {
    const advertisement = createAdvertisement({
      startAt: new Date("2026-10-01T09:00:00Z"),
      endAt: new Date("2026-10-10T18:00:00Z")
    });

    const updatedAdvertisement = createAdvertisement({
      startAt: new Date("2026-11-01T09:00:00Z"),
      endAt: new Date("2026-11-10T18:00:00Z")
    });

    vi.mocked(repository.findById).mockResolvedValueOnce(advertisement);

    vi.mocked(repository.update).mockResolvedValueOnce(updatedAdvertisement);

    const input = {
      startAt: "2026-11-01T09:00:00Z",
      endAt: "2026-11-10T18:00:00Z"
    };

    const result = await service.updateAdvertisement(100, input, 20);

    expect(repository.update).toHaveBeenCalledWith(
      100,
      {
        ...input,
        advertisementAmount: 10000,
        ...calculatedDefaultFinancials
      },
      20
    );

    expect(result).toEqual(updatedAdvertisement);
  });

  it("should throw 404 when repository update returns null", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(createAdvertisement());

    vi.mocked(repository.update).mockResolvedValueOnce(null);

    await expect(
      service.updateAdvertisement(
        100,
        {
          name: "Updated Advertisement"
        },
        20
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Advertisement not found."
    });
  });
});

describe("activateAdvertisement()", () => {
  it("should activate an archived advertisement and return it as DRAFT", async () => {
    const archivedAdvertisement = createAdvertisement({
      status: "ARCHIVED",
      workflowStatus: "ARCHIVED"
    });

    const activatedAdvertisement = createAdvertisement({
      status: "DRAFT",
      workflowStatus: "DRAFT"
    });

    const history = createWorkflowHistory();

    queryMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    vi.mocked(repository.findByIdForUpdate).mockResolvedValueOnce(
      archivedAdvertisement
    );

    vi.mocked(repository.changeWorkflowStatus).mockResolvedValueOnce(
      activatedAdvertisement
    );

    vi.mocked(repository.createWorkflowHistory).mockResolvedValueOnce(history);

    const remarks = "Reactivating archived advertisement for reuse.";

    const result = await service.activateAdvertisement(100, 20, {
      remarks
    });

    expect(repository.findByIdForUpdate).toHaveBeenCalledWith(100, mockClient);

    expect(repository.changeWorkflowStatus).toHaveBeenCalledWith(
      100,
      "ARCHIVED",
      "DRAFT",
      20,
      remarks,
      mockClient
    );

    expect(repository.createWorkflowHistory).toHaveBeenCalledWith(
      100,
      "ARCHIVED",
      "DRAFT",
      remarks,
      20,
      mockClient
    );

    expect(result).toEqual({
      advertisement: activatedAdvertisement,
      history
    });

    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("should reject activation when the advertisement is not archived", async () => {
    const rejectedAdvertisement = createAdvertisement({
      workflowStatus: "REJECTED",
      status: "DRAFT"
    });

    queryMock.mockResolvedValueOnce(undefined);

    vi.mocked(repository.findByIdForUpdate).mockResolvedValueOnce(
      rejectedAdvertisement
    );

    await expect(
      service.activateAdvertisement(100, 20, {
        remarks: "Attempted activation."
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Invalid advertisement workflow transition from 'REJECTED' to 'DRAFT'."
    });

    expect(repository.changeWorkflowStatus).not.toHaveBeenCalled();

    expect(repository.createWorkflowHistory).not.toHaveBeenCalled();

    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("should throw 404 when activating an unknown advertisement", async () => {
    queryMock.mockResolvedValueOnce(undefined);

    vi.mocked(repository.findByIdForUpdate).mockResolvedValueOnce(null);

    await expect(
      service.activateAdvertisement(999, 20, {
        remarks: "Activation attempt."
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Advertisement not found."
    });

    expect(repository.changeWorkflowStatus).not.toHaveBeenCalled();

    expect(repository.createWorkflowHistory).not.toHaveBeenCalled();

    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("should require remarks when activation is requested without remarks", async () => {
    const archivedAdvertisement = createAdvertisement({
      status: "ARCHIVED",
      workflowStatus: "ARCHIVED"
    });

    queryMock.mockResolvedValueOnce(undefined);

    vi.mocked(repository.findByIdForUpdate).mockResolvedValueOnce(
      archivedAdvertisement
    );

    await expect(
      service.activateAdvertisement(100, 20, {})
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Remarks are required for this workflow transition."
    });

    expect(repository.changeWorkflowStatus).not.toHaveBeenCalled();

    expect(repository.createWorkflowHistory).not.toHaveBeenCalled();

    expect(releaseMock).not.toHaveBeenCalled();
  });
});
