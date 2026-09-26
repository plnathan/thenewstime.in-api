import { beforeEach, describe, expect, it, vi } from "vitest";

import * as repository from "../financial-approval.repository.js";
import * as service from "../financial-approval.service.js";

import type {
  AdvertisementFinancialApproval,
  AdvertisementFinancialApprovalHistory,
  AdvertisementFinancialApprovalListResult,
  CreateAdvertisementFinancialApprovalInput
} from "../financial-approval.types.js";

vi.mock("../financial-approval.repository.js", () => ({
  findById: vi.fn(),
  create: vi.fn(),
  updateApprovalRemarks: vi.fn(),
  hold: vi.fn(),
  reject: vi.fn(),
  approve: vi.fn(),
  resubmit: vi.fn(),
  createHistory: vi.fn(),
  findHistoryByApprovalId: vi.fn(),
  exists: vi.fn(),
  existsForAdvertisement: vi.fn(),
  findLatestByAdvertisementId: vi.fn(),
  findPendingByAdvertisementId: vi.fn(),
  findPendingByPaymentId: vi.fn(),
  list: vi.fn()
}));

const mockedRepository = vi.mocked(repository);

const TEST_USER_ID = 5;
const TEST_REVIEWER_ID = 7;
const TEST_APPROVAL_ID = 100;
const TEST_ADVERTISEMENT_ID = 10;
const TEST_CLIENT_ID = 20;
const TEST_PAYMENT_ID = 50;

function createApproval(
  overrides: Partial<AdvertisementFinancialApproval> = {}
): AdvertisementFinancialApproval {
  return {
    id: TEST_APPROVAL_ID,
    advertisementId: TEST_ADVERTISEMENT_ID,
    clientId: TEST_CLIENT_ID,
    paymentId: TEST_PAYMENT_ID,
    approvalType: "DISCOUNT",
    requestedAmount: 5000,
    requestedPercentage: null,
    status: "SUBMITTED",
    requestedBy: TEST_USER_ID,
    requestedAt: new Date("2026-09-23T10:00:00.000Z"),
    reviewedBy: null,
    reviewedAt: null,
    holdReason: null,
    rejectionReason: null,
    approvalRemarks: "Discount approval requested",
    createdAt: new Date("2026-09-23T10:00:00.000Z"),
    updatedAt: new Date("2026-09-23T10:00:00.000Z"),
    ...overrides
  };
}

function createHistory(
  overrides: Partial<AdvertisementFinancialApprovalHistory> = {}
): AdvertisementFinancialApprovalHistory {
  return {
    id: 1,
    approvalId: TEST_APPROVAL_ID,
    fromStatus: null,
    toStatus: "SUBMITTED",
    actionBy: TEST_USER_ID,
    actionAt: new Date("2026-09-23T10:00:00.000Z"),
    remarks: "Approval requested",
    holdReason: null,
    rejectionReason: null,
    ...overrides
  };
}

function createCreateInput(
  overrides: Partial<CreateAdvertisementFinancialApprovalInput> = {}
): CreateAdvertisementFinancialApprovalInput {
  return {
    advertisementId: TEST_ADVERTISEMENT_ID,
    clientId: TEST_CLIENT_ID,
    paymentId: TEST_PAYMENT_ID,
    approvalType: "DISCOUNT",
    requestedAmount: 5000,
    approvalRemarks: "Discount approval requested",
    ...overrides
  };
}

function expectApiError(
  error: unknown,
  statusCode: number,
  message: string
): void {
  expect(error).toMatchObject({
    statusCode,
    message
  });
}

