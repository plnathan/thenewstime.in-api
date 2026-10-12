import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as thresholdService from "../financial-approval-thresholds/financial-approval-threshold.service.js";
import * as repository from "./financial-approval.repository.js";

import type {
  AdvertisementFinancialApproval,
  AdvertisementFinancialApprovalHistory,
  AdvertisementFinancialApprovalListFilter,
  AdvertisementFinancialApprovalListResult,
  ApproveAdvertisementFinancialApprovalInput,
  CreateAdvertisementFinancialApprovalInput,
  HoldAdvertisementFinancialApprovalInput,
  RejectAdvertisementFinancialApprovalInput,
  ResubmitAdvertisementFinancialApprovalInput
} from "./financial-approval.types.js";

const FINANCIAL_APPROVAL_TYPES = [
  "DISCOUNT",
  "ADJUSTMENT",
  "REFUND",
  "PARTIAL_REFUND"
] as const;

type FinancialApprovalType = (typeof FINANCIAL_APPROVAL_TYPES)[number];

const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0;

const isPositiveNumber = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isPercentage = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 100;

const hasAtMostTwoDecimalPlaces = (value: number): boolean => {
  if (!Number.isFinite(value)) {
    return false;
  }

  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
};

const isFinancialApprovalType = (
  value: string
): value is FinancialApprovalType =>
  FINANCIAL_APPROVAL_TYPES.includes(value as FinancialApprovalType);

