import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as thresholdService from "../financial-approval-thresholds/financial-approval-threshold.service.js";

import * as paymentService from "../payments/payment.service.js";

import * as repository from "./financial-approval.repository.js";

import type {
  AdvertisementFinancialApproval,
  AdvertisementFinancialApprovalHistory,
  AdvertisementFinancialApprovalListFilters,
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
  "PARTIAL_REFUND",
  "CREDIT_EXCEPTION"
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
  if (input.approvalType === "CREDIT_EXCEPTION") {
    if (!hasAmount) {
      throw new ApiError(
        400,
        "A positive requestedAmount is required for a credit exception."
      );
    }
    if (hasPercentage) {
      throw new ApiError(
        400,
        "Credit exceptions must be requested by amount, not percentage."
      );
    }
    validateRequestedAmount(input.requestedAmount as number);
    if (
      typeof input.creditExceptionReason !== "string" ||
      input.creditExceptionReason.trim().length === 0
    ) {
      throw new ApiError(400, "A credit exception reason is required.");
    }
    if (input.creditExceptionReason.trim().length > 5000) {
      throw new ApiError(
        400,
        "Credit exception reason cannot exceed 5000 characters."
      );
    }
    const dueDate = input.expectedPaymentDueDate;
    if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new ApiError(
        400,
        "A valid expected payment due date in YYYY-MM-DD format is required."
      );
    }
    const [year, month, day] = dueDate.split("-").map(Number);
    const parsedDate = new Date(Date.UTC(year!, month! - 1, day!));
    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month! - 1 ||
      parsedDate.getUTCDate() !== day
    ) {
      throw new ApiError(
        400,
        "The expected payment due date is not a valid calendar date."
      );
    }
    return;
  }
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

  if (
    approval.requestedAmount !== null &&
    approval.requestedAmount !== undefined &&
    threshold.amountThreshold !== null
  ) {
    if (approval.requestedAmount > threshold.amountThreshold) {
      return (
        `THRESHOLD_EXCEEDED: Requested amount ` +
        `${approval.requestedAmount} exceeds the configured ` +
        `${approval.approvalType} amount threshold of ` +
        `${threshold.amountThreshold}.`
      );
    }

    return null;
  }

  // Credit Exception thresholds are amount-only.
  if (approval.approvalType === "CREDIT_EXCEPTION") {
    return null;
  }

  if (
    approval.requestedPercentage !== null &&
    approval.requestedPercentage !== undefined &&
    threshold.percentageThreshold !== null &&
    approval.requestedPercentage > threshold.percentageThreshold
  ) {
    return (
      `THRESHOLD_EXCEEDED: Requested percentage ` +
      `${approval.requestedPercentage}% exceeds the configured ` +
      `${approval.approvalType} percentage threshold of ` +
      `${threshold.percentageThreshold}%.`
    );
  }

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
  if (input.approvalType === "CREDIT_EXCEPTION") {
    const summary = await paymentService.getPaymentSummary(
      input.advertisementId
    );
    const outstandingAmount =
      summary.outstandingAmount === null ||
      summary.outstandingAmount === undefined
        ? null
        : Number(summary.outstandingAmount);
    const requestedAmount = Number(input.requestedAmount);
    if (
      outstandingAmount === null ||
      !Number.isFinite(outstandingAmount) ||
      outstandingAmount <= 0
    ) {
      throw new ApiError(
        400,
        "A credit exception cannot be requested because no eligible outstanding balance remains."
      );
    }
    if (requestedAmount > outstandingAmount) {
      throw new ApiError(
        400,
        `Credit exception amount cannot exceed the current outstanding balance of ${outstandingAmount.toFixed(2)}.`
      );
    }
  }

  const existingPendingApproval =
    await repository.findPendingByAdvertisementIdAndType(
      input.advertisementId,
      input.approvalType
    );

  if (existingPendingApproval) {
    throw new ApiError(
      409,
      `A pending ${input.approvalType} approval already exists for this advertisement.`
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
      approvalRemarks: normalizeOptionalText(input.approvalRemarks),
      ...(input.approvalType === "CREDIT_EXCEPTION"
        ? {
            creditExceptionReason: normalizeOptionalText(
              input.creditExceptionReason
            ),
            expectedPaymentDueDate: input.expectedPaymentDueDate ?? null
          }
        : {})
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
  if (approval.approvalType === "CREDIT_EXCEPTION") {
    // Recalculate debt at approval time: payments may have been verified since
    // this exception was submitted.
    const summary = await paymentService.getPaymentSummary(
      approval.advertisementId
    );
    const outstandingAmount =
      summary.outstandingAmount === null ||
      summary.outstandingAmount === undefined
        ? null
        : Number(summary.outstandingAmount);
    const amountToApprove = Number(
      input.approvedAmount ?? approval.requestedAmount
    );
    if (
      outstandingAmount === null ||
      !Number.isFinite(outstandingAmount) ||
      outstandingAmount <= 0
    ) {
      throw new ApiError(
        400,
        "This credit exception cannot be approved because no eligible outstanding balance remains."
      );
    }
    if (amountToApprove > outstandingAmount) {
      throw new ApiError(
        400,
        `Credit exception approval cannot exceed the current outstanding balance of ${outstandingAmount.toFixed(2)}.`
      );
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

  /*
   * Revalidate credit-exception eligibility at resubmission time.
   *
   * The outstanding balance may have changed since the original request
   * was submitted. A resubmission must not bypass the current balance
   * restriction.
   *
   * A credit exception authorizes deferred payment only; it does not
   * represent a payment received and must not change payment history.
   */
  if (approval.approvalType === "CREDIT_EXCEPTION") {
    const requestedAmount = Number(approval.requestedAmount);

    if (
      approval.requestedAmount === null ||
      approval.requestedAmount === undefined ||
      !isPositiveNumber(requestedAmount) ||
      !hasAtMostTwoDecimalPlaces(requestedAmount)
    ) {
      throw new ApiError(
        400,
        "The credit-exception request does not contain a valid requested amount."
      );
    }

    const summary = await paymentService.getPaymentSummary(
      approval.advertisementId
    );

    const outstandingAmount =
      summary.outstandingAmount === null ||
      summary.outstandingAmount === undefined
        ? null
        : Number(summary.outstandingAmount);

    if (
      outstandingAmount === null ||
      !Number.isFinite(outstandingAmount) ||
      outstandingAmount <= 0
    ) {
      throw new ApiError(
        400,
        "This credit exception cannot be resubmitted because no eligible outstanding balance remains."
      );
    }

    if (requestedAmount > outstandingAmount + 0.009) {
      throw new ApiError(
        400,
        `Credit exception amount cannot exceed the current outstanding balance of ${outstandingAmount.toFixed(2)}.`
      );
    }

    if (
      typeof approval.creditExceptionReason !== "string" ||
      approval.creditExceptionReason.trim().length === 0
    ) {
      throw new ApiError(
        400,
        "A credit exception reason is required before resubmission."
      );
    }

    if (!approval.expectedPaymentDueDate) {
      throw new ApiError(
        400,
        "An expected payment due date is required before resubmission."
      );
    }
  }

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
  filters: AdvertisementFinancialApprovalListFilters
): Promise<AdvertisementFinancialApprovalListResult> => {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  if (!Number.isInteger(page) || page <= 0) {
    throw new ApiError(400, "page must be a positive integer.");
  }
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new ApiError(400, "pageSize must be a positive integer.");
  }
  if (pageSize > 100) {
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
  return repository.list({
    ...filters,
    page,
    pageSize
  });
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