describe("Advertisement Financial Approval Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedRepository.findPendingByAdvertisementId.mockResolvedValue(null);
    mockedRepository.createHistory.mockResolvedValue(createHistory());
  });

  /*
   * ===========================================================================
   * GET BY ID
   * ===========================================================================
   */

  describe("getById", () => {
    it("should return the financial approval when it exists", async () => {
      const approval = createApproval();

      mockedRepository.findById.mockResolvedValue(approval);

      const result = await service.getById(TEST_APPROVAL_ID);

      expect(result).toEqual(approval);
      expect(mockedRepository.findById).toHaveBeenCalledWith(TEST_APPROVAL_ID);
    });

    it("should reject an invalid approval id", async () => {
      await expect(service.getById(0)).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "id must be a positive integer.");

        return true;
      });

      expect(mockedRepository.findById).not.toHaveBeenCalled();
    });

    it("should reject a non-integer approval id", async () => {
      await expect(service.getById(1.5)).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "id must be a positive integer.");

        return true;
      });

      expect(mockedRepository.findById).not.toHaveBeenCalled();
    });

    it("should return 404 when the approval does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(service.getById(TEST_APPROVAL_ID)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(error, 404, "Financial approval not found.");

          return true;
        }
      );
    });
  });

  /*
   * ===========================================================================
   * CREATE
   * ===========================================================================
   */

  describe("create", () => {
    it("should create a financial approval successfully", async () => {
      const input = createCreateInput();
      const approval = createApproval();

      mockedRepository.create.mockResolvedValue(approval);

      const result = await service.create(input, TEST_USER_ID);

      expect(result).toEqual(approval);

      expect(
        mockedRepository.findPendingByAdvertisementId
      ).toHaveBeenCalledWith(TEST_ADVERTISEMENT_ID);

      expect(mockedRepository.create).toHaveBeenCalledWith(
        {
          advertisementId: TEST_ADVERTISEMENT_ID,
          clientId: TEST_CLIENT_ID,
          paymentId: TEST_PAYMENT_ID,
          approvalType: "DISCOUNT",
          requestedAmount: 5000,
          requestedPercentage: null,
          approvalRemarks: "Discount approval requested"
        },
        TEST_USER_ID
      );

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        null,
        "SUBMITTED",
        5,
        "Discount approval requested",
        null,
        null
      );
    });

    it("should allow creation without paymentId", async () => {
      const input = createCreateInput({
        paymentId: null
      });

      const approval = createApproval({
        paymentId: null
      });

      mockedRepository.create.mockResolvedValue(approval);

      const result = await service.create(input, TEST_USER_ID);

      expect(result).toEqual(approval);

      expect(mockedRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: null
        }),
        TEST_USER_ID
      );
    });

    it("should trim approval remarks before creating the approval", async () => {
      const input = createCreateInput({
        approvalRemarks: "   Discount requested   "
      });

      const approval = createApproval({
        approvalRemarks: "Discount requested"
      });

      mockedRepository.create.mockResolvedValue(approval);

      await service.create(input, TEST_USER_ID);

      expect(mockedRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalRemarks: "Discount requested"
        }),
        TEST_USER_ID
      );

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        null,
        "SUBMITTED",
        5,
        "Discount requested",
        null,
        null
      );
    });

    it("should normalize blank approval remarks to null", async () => {
      const input = createCreateInput({
        approvalRemarks: "   "
      });

      mockedRepository.create.mockResolvedValue(
        createApproval({
          approvalRemarks: null
        })
      );

      await service.create(input, TEST_USER_ID);

      expect(mockedRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalRemarks: null
        }),
        TEST_USER_ID
      );
    });

    it("should reject an invalid requestedBy id", async () => {
      await expect(service.create(createCreateInput(), 0)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(error, 400, "requestedBy must be a positive integer.");

          return true;
        }
      );

      expect(
        mockedRepository.findPendingByAdvertisementId
      ).not.toHaveBeenCalled();
      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid advertisement id", async () => {
      await expect(
        service.create(
          createCreateInput({
            advertisementId: 0
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "advertisementId must be a positive integer."
        );

        return true;
      });
    });

    it("should reject an invalid client id", async () => {
      await expect(
        service.create(
          createCreateInput({
            clientId: 0
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "clientId must be a positive integer.");

        return true;
      });
    });

    it("should reject an invalid payment id", async () => {
      await expect(
        service.create(
          createCreateInput({
            paymentId: 0
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "paymentId must be a positive integer.");

        return true;
      });
    });

    it("should reject a zero requested amount", async () => {
      await expect(
        service.create(
          createCreateInput({
            requestedAmount: 0
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "requestedAmount must be greater than zero."
        );

        return true;
      });
    });

    it("should reject a negative requested amount", async () => {
      await expect(
        service.create(
          createCreateInput({
            requestedAmount: -100
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "requestedAmount must be greater than zero."
        );

        return true;
      });
    });

    it("should reject a NaN requested amount", async () => {
      await expect(
        service.create(
          createCreateInput({
            requestedAmount: Number.NaN
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "requestedAmount must be greater than zero."
        );

        return true;
      });
    });

    it("should reject a percentage below zero", async () => {
      await expect(
        service.create(
          createCreateInput({
            requestedAmount: null,
            requestedPercentage: -1
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "requestedPercentage must be between 0 and 100."
        );

        return true;
      });
    });

    it("should reject a percentage above 100", async () => {
      await expect(
        service.create(
          createCreateInput({
            requestedAmount: null,
            requestedPercentage: 101
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "requestedPercentage must be between 0 and 100."
        );

        return true;
      });
    });

    it("should allow a percentage-based approval", async () => {
      const input = createCreateInput({
        requestedAmount: null,
        requestedPercentage: 25
      });

      const approval = createApproval({
        requestedAmount: null,
        requestedPercentage: 25
      });

      mockedRepository.create.mockResolvedValue(approval);

      const result = await service.create(input, TEST_USER_ID);

      expect(result).toEqual(approval);

      expect(mockedRepository.create).toHaveBeenCalledWith(
        {
          advertisementId: TEST_ADVERTISEMENT_ID,
          clientId: TEST_CLIENT_ID,
          paymentId: TEST_PAYMENT_ID,
          approvalType: "DISCOUNT",
          requestedAmount: null,
          requestedPercentage: 25,
          approvalRemarks: "Discount approval requested"
        },
        TEST_USER_ID
      );
    });

    it("should reject a request without amount or percentage", async () => {
      await expect(
        service.create(
          createCreateInput({
            requestedAmount: null,
            requestedPercentage: null
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Either requestedAmount or requestedPercentage is required."
        );

        return true;
      });
    });

    it("should reject a request containing both amount and percentage", async () => {
      await expect(
        service.create(
          createCreateInput({
            requestedAmount: 5000,
            requestedPercentage: 10
          }),
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Provide either requestedAmount or requestedPercentage, not both."
        );

        return true;
      });
    });

    it("should reject creation when another pending approval exists", async () => {
      const existingApproval = createApproval();

      mockedRepository.findPendingByAdvertisementId.mockResolvedValue(
        existingApproval
      );

      await expect(
        service.create(createCreateInput(), TEST_USER_ID)
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          409,
          "A pending financial approval already exists for this advertisement."
        );

        return true;
      });

      expect(mockedRepository.create).not.toHaveBeenCalled();
      expect(mockedRepository.createHistory).not.toHaveBeenCalled();
    });

    it("should not create history when repository creation fails", async () => {
      const error = new Error("Database create failed");

      mockedRepository.create.mockRejectedValue(error);

      await expect(
        service.create(createCreateInput(), TEST_USER_ID)
      ).rejects.toThrow("Database create failed");

      expect(mockedRepository.createHistory).not.toHaveBeenCalled();
    });
  });

  /*
   * ===========================================================================
   * UPDATE APPROVAL REMARKS
   * ===========================================================================
   */

  describe("updateApprovalRemarks", () => {
    it("should update remarks for a SUBMITTED approval", async () => {
      const approval = createApproval();

      const updatedApproval = createApproval({
        approvalRemarks: "Updated remarks"
      });

      mockedRepository.findById.mockResolvedValue(approval);
      mockedRepository.updateApprovalRemarks.mockResolvedValue(updatedApproval);

      const result = await service.updateApprovalRemarks(
        TEST_APPROVAL_ID,
        "   Updated remarks   "
      );

      expect(result).toEqual(updatedApproval);

      expect(mockedRepository.updateApprovalRemarks).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "Updated remarks"
      );
    });

    it("should normalize blank remarks to null", async () => {
      mockedRepository.findById.mockResolvedValue(createApproval());

      mockedRepository.updateApprovalRemarks.mockResolvedValue(
        createApproval({
          approvalRemarks: null
        })
      );

      await service.updateApprovalRemarks(TEST_APPROVAL_ID, "   ");

      expect(mockedRepository.updateApprovalRemarks).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        null
      );
    });

    it("should reject updating remarks for an APPROVED approval", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "APPROVED"
        })
      );

      await expect(
        service.updateApprovalRemarks(TEST_APPROVAL_ID, "Cannot change")
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Approval remarks cannot be updated after financial approval is approved."
        );

        return true;
      });

      expect(mockedRepository.updateApprovalRemarks).not.toHaveBeenCalled();
    });

    it("should reject updating remarks for a REJECTED approval", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "REJECTED"
        })
      );

      await expect(
        service.updateApprovalRemarks(TEST_APPROVAL_ID, "Cannot change")
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Approval remarks cannot be updated while the financial approval is rejected."
        );

        return true;
      });

      expect(mockedRepository.updateApprovalRemarks).not.toHaveBeenCalled();
    });

    it("should return 404 when the repository cannot update the approval", async () => {
      mockedRepository.findById.mockResolvedValue(createApproval());
      mockedRepository.updateApprovalRemarks.mockResolvedValue(null);

      await expect(
        service.updateApprovalRemarks(TEST_APPROVAL_ID, "Updated")
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 404, "Financial approval not found.");

        return true;
      });
    });
  });

  /*
   * ===========================================================================
   * HOLD
   * ===========================================================================
   */

  describe("hold", () => {
    it("should transition SUBMITTED to HOLD", async () => {
      const approval = createApproval();

      const updatedApproval = createApproval({
        status: "HOLD",
        reviewedBy: TEST_REVIEWER_ID,
        reviewedAt: new Date("2026-09-23T11:00:00.000Z"),
        holdReason: "Payment verification pending"
      });

      mockedRepository.findById.mockResolvedValue(approval);
      mockedRepository.hold.mockResolvedValue(updatedApproval);

      const result = await service.hold(
        TEST_APPROVAL_ID,
        {
          holdReason: "   Payment verification pending   "
        },
        TEST_REVIEWER_ID
      );

      expect(result).toEqual(updatedApproval);

      expect(mockedRepository.hold).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        {
          holdReason: "Payment verification pending"
        },
        TEST_REVIEWER_ID
      );

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "SUBMITTED",
        "HOLD",
        TEST_REVIEWER_ID,
        null,
        "Payment verification pending",
        null
      );
    });

    it("should reject placing an APPROVED approval on hold", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "APPROVED"
        })
      );

      await expect(
        service.hold(
          TEST_APPROVAL_ID,
          {
            holdReason: "Payment verification pending"
          },
          TEST_REVIEWER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Financial approval cannot be placed on hold from APPROVED status."
        );

        return true;
      });

      expect(mockedRepository.hold).not.toHaveBeenCalled();
    });

    it("should reject placing a REJECTED approval on hold", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "REJECTED"
        })
      );

      await expect(
        service.hold(
          TEST_APPROVAL_ID,
          {
            holdReason: "Payment verification pending"
          },
          TEST_REVIEWER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Financial approval cannot be placed on hold from REJECTED status."
        );

        return true;
      });
    });

    it("should reject an empty hold reason", async () => {
      mockedRepository.findById.mockResolvedValue(createApproval());

      await expect(
        service.hold(
          TEST_APPROVAL_ID,
          {
            holdReason: "   "
          },
          TEST_REVIEWER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "holdReason is required.");

        return true;
      });

      expect(mockedRepository.hold).not.toHaveBeenCalled();
    });

    it("should reject an invalid reviewer id", async () => {
      await expect(
        service.hold(
          TEST_APPROVAL_ID,
          {
            holdReason: "Payment verification pending"
          },
          0
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "reviewedBy must be a positive integer.");

        return true;
      });

      expect(mockedRepository.findById).not.toHaveBeenCalled();
    });

    it("should return a conflict when the repository transition fails", async () => {
      mockedRepository.findById.mockResolvedValue(createApproval());
      mockedRepository.hold.mockResolvedValue(null);

      await expect(
        service.hold(
          TEST_APPROVAL_ID,
          {
            holdReason: "Payment verification pending"
          },
          TEST_REVIEWER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          409,
          "Financial approval could not be placed on hold because its status has changed."
        );

        return true;
      });

      expect(mockedRepository.createHistory).not.toHaveBeenCalled();
    });
  });

  /*
   * ===========================================================================
   * REJECT
   * ===========================================================================
   */

  describe("reject", () => {
    it("should transition SUBMITTED to REJECTED", async () => {
      const approval = createApproval();

      const updatedApproval = createApproval({
        status: "REJECTED",
        reviewedBy: TEST_REVIEWER_ID,
        reviewedAt: new Date("2026-09-23T11:00:00.000Z"),
        rejectionReason: "Requested adjustment was not accepted."
      });

      mockedRepository.findById.mockResolvedValue(approval);
      mockedRepository.reject.mockResolvedValue(updatedApproval);

      const result = await service.reject(
        TEST_APPROVAL_ID,
        {
          rejectionReason: "   Requested adjustment was not accepted.   "
        },
        TEST_REVIEWER_ID
      );

      expect(result).toEqual(updatedApproval);

      expect(mockedRepository.reject).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        {
          rejectionReason: "Requested adjustment was not accepted."
        },
        TEST_REVIEWER_ID
      );

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "SUBMITTED",
        "REJECTED",
        TEST_REVIEWER_ID,
        null,
        null,
        "Requested adjustment was not accepted."
      );
    });

    it("should transition HOLD to REJECTED", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "HOLD"
        })
      );

      const updatedApproval = createApproval({
        status: "REJECTED",
        reviewedBy: TEST_REVIEWER_ID,
        rejectionReason: "Required information was not received."
      });

      mockedRepository.reject.mockResolvedValue(updatedApproval);

      const result = await service.reject(
        TEST_APPROVAL_ID,
        {
          rejectionReason: "Required information was not received."
        },
        TEST_REVIEWER_ID
      );

      expect(result.status).toBe("REJECTED");

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "HOLD",
        "REJECTED",
        TEST_REVIEWER_ID,
        null,
        null,
        "Required information was not received."
      );
    });

    it("should reject rejecting an APPROVED approval", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "APPROVED"
        })
      );

      await expect(
        service.reject(
          TEST_APPROVAL_ID,
          {
            rejectionReason: "Attempted rejection"
          },
          TEST_REVIEWER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Financial approval cannot be rejected from APPROVED status."
        );

        return true;
      });

      expect(mockedRepository.reject).not.toHaveBeenCalled();
    });

    it("should reject rejecting a REJECTED approval", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "REJECTED"
        })
      );

      await expect(
        service.reject(
          TEST_APPROVAL_ID,
          {
            rejectionReason: "Second rejection"
          },
          TEST_REVIEWER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Financial approval cannot be rejected from REJECTED status."
        );

        return true;
      });
    });

    it("should reject an empty rejection reason", async () => {
      mockedRepository.findById.mockResolvedValue(createApproval());

      await expect(
        service.reject(
          TEST_APPROVAL_ID,
          {
            rejectionReason: "   "
          },
          TEST_REVIEWER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "rejectionReason is required.");

        return true;
      });

      expect(mockedRepository.reject).not.toHaveBeenCalled();
    });

    it("should reject an invalid reviewer id", async () => {
      await expect(
        service.reject(
          TEST_APPROVAL_ID,
          {
            rejectionReason: "Rejected"
          },
          0
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "reviewedBy must be a positive integer.");

        return true;
      });

      expect(mockedRepository.findById).not.toHaveBeenCalled();
    });

    it("should return a conflict when the repository transition fails", async () => {
      mockedRepository.findById.mockResolvedValue(createApproval());
      mockedRepository.reject.mockResolvedValue(null);

      await expect(
        service.reject(
          TEST_APPROVAL_ID,
          {
            rejectionReason: "Rejected"
          },
          TEST_REVIEWER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          409,
          "Financial approval could not be rejected because its status has changed."
        );

        return true;
      });

      expect(mockedRepository.createHistory).not.toHaveBeenCalled();
    });
  });

  /*
   * ===========================================================================
   * APPROVE
   * ===========================================================================
   */

  describe("approve", () => {
    it("should transition SUBMITTED to APPROVED", async () => {
      const approval = createApproval();

      const updatedApproval = createApproval({
        status: "APPROVED",
        reviewedBy: TEST_REVIEWER_ID,
        reviewedAt: new Date("2026-09-23T11:00:00.000Z"),
        approvalRemarks: "Approved after financial verification."
      });

      mockedRepository.findById.mockResolvedValue(approval);
      mockedRepository.approve.mockResolvedValue(updatedApproval);

      const result = await service.approve(
        TEST_APPROVAL_ID,
        {
          approvalRemarks: "   Approved after financial verification.   "
        },
        TEST_REVIEWER_ID
      );

      expect(result).toEqual(updatedApproval);

      expect(mockedRepository.approve).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        {
          approvalRemarks: "Approved after financial verification."
        },
        TEST_REVIEWER_ID
      );

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "SUBMITTED",
        "APPROVED",
        TEST_REVIEWER_ID,
        "Approved after financial verification.",
        null,
        null
      );
    });

    it("should transition HOLD to APPROVED", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "HOLD"
        })
      );

      const updatedApproval = createApproval({
        status: "APPROVED",
        reviewedBy: TEST_REVIEWER_ID,
        approvalRemarks: "Approved after hold resolution."
      });

      mockedRepository.approve.mockResolvedValue(updatedApproval);

      const result = await service.approve(
        TEST_APPROVAL_ID,
        {
          approvalRemarks: "Approved after hold resolution."
        },
        TEST_REVIEWER_ID
      );

      expect(result.status).toBe("APPROVED");

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "HOLD",
        "APPROVED",
        TEST_REVIEWER_ID,
        "Approved after hold resolution.",
        null,
        null
      );
    });

    it("should allow approval without remarks", async () => {
      mockedRepository.findById.mockResolvedValue(createApproval());

      mockedRepository.approve.mockResolvedValue(
        createApproval({
          status: "APPROVED",
          reviewedBy: TEST_REVIEWER_ID,
          approvalRemarks: null
        })
      );

      await service.approve(TEST_APPROVAL_ID, {}, TEST_REVIEWER_ID);

      expect(mockedRepository.approve).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        {
          approvalRemarks: null
        },
        TEST_REVIEWER_ID
      );

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "SUBMITTED",
        "APPROVED",
        TEST_REVIEWER_ID,
        null,
        null,
        null
      );
    });

    it("should reject approving an already APPROVED approval", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "APPROVED"
        })
      );

      await expect(
        service.approve(TEST_APPROVAL_ID, {}, TEST_REVIEWER_ID)
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Financial approval cannot be approved from APPROVED status."
        );

        return true;
      });

      expect(mockedRepository.approve).not.toHaveBeenCalled();
    });

    it("should reject approving a REJECTED approval", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "REJECTED"
        })
      );

      await expect(
        service.approve(TEST_APPROVAL_ID, {}, TEST_REVIEWER_ID)
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Financial approval cannot be approved from REJECTED status."
        );

        return true;
      });
    });

    it("should reject an invalid reviewer id", async () => {
      await expect(service.approve(TEST_APPROVAL_ID, {}, 0)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(error, 400, "reviewedBy must be a positive integer.");

          return true;
        }
      );

      expect(mockedRepository.findById).not.toHaveBeenCalled();
    });

    it("should return a conflict when the repository transition fails", async () => {
      mockedRepository.findById.mockResolvedValue(createApproval());
      mockedRepository.approve.mockResolvedValue(null);

      await expect(
        service.approve(
          TEST_APPROVAL_ID,
          {
            approvalRemarks: "Approve"
          },
          TEST_REVIEWER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          409,
          "Financial approval could not be approved because its status has changed."
        );

        return true;
      });

      expect(mockedRepository.createHistory).not.toHaveBeenCalled();
    });
  });

  /*
   * ===========================================================================
   * RESUBMIT
   * ===========================================================================
   */

  describe("resubmit", () => {
    it("should transition HOLD to SUBMITTED", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "HOLD"
        })
      );

      const updatedApproval = createApproval({
        status: "SUBMITTED",
        approvalRemarks: "Resubmitted after hold."
      });

      mockedRepository.resubmit.mockResolvedValue(updatedApproval);

      const result = await service.resubmit(
        TEST_APPROVAL_ID,
        {
          approvalRemarks: "   Resubmitted after hold.   "
        },
        TEST_USER_ID
      );

      expect(result).toEqual(updatedApproval);

      expect(mockedRepository.resubmit).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "Resubmitted after hold.",
        TEST_USER_ID
      );

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "HOLD",
        "SUBMITTED",
        TEST_USER_ID,
        "Resubmitted after hold.",
        null,
        null
      );
    });

    it("should transition REJECTED to SUBMITTED", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "REJECTED"
        })
      );

      const updatedApproval = createApproval({
        status: "SUBMITTED",
        approvalRemarks: "Corrected and resubmitted."
      });

      mockedRepository.resubmit.mockResolvedValue(updatedApproval);

      const result = await service.resubmit(
        TEST_APPROVAL_ID,
        {
          approvalRemarks: "Corrected and resubmitted."
        },
        TEST_USER_ID
      );

      expect(result.status).toBe("SUBMITTED");

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "REJECTED",
        "SUBMITTED",
        TEST_USER_ID,
        "Corrected and resubmitted.",
        null,
        null
      );
    });

    it("should allow resubmission without remarks", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "REJECTED"
        })
      );

      mockedRepository.resubmit.mockResolvedValue(
        createApproval({
          status: "SUBMITTED",
          approvalRemarks: null
        })
      );

      await service.resubmit(TEST_APPROVAL_ID, {}, TEST_USER_ID);

      expect(mockedRepository.resubmit).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        null,
        TEST_USER_ID
      );
    });

    it("should reject resubmitting a SUBMITTED approval", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "SUBMITTED"
        })
      );

      await expect(
        service.resubmit(TEST_APPROVAL_ID, {}, TEST_USER_ID)
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Financial approval cannot be resubmitted from SUBMITTED status."
        );

        return true;
      });

      expect(mockedRepository.resubmit).not.toHaveBeenCalled();
    });

    it("should reject resubmitting an APPROVED approval", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "APPROVED"
        })
      );

      await expect(
        service.resubmit(TEST_APPROVAL_ID, {}, TEST_USER_ID)
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "Financial approval cannot be resubmitted from APPROVED status."
        );

        return true;
      });
    });

    it("should reject an invalid requester id", async () => {
      await expect(service.resubmit(TEST_APPROVAL_ID, {}, 0)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(error, 400, "requestedBy must be a positive integer.");

          return true;
        }
      );

      expect(mockedRepository.findById).not.toHaveBeenCalled();
    });

    it("should return a conflict when the repository transition fails", async () => {
      mockedRepository.findById.mockResolvedValue(
        createApproval({
          status: "REJECTED"
        })
      );

      mockedRepository.resubmit.mockResolvedValue(null);

      await expect(
        service.resubmit(
          TEST_APPROVAL_ID,
          {
            approvalRemarks: "Resubmit"
          },
          TEST_USER_ID
        )
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          409,
          "Financial approval could not be resubmitted because its status has changed."
        );

        return true;
      });

      expect(mockedRepository.createHistory).not.toHaveBeenCalled();
    });
  });

  /*
   * ===========================================================================
   * HISTORY
   * ===========================================================================
   */

  describe("getHistory", () => {
    it("should return history for an existing approval", async () => {
      const approval = createApproval();

      const history = [
        createHistory(),
        createHistory({
          id: 2,
          fromStatus: "SUBMITTED",
          toStatus: "HOLD",
          actionBy: TEST_REVIEWER_ID,
          remarks: null,
          holdReason: "Payment verification pending"
        })
      ];

      mockedRepository.findById.mockResolvedValue(approval);
      mockedRepository.findHistoryByApprovalId.mockResolvedValue(history);

      const result = await service.getHistory(TEST_APPROVAL_ID);

      expect(result).toEqual(history);

      expect(mockedRepository.findHistoryByApprovalId).toHaveBeenCalledWith(
        TEST_APPROVAL_ID
      );
    });

    it("should reject history lookup for an invalid id", async () => {
      await expect(service.getHistory(0)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(error, 400, "id must be a positive integer.");

          return true;
        }
      );

      expect(mockedRepository.findHistoryByApprovalId).not.toHaveBeenCalled();
    });

    it("should return 404 when the approval does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(service.getHistory(TEST_APPROVAL_ID)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(error, 404, "Financial approval not found.");

          return true;
        }
      );

      expect(mockedRepository.findHistoryByApprovalId).not.toHaveBeenCalled();
    });
  });

  describe("createHistory", () => {
    it("should create history with normalized optional fields", async () => {
      const approval = createApproval();
      const history = createHistory({
        fromStatus: "SUBMITTED",
        toStatus: "HOLD",
        actionBy: TEST_REVIEWER_ID,
        remarks: "Hold requested",
        holdReason: "Payment verification pending",
        rejectionReason: null
      });

      mockedRepository.findById.mockResolvedValue(approval);
      mockedRepository.createHistory.mockResolvedValue(history);

      const result = await service.createHistory(
        TEST_APPROVAL_ID,
        "SUBMITTED",
        "HOLD",
        TEST_REVIEWER_ID,
        "   Hold requested   ",
        "   Payment verification pending   ",
        "   "
      );

      expect(result).toEqual(history);

      expect(mockedRepository.createHistory).toHaveBeenCalledWith(
        TEST_APPROVAL_ID,
        "SUBMITTED",
        "HOLD",
        TEST_REVIEWER_ID,
        "Hold requested",
        "Payment verification pending",
        null
      );
    });

    it("should reject an invalid approval id", async () => {
      await expect(
        service.createHistory(0, null, "SUBMITTED", TEST_USER_ID)
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "approvalId must be a positive integer.");

        return true;
      });
    });

    it("should reject an invalid action user id", async () => {
      await expect(
        service.createHistory(TEST_APPROVAL_ID, null, "SUBMITTED", 0)
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "actionBy must be a positive integer.");

        return true;
      });

      expect(mockedRepository.findById).not.toHaveBeenCalled();
    });

    it("should reject history creation when the approval does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(
        service.createHistory(TEST_APPROVAL_ID, null, "SUBMITTED", TEST_USER_ID)
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 404, "Financial approval not found.");

        return true;
      });

      expect(mockedRepository.createHistory).not.toHaveBeenCalled();
    });
  });

  describe("findHistoryByApprovalId", () => {
    it("should return history for an existing approval", async () => {
      const history = [createHistory()];

      mockedRepository.findById.mockResolvedValue(createApproval());
      mockedRepository.findHistoryByApprovalId.mockResolvedValue(history);

      const result = await service.findHistoryByApprovalId(TEST_APPROVAL_ID);

      expect(result).toEqual(history);

      expect(mockedRepository.findHistoryByApprovalId).toHaveBeenCalledWith(
        TEST_APPROVAL_ID
      );
    });

    it("should reject an invalid approval id", async () => {
      await expect(service.findHistoryByApprovalId(0)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(error, 400, "approvalId must be a positive integer.");

          return true;
        }
      );
    });
  });

  /*
   * ===========================================================================
   * EXISTENCE / LOOKUPS
   * ===========================================================================
   */

  describe("exists", () => {
    it("should return whether an approval exists", async () => {
      mockedRepository.exists.mockResolvedValue(true);

      const result = await service.exists(TEST_APPROVAL_ID);

      expect(result).toBe(true);
      expect(mockedRepository.exists).toHaveBeenCalledWith(TEST_APPROVAL_ID);
    });

    it("should reject an invalid id", async () => {
      await expect(service.exists(0)).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "id must be a positive integer.");

        return true;
      });
    });
  });

  describe("existsForAdvertisement", () => {
    it("should return whether an advertisement has financial approvals", async () => {
      mockedRepository.existsForAdvertisement.mockResolvedValue(true);

      const result = await service.existsForAdvertisement(
        TEST_ADVERTISEMENT_ID
      );

      expect(result).toBe(true);

      expect(mockedRepository.existsForAdvertisement).toHaveBeenCalledWith(
        TEST_ADVERTISEMENT_ID
      );
    });

    it("should reject an invalid advertisement id", async () => {
      await expect(service.existsForAdvertisement(0)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(
            error,
            400,
            "advertisementId must be a positive integer."
          );

          return true;
        }
      );
    });
  });

  describe("getLatestByAdvertisementId", () => {
    it("should return the latest approval", async () => {
      const approval = createApproval();

      mockedRepository.findLatestByAdvertisementId.mockResolvedValue(approval);

      const result = await service.getLatestByAdvertisementId(
        TEST_ADVERTISEMENT_ID
      );

      expect(result).toEqual(approval);

      expect(mockedRepository.findLatestByAdvertisementId).toHaveBeenCalledWith(
        TEST_ADVERTISEMENT_ID
      );
    });

    it("should return null when no approval exists", async () => {
      mockedRepository.findLatestByAdvertisementId.mockResolvedValue(null);

      const result = await service.getLatestByAdvertisementId(
        TEST_ADVERTISEMENT_ID
      );

      expect(result).toBeNull();
    });

    it("should reject an invalid advertisement id", async () => {
      await expect(service.getLatestByAdvertisementId(0)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(
            error,
            400,
            "advertisementId must be a positive integer."
          );

          return true;
        }
      );
    });
  });

  describe("getPendingByAdvertisementId", () => {
    it("should return the pending approval", async () => {
      const approval = createApproval();

      mockedRepository.findPendingByAdvertisementId.mockResolvedValue(approval);

      const result = await service.getPendingByAdvertisementId(
        TEST_ADVERTISEMENT_ID
      );

      expect(result).toEqual(approval);

      expect(
        mockedRepository.findPendingByAdvertisementId
      ).toHaveBeenCalledWith(TEST_ADVERTISEMENT_ID);
    });

    it("should return null when no pending approval exists", async () => {
      mockedRepository.findPendingByAdvertisementId.mockResolvedValue(null);

      const result = await service.getPendingByAdvertisementId(
        TEST_ADVERTISEMENT_ID
      );

      expect(result).toBeNull();
    });

    it("should reject an invalid advertisement id", async () => {
      await expect(service.getPendingByAdvertisementId(0)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(
            error,
            400,
            "advertisementId must be a positive integer."
          );

          return true;
        }
      );
    });
  });

  describe("getPendingByPaymentId", () => {
    it("should return the pending approval for a payment", async () => {
      const approval = createApproval();

      mockedRepository.findPendingByPaymentId.mockResolvedValue(approval);

      const result = await service.getPendingByPaymentId(TEST_PAYMENT_ID);

      expect(result).toEqual(approval);

      expect(mockedRepository.findPendingByPaymentId).toHaveBeenCalledWith(
        TEST_PAYMENT_ID
      );
    });

    it("should return null when no pending approval exists for the payment", async () => {
      mockedRepository.findPendingByPaymentId.mockResolvedValue(null);

      const result = await service.getPendingByPaymentId(TEST_PAYMENT_ID);

      expect(result).toBeNull();
    });

    it("should reject an invalid payment id", async () => {
      await expect(service.getPendingByPaymentId(0)).rejects.toSatisfy(
        (error: unknown) => {
          expectApiError(error, 400, "paymentId must be a positive integer.");

          return true;
        }
      );
    });
  });

  /*
   * ===========================================================================
   * LIST
   * ===========================================================================
   */

  describe("list", () => {
    it("should return paginated financial approvals", async () => {
      const approval = createApproval();

      const result: AdvertisementFinancialApprovalListResult = {
        items: [approval],
        total: 1
      };

      mockedRepository.list.mockResolvedValue(result);

      const filters = {
        page: 1,
        pageSize: 20,
        advertisementId: TEST_ADVERTISEMENT_ID,
        clientId: TEST_CLIENT_ID,
        paymentId: TEST_PAYMENT_ID,
        approvalType: "DISCOUNT" as const,
        status: "SUBMITTED" as const,
        requestedBy: TEST_USER_ID,
        reviewedBy: TEST_REVIEWER_ID
      };

      const response = await service.list(filters);

      expect(response).toEqual(result);
      expect(mockedRepository.list).toHaveBeenCalledWith(filters);
    });

    it("should allow the maximum page size of 100", async () => {
      const result: AdvertisementFinancialApprovalListResult = {
        items: [],
        total: 0
      };

      mockedRepository.list.mockResolvedValue(result);

      await service.list({
        page: 1,
        pageSize: 100
      });

      expect(mockedRepository.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 100
      });
    });

    it("should reject page zero", async () => {
      await expect(
        service.list({
          page: 0,
          pageSize: 20
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "page must be a positive integer.");

        return true;
      });

      expect(mockedRepository.list).not.toHaveBeenCalled();
    });

    it("should reject a negative page", async () => {
      await expect(
        service.list({
          page: -1,
          pageSize: 20
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "page must be a positive integer.");

        return true;
      });
    });

    it("should reject a non-integer page", async () => {
      await expect(
        service.list({
          page: 1.5,
          pageSize: 20
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "page must be a positive integer.");

        return true;
      });
    });

    it("should reject pageSize zero", async () => {
      await expect(
        service.list({
          page: 1,
          pageSize: 0
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "pageSize must be a positive integer.");

        return true;
      });
    });

    it("should reject a negative pageSize", async () => {
      await expect(
        service.list({
          page: 1,
          pageSize: -1
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "pageSize must be a positive integer.");

        return true;
      });
    });

    it("should reject pageSize greater than 100", async () => {
      await expect(
        service.list({
          page: 1,
          pageSize: 101
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "pageSize cannot exceed 100.");

        return true;
      });
    });

    it("should reject an invalid advertisement filter", async () => {
      await expect(
        service.list({
          page: 1,
          pageSize: 20,
          advertisementId: 0
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(
          error,
          400,
          "advertisementId must be a positive integer."
        );

        return true;
      });
    });

    it("should reject an invalid client filter", async () => {
      await expect(
        service.list({
          page: 1,
          pageSize: 20,
          clientId: 0
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "clientId must be a positive integer.");

        return true;
      });
    });

    it("should reject an invalid payment filter", async () => {
      await expect(
        service.list({
          page: 1,
          pageSize: 20,
          paymentId: 0
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "paymentId must be a positive integer.");

        return true;
      });
    });

    it("should reject an invalid requestedBy filter", async () => {
      await expect(
        service.list({
          page: 1,
          pageSize: 20,
          requestedBy: 0
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "requestedBy must be a positive integer.");

        return true;
      });
    });

    it("should reject an invalid reviewedBy filter", async () => {
      await expect(
        service.list({
          page: 1,
          pageSize: 20,
          reviewedBy: 0
        })
      ).rejects.toSatisfy((error: unknown) => {
        expectApiError(error, 400, "reviewedBy must be a positive integer.");

        return true;
      });
    });

    it("should propagate repository errors", async () => {
      const error = new Error("List failed");

      mockedRepository.list.mockRejectedValue(error);

      await expect(
        service.list({
          page: 1,
          pageSize: 20
        })
      ).rejects.toThrow("List failed");
    });
  });
});