const normalizeOptionalText = (
  value: string | null | undefined
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const validateId = (id: number, fieldName: string): void => {
  if (!isPositiveInteger(id)) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`);
  }
};

const validateRequestedAmount = (requestedAmount: number): void => {
  if (!isPositiveNumber(requestedAmount)) {
    throw new ApiError(400, "requestedAmount must be greater than zero.");
  }

  if (!hasAtMostTwoDecimalPlaces(requestedAmount)) {
    throw new ApiError(
      400,
      "requestedAmount cannot have more than 2 decimal places."
    );
  }
};

const validateRequestedPercentage = (requestedPercentage: number): void => {
  if (!isPercentage(requestedPercentage)) {
    throw new ApiError(400, "requestedPercentage must be between 0 and 100.");
  }

  if (!hasAtMostTwoDecimalPlaces(requestedPercentage)) {
    throw new ApiError(
      400,
      "requestedPercentage cannot have more than 2 decimal places."
    );
  }
};

const validateCreateInput = (
  input: CreateAdvertisementFinancialApprovalInput
): void => {
  validateId(input.advertisementId, "advertisementId");

  validateId(input.clientId, "clientId");

  if (input.paymentId !== undefined && input.paymentId !== null) {
    validateId(input.paymentId, "paymentId");
  }

  if (!isFinancialApprovalType(input.approvalType)) {
    throw new ApiError(400, "Invalid financial approval type.");
  }

  const hasAmount =
    input.requestedAmount !== undefined && input.requestedAmount !== null;

  const hasPercentage =
    input.requestedPercentage !== undefined &&
    input.requestedPercentage !== null;

  if (!hasAmount && !hasPercentage) {
    throw new ApiError(
      400,
      "Either requestedAmount or requestedPercentage is required."
    );
  }

  if (hasAmount && hasPercentage) {
    throw new ApiError(
      400,
      "Provide either requestedAmount or requestedPercentage, not both."
    );
  }

  if (hasAmount) {
    validateRequestedAmount(input.requestedAmount as number);
  }

  if (hasPercentage) {
    validateRequestedPercentage(input.requestedPercentage as number);
  }
};

const getApprovalOrThrow = async (
  id: number
): Promise<AdvertisementFinancialApproval> => {
  validateId(id, "id");

  const approval = await repository.findById(id);

  if (!approval) {
    throw new ApiError(404, "Financial approval not found.");
  }

  return approval;
};

/*
 * ============================================================================
 * FINANCIAL APPROVAL THRESHOLD EVALUATION
 * ============================================================================
 *
 * Thresholds are evaluated only when a financial approval is being approved
 * from SUBMITTED status.
 *
 * Threshold semantics:
 *
 *   requested value < threshold  -> APPROVED
 *   requested value = threshold  -> APPROVED
 *   requested value > threshold  -> HOLD
 *
 * Once an approval has entered HOLD, it is considered escalated and must not
 * be evaluated against the threshold again.
 *
 * Therefore:
 *
 *   SUBMITTED -> APPROVED
 *
 * or:
 *
 *   SUBMITTED -> HOLD -> APPROVED
 *   SUBMITTED -> HOLD -> REJECTED
 *
 * A missing or non-applicable active threshold does not change the existing
 * financial approval behavior.
 *
 * This logic intentionally does not modify advertisement_payments.
 * ============================================================================
 */

const getThresholdHoldReason = async (
  approval: AdvertisementFinancialApproval
): Promise<string | null> => {
  const threshold = await thresholdService.getActiveThreshold(
    approval.approvalType
  );

  if (!threshold) {
    return null;
  }

  /*
   * Amount threshold.
   */
  if (
    approval.requestedAmount !== null &&
    approval.requestedAmount !== undefined &&
    threshold.amountThreshold !== null &&
    threshold.amountThreshold !== undefined
  ) {
    if (approval.requestedAmount > threshold.amountThreshold) {
      return (
        "THRESHOLD_EXCEEDED: Requested amount " +
        `${approval.requestedAmount} exceeds the configured amount threshold ` +
        `${threshold.amountThreshold}.`
      );
    }

    return null;
  }

  /*
   * Percentage threshold.
   */
  if (
    approval.requestedPercentage !== null &&
    approval.requestedPercentage !== undefined &&
    threshold.percentageThreshold !== null &&
    threshold.percentageThreshold !== undefined
  ) {
    if (approval.requestedPercentage > threshold.percentageThreshold) {
      return (
        "THRESHOLD_EXCEEDED: Requested percentage " +
        `${approval.requestedPercentage}% exceeds the configured percentage ` +
        `threshold ${threshold.percentageThreshold}%.`
      );
    }

    return null;
  }

  /*
   * The active threshold does not correspond to the requested financial
   * value. Preserve normal approval behavior.
   */
  return null;
};

export const getById = async (
  id: number
): Promise<AdvertisementFinancialApproval> => getApprovalOrThrow(id);

export const create = async (
  input: CreateAdvertisementFinancialApprovalInput,
  requestedBy: number
): Promise<AdvertisementFinancialApproval> => {
  validateId(requestedBy, "requestedBy");

  validateCreateInput(input);

  const existingPendingApproval = await repository.findPendingByAdvertisementId(
    input.advertisementId
  );

  if (existingPendingApproval) {
    throw new ApiError(
      409,
      "A pending financial approval already exists for this advertisement."
    );
  }

  const approval = await repository.create(
    {
      advertisementId: input.advertisementId,
      clientId: input.clientId,
      paymentId: input.paymentId ?? null,
      approvalType: input.approvalType,
      requestedAmount: input.requestedAmount ?? null,
      requestedPercentage: input.requestedPercentage ?? null,
      approvalRemarks: normalizeOptionalText(input.approvalRemarks)
    },
    requestedBy
  );

  await repository.createHistory(
    approval.id,
    null,
    "SUBMITTED",
    requestedBy,
    approval.approvalRemarks,
    null,
    null
  );

  return approval;
};

export const updateApprovalRemarks = async (
  id: number,
  approvalRemarks: string | null
): Promise<AdvertisementFinancialApproval> => {
  const approval = await getApprovalOrThrow(id);

  if (approval.status === "APPROVED") {
    throw new ApiError(
      400,
      "Approval remarks cannot be updated after financial approval is approved."
    );
  }

  if (approval.status === "REJECTED") {
    throw new ApiError(
      400,
      "Approval remarks cannot be updated while the financial approval is rejected."
    );
  }

  const updatedApproval = await repository.updateApprovalRemarks(
    approval.id,
    normalizeOptionalText(approvalRemarks)
  );

  if (!updatedApproval) {
    throw new ApiError(404, "Financial approval not found.");
  }

  return updatedApproval;
};

export const hold = async (
  id: number,
  input: HoldAdvertisementFinancialApprovalInput,
  reviewedBy: number
): Promise<AdvertisementFinancialApproval> => {
  validateId(reviewedBy, "reviewedBy");

  const approval = await getApprovalOrThrow(id);

  if (approval.status !== "SUBMITTED") {
    throw new ApiError(
      400,
      `Financial approval cannot be placed on hold from ${approval.status} status.`
    );
  }

  const holdReason = input.holdReason.trim();

  if (holdReason.length === 0) {
    throw new ApiError(400, "holdReason is required.");
  }

  const updatedApproval = await repository.hold(
    approval.id,
    {
      holdReason
    },
    reviewedBy
  );

  if (!updatedApproval) {
    throw new ApiError(
      409,
      "Financial approval could not be placed on hold because its status has changed."
    );
  }

  await repository.createHistory(
    approval.id,
    approval.status,
    updatedApproval.status,
    reviewedBy,
    null,
    holdReason,
    null
  );

  return updatedApproval;
};

export const reject = async (
  id: number,
  input: RejectAdvertisementFinancialApprovalInput,
  reviewedBy: number
): Promise<AdvertisementFinancialApproval> => {
  validateId(reviewedBy, "reviewedBy");

  const approval = await getApprovalOrThrow(id);

  if (approval.status !== "SUBMITTED" && approval.status !== "HOLD") {
    throw new ApiError(
      400,
      `Financial approval cannot be rejected from ${approval.status} status.`
    );
  }

  const rejectionReason = input.rejectionReason.trim();

  if (rejectionReason.length === 0) {
    throw new ApiError(400, "rejectionReason is required.");
  }

  const updatedApproval = await repository.reject(
    approval.id,
    {
      rejectionReason
    },
    reviewedBy
  );

  if (!updatedApproval) {
    throw new ApiError(
      409,
      "Financial approval could not be rejected because its status has changed."
    );
  }

  await repository.createHistory(
    approval.id,
    approval.status,
    updatedApproval.status,
    reviewedBy,
    null,
    null,
    rejectionReason
  );

  return updatedApproval;
};

export const approve = async (
  id: number,
  input: ApproveAdvertisementFinancialApprovalInput,
  reviewedBy: number
): Promise<AdvertisementFinancialApproval> => {
  validateId(reviewedBy, "reviewedBy");

  const approval = await getApprovalOrThrow(id);

  if (approval.status !== "SUBMITTED" && approval.status !== "HOLD") {
    throw new ApiError(
      400,
      `Financial approval cannot be approved from ${approval.status} status.`
    );
  }

  const approvalRemarks = normalizeOptionalText(input.approvalRemarks);

  /*
   * --------------------------------------------------------------------------
   * THRESHOLD EVALUATION
   * --------------------------------------------------------------------------
   *
   * Only SUBMITTED approvals are evaluated.
   *
   * If the configured threshold is exceeded, the approval is moved to HOLD
   * instead of APPROVED.
   *
   * HOLD approvals are intentionally not evaluated again.
   */
  if (approval.status === "SUBMITTED") {
    const thresholdHoldReason = await getThresholdHoldReason(approval);

    if (thresholdHoldReason !== null) {
      const heldApproval = await repository.hold(
        approval.id,
        {
          holdReason: thresholdHoldReason
        },
        reviewedBy
      );

      if (!heldApproval) {
        throw new ApiError(
          409,
          "Financial approval could not be placed on hold because its status has changed."
        );
      }

      await repository.createHistory(
        approval.id,
        approval.status,
        heldApproval.status,
        reviewedBy,
        approvalRemarks,
        thresholdHoldReason,
        null
      );

      return heldApproval;
    }
  }
  const hasApprovedAmount =
    input.approvedAmount !== undefined && input.approvedAmount !== null;

  const hasApprovedPercentage =
    input.approvedPercentage !== undefined && input.approvedPercentage !== null;

  if (hasApprovedAmount && hasApprovedPercentage) {
    throw new ApiError(
      400,
      "Provide either approvedAmount or approvedPercentage, not both."
    );
  }

  if (hasApprovedAmount) {
    if (approval.requestedAmount === null) {
      throw new ApiError(
        400,
        "This approval request does not have a requested amount."
      );
    }

    validateRequestedAmount(input.approvedAmount as number);

    if (input.approvedAmount! > approval.requestedAmount) {
      throw new ApiError(
        400,
        "Approved amount cannot exceed the requested amount."
      );
    }
  }

  if (hasApprovedPercentage) {
    if (approval.requestedPercentage === null) {
      throw new ApiError(
        400,
        "This approval request does not have a requested percentage."
      );
    }

    validateRequestedPercentage(input.approvedPercentage as number);

    if (input.approvedPercentage! > approval.requestedPercentage) {
      throw new ApiError(
        400,
        "Approved percentage cannot exceed the requested percentage."
      );
    }
  }

  const approvedAmount =
    approval.requestedAmount === null
      ? null
      : (input.approvedAmount ?? approval.requestedAmount);

  const approvedPercentage =
    approval.requestedPercentage === null
      ? null
      : (input.approvedPercentage ?? approval.requestedPercentage);
  /*
   * --------------------------------------------------------------------------
   * NORMAL APPROVAL
   * --------------------------------------------------------------------------
   *
   * This applies to:
   *
   * 1. SUBMITTED approvals with no active threshold.
   * 2. SUBMITTED approvals within the threshold.
   * 3. SUBMITTED approvals exactly at the threshold.
   * 4. HOLD approvals being approved by the authorized Admin.
   *
   * Payment records are not modified.
   */
  const updatedApproval = await repository.approve(
    approval.id,
    {
      approvalRemarks,
      approvedAmount,
      approvedPercentage
    },
    reviewedBy
  );

  if (!updatedApproval) {
    throw new ApiError(
      409,
      "Financial approval could not be approved because its status has changed."
    );
  }

  await repository.createHistory(
    approval.id,
    approval.status,
    updatedApproval.status,
    reviewedBy,
    approvalRemarks,
    null,
    null
  );

  return updatedApproval;
};

export const resubmit = async (
  id: number,
  input: ResubmitAdvertisementFinancialApprovalInput,
  requestedBy: number
): Promise<AdvertisementFinancialApproval> => {
  validateId(requestedBy, "requestedBy");

  const approval = await getApprovalOrThrow(id);

  if (approval.status !== "HOLD" && approval.status !== "REJECTED") {
    throw new ApiError(
      400,
      `Financial approval cannot be resubmitted from ${approval.status} status.`
    );
  }

  const approvalRemarks = normalizeOptionalText(input.approvalRemarks);

  const updatedApproval = await repository.resubmit(
    approval.id,
    approvalRemarks,
    requestedBy
  );

  if (!updatedApproval) {
    throw new ApiError(
      409,
      "Financial approval could not be resubmitted because its status has changed."
    );
  }

  await repository.createHistory(
    approval.id,
    approval.status,
    updatedApproval.status,
    requestedBy,
    approvalRemarks,
    null,
    null
  );

  return updatedApproval;
};

export const getHistory = async (
  id: number
): Promise<AdvertisementFinancialApprovalHistory[]> => {
  await getApprovalOrThrow(id);

  return repository.findHistoryByApprovalId(id);
};

export const exists = async (id: number): Promise<boolean> => {
  validateId(id, "id");

  return repository.exists(id);
};

export const existsForAdvertisement = async (
  advertisementId: number
): Promise<boolean> => {
  validateId(advertisementId, "advertisementId");

  return repository.existsForAdvertisement(advertisementId);
};

export const getLatestByAdvertisementId = async (
  advertisementId: number
): Promise<AdvertisementFinancialApproval | null> => {
  validateId(advertisementId, "advertisementId");

  return repository.findLatestByAdvertisementId(advertisementId);
};

export const getPendingByAdvertisementId = async (
  advertisementId: number
): Promise<AdvertisementFinancialApproval | null> => {
  validateId(advertisementId, "advertisementId");

  return repository.findPendingByAdvertisementId(advertisementId);
};

export const getPendingByPaymentId = async (
  paymentId: number
): Promise<AdvertisementFinancialApproval | null> => {
  validateId(paymentId, "paymentId");

  return repository.findPendingByPaymentId(paymentId);
};

export const list = async (
  filters: AdvertisementFinancialApprovalListFilter
): Promise<AdvertisementFinancialApprovalListResult> => {
  if (!Number.isInteger(filters.page) || filters.page <= 0) {
    throw new ApiError(400, "page must be a positive integer.");
  }

  if (!Number.isInteger(filters.pageSize) || filters.pageSize <= 0) {
    throw new ApiError(400, "pageSize must be a positive integer.");
  }

  if (filters.pageSize > 100) {
    throw new ApiError(400, "pageSize cannot exceed 100.");
  }

  if (filters.advertisementId !== undefined) {
    validateId(filters.advertisementId, "advertisementId");
  }

  if (filters.clientId !== undefined) {
    validateId(filters.clientId, "clientId");
  }

  if (filters.paymentId !== undefined) {
    validateId(filters.paymentId, "paymentId");
  }

  if (filters.requestedBy !== undefined) {
    validateId(filters.requestedBy, "requestedBy");
  }

  if (filters.reviewedBy !== undefined) {
    validateId(filters.reviewedBy, "reviewedBy");
  }

  return repository.list(filters);
};

export const createHistory = async (
  approvalId: number,
  fromStatus: AdvertisementFinancialApproval["status"] | null,
  toStatus: AdvertisementFinancialApproval["status"],
  actionBy: number,
  remarks: string | null = null,
  holdReason: string | null = null,
  rejectionReason: string | null = null
): Promise<AdvertisementFinancialApprovalHistory> => {
  validateId(approvalId, "approvalId");

  validateId(actionBy, "actionBy");

  await getApprovalOrThrow(approvalId);

  return repository.createHistory(
    approvalId,
    fromStatus,
    toStatus,
    actionBy,
    normalizeOptionalText(remarks),
    normalizeOptionalText(holdReason),
    normalizeOptionalText(rejectionReason)
  );
};

export const findHistoryByApprovalId = async (
  approvalId: number
): Promise<AdvertisementFinancialApprovalHistory[]> => {
  validateId(approvalId, "approvalId");

  await getApprovalOrThrow(approvalId);

  return repository.findHistoryByApprovalId(approvalId);
};
