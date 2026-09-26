import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";

import * as repository from "../financial-approval-threshold.repository.js";
import {
  activate,
  create,
  deactivate,
  getActiveThreshold,
  getById,
  list,
  update
} from "../financial-approval-threshold.service.js";

vi.mock("../financial-approval-threshold.repository.js", () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findActiveByApprovalType: vi.fn(),
  findActiveByApprovalTypeForUpdate: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
  deactivateActiveForApprovalType: vi.fn(),
  countActiveByApprovalType: vi.fn()
}));

const mockedRepository = vi.mocked(repository);

const createThresholdFixture = () => ({
  id: 100,
  approvalType: "DISCOUNT" as const,
  amountThreshold: 5000,
  percentageThreshold: null,
  status: "ACTIVE" as const,
  createdBy: 5,
  updatedBy: 5,
  createdAt: new Date("2026-09-24T10:00:00.000Z"),
  updatedAt: new Date("2026-09-24T10:00:00.000Z")
});

const expectApiError = async (
  promise: Promise<unknown>,
  statusCode: number,
  message: string
): Promise<void> => {
  await expect(promise).rejects.toMatchObject({
    statusCode,
    message
  });
};

describe("Financial Approval Threshold Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should list thresholds without filters", async () => {
      const thresholds = [createThresholdFixture()];

      mockedRepository.findAll.mockResolvedValue(thresholds);

      const result = await list();

      expect(result).toEqual(thresholds);
      expect(mockedRepository.findAll).toHaveBeenCalledWith({});
    });

    it("should list thresholds with valid filters", async () => {
      const thresholds = [createThresholdFixture()];

      mockedRepository.findAll.mockResolvedValue(thresholds);

      const result = await list({
        approvalType: "DISCOUNT",
        status: "ACTIVE"
      });

      expect(result).toEqual(thresholds);

      expect(mockedRepository.findAll).toHaveBeenCalledWith({
        approvalType: "DISCOUNT",
        status: "ACTIVE"
      });
    });

    it("should reject an invalid approval type", async () => {
      await expectApiError(
        list({
          approvalType: "INVALID" as never
        }),
        400,
        "Invalid financial approval threshold approval type."
      );

      expect(mockedRepository.findAll).not.toHaveBeenCalled();
    });

    it("should reject an invalid status", async () => {
      await expectApiError(
        list({
          status: "INVALID" as never
        }),
        400,
        "Invalid financial approval threshold status."
      );

      expect(mockedRepository.findAll).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("should return an existing threshold", async () => {
      const threshold = createThresholdFixture();

      mockedRepository.findById.mockResolvedValue(threshold);

      const result = await getById(100);

      expect(result).toEqual(threshold);
      expect(mockedRepository.findById).toHaveBeenCalledWith(100);
    });

    it("should reject a zero id", async () => {
      await expectApiError(getById(0), 400, "id must be a positive integer.");

      expect(mockedRepository.findById).not.toHaveBeenCalled();
    });

    it("should reject a negative id", async () => {
      await expectApiError(getById(-1), 400, "id must be a positive integer.");
    });

    it("should reject a non-integer id", async () => {
      await expectApiError(getById(1.5), 400, "id must be a positive integer.");
    });

    it("should return 404 when threshold does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expectApiError(
        getById(999),
        404,
        "Financial approval threshold not found."
      );
    });
  });

  describe("getActiveThreshold", () => {
    it("should return the active threshold", async () => {
      const threshold = createThresholdFixture();

      mockedRepository.findActiveByApprovalType.mockResolvedValue(threshold);

      const result = await getActiveThreshold("DISCOUNT");

      expect(result).toEqual(threshold);

      expect(mockedRepository.findActiveByApprovalType).toHaveBeenCalledWith(
        "DISCOUNT"
      );
    });

    it("should return null when no active threshold exists", async () => {
      mockedRepository.findActiveByApprovalType.mockResolvedValue(null);

      const result = await getActiveThreshold("REFUND");

      expect(result).toBeNull();
    });

    it("should reject an invalid approval type", async () => {
      await expectApiError(
        getActiveThreshold("INVALID" as never),
        400,
        "Invalid financial approval threshold approval type."
      );

      expect(mockedRepository.findActiveByApprovalType).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("should create an amount-based threshold", async () => {
      const input = {
        approvalType: "DISCOUNT" as const,
        amountThreshold: 5000
      };

      const threshold = createThresholdFixture();

      mockedRepository.countActiveByApprovalType.mockResolvedValue(0);
      mockedRepository.create.mockResolvedValue(threshold);

      const result = await create(input, 5);

      expect(result).toEqual(threshold);

      expect(mockedRepository.countActiveByApprovalType).toHaveBeenCalledWith(
        "DISCOUNT"
      );

      expect(mockedRepository.create).toHaveBeenCalledWith(input, 5);
    });

    it("should create a percentage-based threshold", async () => {
      const input = {
        approvalType: "DISCOUNT" as const,
        percentageThreshold: 10.5
      };

      const threshold = {
        ...createThresholdFixture(),
        amountThreshold: null,
        percentageThreshold: 10.5
      };

      mockedRepository.countActiveByApprovalType.mockResolvedValue(0);
      mockedRepository.create.mockResolvedValue(threshold);

      const result = await create(input, 5);

      expect(result).toEqual(threshold);
    });

    it("should reject an invalid createdBy user id", async () => {
      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT",
            amountThreshold: 5000
          },
          0
        ),
        400,
        "createdBy must be a positive integer."
      );

      expect(mockedRepository.countActiveByApprovalType).not.toHaveBeenCalled();
    });

    it("should reject an invalid approval type", async () => {
      await expectApiError(
        create(
          {
            approvalType: "INVALID" as never,
            amountThreshold: 5000
          },
          5
        ),
        400,
        "Invalid financial approval threshold approval type."
      );
    });

    it("should reject when neither threshold value is provided", async () => {
      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT"
          },
          5
        ),
        400,
        "At least one threshold value is required."
      );
    });

    it("should reject when both threshold values are provided", async () => {
      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT",
            amountThreshold: 5000,
            percentageThreshold: 10
          },
          5
        ),
        400,
        "Configure either amount threshold or percentage threshold, not both."
      );
    });

    it("should reject a zero amount threshold", async () => {
      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT",
            amountThreshold: 0
          },
          5
        ),
        400,
        "Amount threshold must be greater than zero."
      );
    });

    it("should reject a negative amount threshold", async () => {
      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT",
            amountThreshold: -100
          },
          5
        ),
        400,
        "Amount threshold must be greater than zero."
      );
    });

    it("should reject an amount with more than two decimals", async () => {
      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT",
            amountThreshold: 100.123
          },
          5
        ),
        400,
        "Amount threshold cannot have more than 2 decimal places."
      );
    });

    it("should reject a percentage above 100", async () => {
      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT",
            percentageThreshold: 100.01
          },
          5
        ),
        400,
        "Percentage threshold must be between 0 and 100."
      );
    });

    it("should reject a negative percentage", async () => {
      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT",
            percentageThreshold: -1
          },
          5
        ),
        400,
        "Percentage threshold must be between 0 and 100."
      );
    });

    it("should reject a percentage with more than two decimals", async () => {
      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT",
            percentageThreshold: 10.123
          },
          5
        ),
        400,
        "Percentage threshold cannot have more than 2 decimal places."
      );
    });

    it("should reject creation when an active threshold already exists", async () => {
      mockedRepository.countActiveByApprovalType.mockResolvedValue(1);

      await expectApiError(
        create(
          {
            approvalType: "DISCOUNT",
            amountThreshold: 5000
          },
          5
        ),
        409,
        "An active threshold already exists for DISCOUNT. Deactivate the existing threshold before creating a new active configuration."
      );

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update an existing active threshold", async () => {
      const current = createThresholdFixture();

      const updated = {
        ...current,
        amountThreshold: 7500,
        updatedBy: 7
      };

      mockedRepository.findById.mockResolvedValue(current);
      mockedRepository.countActiveByApprovalType.mockResolvedValue(0);
      mockedRepository.update.mockResolvedValue(updated);

      const result = await update(
        100,
        {
          amountThreshold: 7500
        },
        7
      );

      expect(result).toEqual(updated);

      expect(mockedRepository.update).toHaveBeenCalledWith(
        100,
        {
          amountThreshold: 7500,
          approvalType: "DISCOUNT",
          percentageThreshold: null
        },
        7
      );
    });

    it("should reject an invalid id", async () => {
      await expectApiError(
        update(
          0,
          {
            amountThreshold: 5000
          },
          7
        ),
        400,
        "id must be a positive integer."
      );
    });

    it("should reject an invalid updatedBy user id", async () => {
      await expectApiError(
        update(
          100,
          {
            amountThreshold: 5000
          },
          0
        ),
        400,
        "updatedBy must be a positive integer."
      );
    });

    it("should return 404 when threshold does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expectApiError(
        update(
          999,
          {
            amountThreshold: 5000
          },
          7
        ),
        404,
        "Financial approval threshold not found."
      );
    });

    it("should reject an invalid approval type", async () => {
      mockedRepository.findById.mockResolvedValue(createThresholdFixture());

      await expectApiError(
        update(
          100,
          {
            approvalType: "INVALID" as never
          },
          7
        ),
        400,
        "Invalid financial approval threshold approval type."
      );
    });

    it("should reject an update containing both threshold types", async () => {
      mockedRepository.findById.mockResolvedValue(createThresholdFixture());

      await expectApiError(
        update(
          100,
          {
            amountThreshold: 5000,
            percentageThreshold: 10
          },
          7
        ),
        400,
        "Configure either amount threshold or percentage threshold, not both."
      );
    });

    it("should reject changing an active threshold to a type with another active threshold", async () => {
      mockedRepository.findById.mockResolvedValue(createThresholdFixture());

      mockedRepository.countActiveByApprovalType.mockResolvedValue(1);

      await expectApiError(
        update(
          100,
          {
            approvalType: "REFUND"
          },
          7
        ),
        409,
        "Another active threshold already exists for REFUND."
      );

      expect(mockedRepository.update).not.toHaveBeenCalled();
    });

    it("should allow updating an inactive threshold to an approval type with an active threshold", async () => {
      const inactiveThreshold = {
        ...createThresholdFixture(),
        status: "INACTIVE" as const
      };

      const updatedThreshold = {
        ...inactiveThreshold,
        approvalType: "REFUND" as const,
        amountThreshold: 2500,
        updatedBy: 7
      };

      mockedRepository.findById.mockResolvedValue(inactiveThreshold);

      mockedRepository.update.mockResolvedValue(updatedThreshold);

      const result = await update(
        100,
        {
          approvalType: "REFUND",
          amountThreshold: 2500
        },
        7
      );

      expect(result).toEqual(updatedThreshold);

      expect(mockedRepository.countActiveByApprovalType).not.toHaveBeenCalled();
    });

    it("should throw 404 if repository update returns null", async () => {
      mockedRepository.findById.mockResolvedValue(createThresholdFixture());

      mockedRepository.countActiveByApprovalType.mockResolvedValue(0);
      mockedRepository.update.mockResolvedValue(null);

      await expectApiError(
        update(
          100,
          {
            amountThreshold: 7500
          },
          7
        ),
        404,
        "Financial approval threshold not found."
      );
    });
  });

  describe("activate", () => {
    it("should activate an inactive threshold", async () => {
      const current = {
        ...createThresholdFixture(),
        status: "INACTIVE" as const
      };

      const activated = {
        ...current,
        status: "ACTIVE" as const,
        updatedBy: 7
      };

      mockedRepository.findById.mockResolvedValue(current);
      mockedRepository.findActiveByApprovalType.mockResolvedValue(null);
      mockedRepository.activate.mockResolvedValue(activated);

      const result = await activate(100, 7);

      expect(result).toEqual(activated);

      expect(mockedRepository.findActiveByApprovalType).toHaveBeenCalledWith(
        "DISCOUNT"
      );

      expect(mockedRepository.activate).toHaveBeenCalledWith(100, 7);
    });

    it("should reject an invalid id", async () => {
      await expectApiError(
        activate(0, 7),
        400,
        "id must be a positive integer."
      );
    });

    it("should reject an invalid updatedBy id", async () => {
      await expectApiError(
        activate(100, 0),
        400,
        "updatedBy must be a positive integer."
      );
    });

    it("should return 404 when threshold does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expectApiError(
        activate(999, 7),
        404,
        "Financial approval threshold not found."
      );
    });

    it("should reject an already active threshold", async () => {
      mockedRepository.findById.mockResolvedValue(createThresholdFixture());

      await expectApiError(
        activate(100, 7),
        409,
        "Financial approval threshold is already active."
      );

      expect(mockedRepository.findActiveByApprovalType).not.toHaveBeenCalled();
    });

    it("should reject activation when another active threshold exists", async () => {
      const current = {
        ...createThresholdFixture(),
        status: "INACTIVE" as const
      };

      const existingActive = {
        ...createThresholdFixture(),
        id: 101
      };

      mockedRepository.findById.mockResolvedValue(current);
      mockedRepository.findActiveByApprovalType.mockResolvedValue(
        existingActive
      );

      await expectApiError(
        activate(100, 7),
        409,
        "An active threshold already exists for DISCOUNT. Deactivate it before activating this configuration."
      );

      expect(mockedRepository.activate).not.toHaveBeenCalled();
    });

    it("should return 404 if repository activation returns null", async () => {
      const current = {
        ...createThresholdFixture(),
        status: "INACTIVE" as const
      };

      mockedRepository.findById.mockResolvedValue(current);
      mockedRepository.findActiveByApprovalType.mockResolvedValue(null);
      mockedRepository.activate.mockResolvedValue(null);

      await expectApiError(
        activate(100, 7),
        404,
        "Financial approval threshold not found."
      );
    });
  });

  describe("deactivate", () => {
    it("should deactivate an active threshold", async () => {
      const current = createThresholdFixture();

      const deactivated = {
        ...current,
        status: "INACTIVE" as const,
        updatedBy: 7
      };

      mockedRepository.findById.mockResolvedValue(current);
      mockedRepository.deactivate.mockResolvedValue(deactivated);

      const result = await deactivate(100, 7);

      expect(result).toEqual(deactivated);

      expect(mockedRepository.deactivate).toHaveBeenCalledWith(100, 7);
    });

    it("should reject an invalid id", async () => {
      await expectApiError(
        deactivate(0, 7),
        400,
        "id must be a positive integer."
      );
    });

    it("should reject an invalid updatedBy id", async () => {
      await expectApiError(
        deactivate(100, 0),
        400,
        "updatedBy must be a positive integer."
      );
    });

    it("should return 404 when threshold does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expectApiError(
        deactivate(999, 7),
        404,
        "Financial approval threshold not found."
      );
    });

    it("should reject an already inactive threshold", async () => {
      mockedRepository.findById.mockResolvedValue({
        ...createThresholdFixture(),
        status: "INACTIVE" as const
      });

      await expectApiError(
        deactivate(100, 7),
        409,
        "Financial approval threshold is already inactive."
      );

      expect(mockedRepository.deactivate).not.toHaveBeenCalled();
    });

    it("should return 404 if repository deactivation returns null", async () => {
      mockedRepository.findById.mockResolvedValue(createThresholdFixture());

      mockedRepository.deactivate.mockResolvedValue(null);

      await expectApiError(
        deactivate(100, 7),
        404,
        "Financial approval threshold not found."
      );
    });
  });
});
