import { pool } from "../../../../shared/config/db.js";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as rateCardRepository from "../rate-cards/rate-card.repository.js";

import * as pricingSnapshotService from "../pricing-snapshots/pricing-snapshot.service.js";

import { calculateStandardAmount } from "../standard-amount/standard-amount.service.js";

import * as financialApprovalRepository from "../financial-approvals/financial-approval.repository.js";

import * as repository from "./advertisement.repository.js";

import type {
  Advertisement,
  AdvertisementHoldInput,
  AdvertisementRejectInput,
  AdvertisementSearchFilters,
  AdvertisementWorkflowHistory,
  AdvertisementWorkflowInput,
  AdvertisementWorkflowResult,
  AdvertisementWorkflowStatus,
  CreateAdvertisementInput,
  UpdateAdvertisementInput
} from "./advertisement.types.js";

import type {
  AdvertisementFinancialApproval,
  AdvertisementFinancialApprovalType
} from "../financial-approvals/financial-approval.types.js";

import * as paymentService from "../payments/payment.service.js";

import * as rotationRepository from "../rotation/rotation.repository.js";

type CreateAdvertisementInputWithPlacement = CreateAdvertisementInput & {
  placementId?: number | null;
};

type UpdateAdvertisementInputWithPlacement = UpdateAdvertisementInput & {
  placementId?: number | null;
};

const workflow: Record<
  AdvertisementWorkflowStatus,
  AdvertisementWorkflowStatus[]
> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: ["ON_HOLD", "ARCHIVED"],
  REJECTED: ["SUBMITTED"],
  ON_HOLD: ["APPROVED", "ARCHIVED"],
  ARCHIVED: ["DRAFT"]
};

const roundToTwo = (value: number): number => Number(value.toFixed(2));

type CampaignDateInput = Date | string | null | undefined;

/**
 * Draft advertisements may be created before their campaign window is set.
 * Once either boundary is supplied, both boundaries must be present and form
 * a valid range. Activation calls this helper with `required: true`, because
 * an advertisement cannot be activated without a persisted campaign window.
 */
const validateCampaignWindow = (
  startAt: CampaignDateInput,
  endAt: CampaignDateInput,
  options: { required?: boolean } = {}
): void => {
  const hasStart = startAt !== null && startAt !== undefined && startAt !== "";
  const hasEnd = endAt !== null && endAt !== undefined && endAt !== "";

  if (!hasStart && !hasEnd) {
    if (options.required) {
      throw new ApiError(400, "Campaign start and end date/time are required.");
    }
    return;
  }

  if (!hasStart || !hasEnd) {
    throw new ApiError(400, "Campaign start and end date/time are required.");
  }

  const start =
    startAt instanceof Date ? startAt.getTime() : new Date(startAt).getTime();
  const end =
    endAt instanceof Date ? endAt.getTime() : new Date(endAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new ApiError(400, "Campaign start or end date/time is invalid.");
  }

  if (end <= start) {
    throw new ApiError(400, "End date/time must be after start date/time.");
  }
};

interface AdvertisementFinancialCalculation {
  advertisementAmount: number | null;
  discountPercentage: number;
  discountAmount: number;
  advancePercentage: number;
  advanceAmount: number;
}

const calculateAdvertisementFinancials = (
  advertisementAmount: number | null | undefined,
  discountPercentage: number | undefined,
  advancePercentage: number | undefined,
  standardAmount?: number | null
): AdvertisementFinancialCalculation => {
  const requestedAmount =
    advertisementAmount === undefined || advertisementAmount === null
      ? null
      : Number(advertisementAmount);

  const standard =
    standardAmount === undefined || standardAmount === null
      ? null
      : Number(standardAmount);

  const discountRate = discountPercentage ?? 0;
  const advanceRate = advancePercentage ?? 0;

  if (
    !Number.isFinite(discountRate) ||
    discountRate < 0 ||
    discountRate > 100
  ) {
    throw new ApiError(400, "Discount percentage must be between 0 and 100.");
  }

  if (!Number.isFinite(advanceRate) || advanceRate < 0 || advanceRate > 100) {
    throw new ApiError(400, "Advance percentage must be between 0 and 100.");
  }

  if (
    requestedAmount !== null &&
    (!Number.isFinite(requestedAmount) || requestedAmount < 0)
  ) {
    throw new ApiError(
      400,
      "Advertisement Amount must be a valid non-negative amount."
    );
  }

  if (standard !== null && (!Number.isFinite(standard) || standard < 0)) {
    throw new ApiError(
      400,
      "Standard Amount must be a valid non-negative amount."
    );
  }

  /*
   * Standard Amount is the system-derived rate-card reference.
   * Advertisement Amount is a separately negotiated commercial amount.
   * Never derive the latter merely because the former exists.
   */
  if (requestedAmount === null) {
    if (discountRate > 0 || advanceRate > 0) {
      throw new ApiError(
        400,
        "Advertisement Amount is required when discount or advance percentages are configured."
      );
    }

    return {
      advertisementAmount: null,
      discountPercentage: discountRate,
      discountAmount: 0,
      advancePercentage: advanceRate,
      advanceAmount: 0
    };
  }

  const discountAmount = roundToTwo((requestedAmount * discountRate) / 100);

  if (discountAmount > requestedAmount) {
    throw new ApiError(
      400,
      "Calculated discount amount cannot be greater than the Advertisement Amount."
    );
  }

  const advanceAmount = roundToTwo((requestedAmount * advanceRate) / 100);

  if (advanceAmount > requestedAmount) {
    throw new ApiError(
      400,
      "Calculated advance amount cannot be greater than the Advertisement Amount."
    );
  }

  return {
    advertisementAmount: requestedAmount,
    discountPercentage: discountRate,
    discountAmount,
    advancePercentage: advanceRate,
    advanceAmount
  };
};

const toCalculatedFinancialFields = (
  financials: AdvertisementFinancialCalculation
) => ({
  discountAmount: financials.discountAmount,
  advanceAmount: financials.advanceAmount
});

const validateWorkflowTransition = (
  currentStatus: AdvertisementWorkflowStatus,
  nextStatus: AdvertisementWorkflowStatus
): void => {
  if (currentStatus === nextStatus) {
    throw new ApiError(
      409,
      `Advertisement is already in '${currentStatus}' status.`
    );
  }

  const allowedStatuses = workflow[currentStatus];

  if (!allowedStatuses.includes(nextStatus)) {
    throw new ApiError(
      409,
      `Invalid advertisement workflow transition from '${currentStatus}' to '${nextStatus}'.`
    );
  }
};

const normalizeRemarks = (remarks: string | undefined): string | null => {
  if (remarks === undefined) {
    return null;
  }

  const trimmed = remarks.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const normalizeRequiredReason = (reason: string, message: string): string => {
  const trimmed = reason.trim();

  if (!trimmed) {
    throw new ApiError(400, message);
  }

  return trimmed;
};

/* ------------------------------------------------------------
 * Financial approval validation
 * ------------------------------------------------------------ */

const FINANCIAL_APPROVAL_PAGE_SIZE = 100;

const getLatestFinancialApproval = async (
  advertisementId: number,
  approvalType: AdvertisementFinancialApprovalType
): Promise<AdvertisementFinancialApproval | null> => {
  const result = await financialApprovalRepository.list({
    advertisementId,
    approvalType,
    page: 1,
    pageSize: FINANCIAL_APPROVAL_PAGE_SIZE
  });

  /*
   * The repository is expected to order records by requested_at DESC,
   * id DESC. Use the first result as the latest request.
   */
  return result.items[0] ?? null;
};

/**
 * Ensures an advertisement cannot proceed to approval/publication with an
 * outstanding balance unless a valid, approved CREDIT_EXCEPTION covers the
 * entire outstanding amount.
 *
 * A credit exception:
 * - Must have APPROVED status.
 * - Must not have been revoked.
 * - Must contain a positive approved amount.
 * - Must not have passed its expected payment due date.
 * - Covers only its approved amount; it does not count as a payment.
 *
 * Any uncovered balance continues to block the workflow transition.
 */
const validateCreditExceptionCoverage = async (
  advertisement: Advertisement
): Promise<void> => {
  const advertisementAmount =
    advertisement.advertisementAmount === null ||
    advertisement.advertisementAmount === undefined
      ? null
      : Number(advertisement.advertisementAmount);

  if (
    advertisementAmount === null ||
    !Number.isFinite(advertisementAmount) ||
    advertisementAmount <= 0
  ) {
    return;
  }

  let summary: Awaited<ReturnType<typeof paymentService.getPaymentSummary>>;

  try {
    summary = await paymentService.getPaymentSummary(advertisement.id);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.statusCode === 404 &&
      error.message === "Advertisement payment summary not found."
    ) {
      throw new ApiError(
        409,
        "The outstanding balance could not be verified because no payment summary exists. Advertisement approval is blocked until the payment balance can be determined."
      );
    }

    throw error;
  }

  const outstandingAmount =
    summary.outstandingAmount === null ||
    summary.outstandingAmount === undefined
      ? null
      : Number(summary.outstandingAmount);

  if (
    outstandingAmount === null ||
    !Number.isFinite(outstandingAmount) ||
    outstandingAmount < 0
  ) {
    throw new ApiError(
      409,
      "The outstanding balance could not be verified. Advertisement approval is blocked until the payment balance can be determined."
    );
  }

  if (outstandingAmount <= 0) {
    return;
  }

  const approval = await getLatestFinancialApproval(
    advertisement.id,
    "CREDIT_EXCEPTION"
  );

  if (!approval || approval.status !== "APPROVED") {
    throw new ApiError(
      409,
      `Advertisement approval is blocked because an outstanding balance of ${roundToTwo(outstandingAmount).toFixed(2)} remains unpaid. An approved credit exception covering the outstanding balance is required.`
    );
  }

  if (approval.revokedAt !== null && approval.revokedAt !== undefined) {
    throw new ApiError(
      409,
      "The credit exception has been revoked. Advertisement approval is blocked while an outstanding balance remains."
    );
  }

  const approvedAmount =
    approval.approvedAmount === null || approval.approvedAmount === undefined
      ? null
      : Number(approval.approvedAmount);

  if (
    approvedAmount === null ||
    !Number.isFinite(approvedAmount) ||
    approvedAmount <= 0
  ) {
    throw new ApiError(
      409,
      "The approved credit exception has no valid approved amount. Advertisement approval is blocked."
    );
  }

  const expectedDueDate = approval.expectedPaymentDueDate;

  if (!expectedDueDate) {
    throw new ApiError(
      409,
      "The approved credit exception has no expected payment due date. Advertisement approval is blocked."
    );
  }

  const dueDateText = String(expectedDueDate).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateText)) {
    throw new ApiError(
      409,
      "The approved credit exception has an invalid payment due date. Advertisement approval is blocked."
    );
  }

  const [year, month, day] = dueDateText.split("-").map(Number);

  const dueDate = new Date(Date.UTC(year!, month! - 1, day!));

  if (
    dueDate.getUTCFullYear() !== year ||
    dueDate.getUTCMonth() !== month! - 1 ||
    dueDate.getUTCDate() !== day
  ) {
    throw new ApiError(
      409,
      "The approved credit exception has an invalid payment due date. Advertisement approval is blocked."
    );
  }

  // The exception remains valid through the end of its due date (UTC).
  const dueDateEnd = dueDate.getTime() + 86_400_000;

  if (Date.now() >= dueDateEnd) {
    throw new ApiError(
      409,
      "The credit exception has expired because its expected payment due date has passed. Advertisement approval is blocked."
    );
  }

  const normalizedOutstanding = roundToTwo(outstandingAmount);
  const normalizedApprovedAmount = roundToTwo(approvedAmount);

  if (normalizedOutstanding > normalizedApprovedAmount) {
    const uncoveredAmount = roundToTwo(
      normalizedOutstanding - normalizedApprovedAmount
    );

    throw new ApiError(
      409,
      `Advertisement approval is blocked. The outstanding balance is ${normalizedOutstanding.toFixed(2)}, but the approved credit exception covers only ${normalizedApprovedAmount.toFixed(2)}. The uncovered balance is ${uncoveredAmount.toFixed(2)}.`
    );
  }
};

const isFinancialValueDifferent = (
  first: number | null | undefined,
  second: number | null | undefined
): boolean => {
  if (first === null || first === undefined) {
    return second !== null && second !== undefined;
  }

  if (second === null || second === undefined) {
    return true;
  }

  return roundToTwo(Number(first)) !== roundToTwo(Number(second));
};

/**
 * Prevents commercial updates from bypassing DISCOUNT financial approval.
 *
 * Rules:
 * - SUBMITTED/HOLD: block changes to discount terms until the request is
 *   resolved.
 * - APPROVED: enforce the approved percentage and amount limits.
 * - REJECTED: a rejected request is not authorization to increase the
 *   existing discount. Reducing the discount remains allowed.
 * - REVOKED: the approval no longer authorizes an increase.
 *
 * Standard Amount is not editable through this approval check.
 */
const validateDiscountApproval = async (
  advertisement: Advertisement,
  financials: AdvertisementFinancialCalculation
): Promise<void> => {
  const discountChanged =
    isFinancialValueDifferent(
      advertisement.discountPercentage,
      financials.discountPercentage
    ) ||
    isFinancialValueDifferent(
      advertisement.discountAmount,
      financials.discountAmount
    );

  if (!discountChanged) {
    return;
  }

  const approval = await getLatestFinancialApproval(
    advertisement.id,
    "DISCOUNT"
  );

  /*
   * Preserve existing behaviour when no DISCOUNT request exists.
   * Thresholds and approval-request creation belong to the financial
   * approval workflow.
   */
  if (!approval) {
    return;
  }

  if (approval.status === "SUBMITTED" || approval.status === "HOLD") {
    throw new ApiError(
      409,
      "A discount financial approval is pending or on hold. Commercial discount changes cannot be saved until the request is resolved."
    );
  }

  const currentDiscountPercentage = Number(
    advertisement.discountPercentage ?? 0
  );

  const currentDiscountAmount = Number(advertisement.discountAmount ?? 0);

  /*
   * A revoked approval cannot authorize an increase. Permit reductions,
   * but do not treat the revoked approval's limits as current permission.
   */
  if (
    approval.status === "APPROVED" &&
    approval.revokedAt !== null &&
    approval.revokedAt !== undefined
  ) {
    if (
      financials.discountPercentage >
        currentDiscountPercentage + Number.EPSILON ||
      financials.discountAmount > currentDiscountAmount + 0.009
    ) {
      throw new ApiError(
        409,
        "The discount approval has been revoked. A new financial approval is required before increasing the discount."
      );
    }

    return;
  }

  if (approval.status === "APPROVED") {
    if (
      approval.approvedPercentage === null &&
      approval.approvedAmount === null
    ) {
      throw new ApiError(
        409,
        "The approved discount request does not contain an approved percentage or amount. Please review the financial approval before editing the discount."
      );
    }

    if (
      approval.approvedPercentage !== null &&
      financials.discountPercentage >
        Number(approval.approvedPercentage) + Number.EPSILON
    ) {
      throw new ApiError(
        409,
        `The discount percentage exceeds the approved limit of ${approval.approvedPercentage}%.`
      );
    }

    if (
      approval.approvedAmount !== null &&
      financials.discountAmount > Number(approval.approvedAmount) + 0.009
    ) {
      throw new ApiError(
        409,
        `The calculated discount amount exceeds the approved limit of ${roundToTwo(Number(approval.approvedAmount)).toFixed(2)}.`
      );
    }

    return;
  }

  if (approval.status === "REJECTED") {
    /*
     * Do not compare against the rejected request's limits as if they were
     * authorization. For example, a rejected 10% request must not allow a
     * new 9% discount when the saved discount was previously 0%.
     *
     * A lower discount can still be saved, but the update cannot increase
     * either the saved percentage or the saved calculated discount amount.
     */
    if (
      financials.discountPercentage >
        currentDiscountPercentage + Number.EPSILON ||
      financials.discountAmount > currentDiscountAmount + 0.009
    ) {
      throw new ApiError(
        409,
        "The discount request was rejected. Increasing the existing discount requires a new financial approval."
      );
    }
  }
};

/**
 * Prevents Advertisement Amount changes from bypassing an ADJUSTMENT
 * financial approval.
 *
 * The approved amount represents the maximum permitted absolute change
 * from the previously saved Advertisement Amount.
 *
 * Standard Amount and pricing snapshots remain system-derived.
 */
const validateAdjustmentApproval = async (
  advertisement: Advertisement,
  nextAdvertisementAmount: number | null
): Promise<void> => {
  const currentAdvertisementAmount =
    advertisement.advertisementAmount === null ||
    advertisement.advertisementAmount === undefined
      ? null
      : Number(advertisement.advertisementAmount);

  if (
    !isFinancialValueDifferent(
      currentAdvertisementAmount,
      nextAdvertisementAmount
    )
  ) {
    return;
  }

  const approval = await getLatestFinancialApproval(
    advertisement.id,
    "ADJUSTMENT"
  );

  if (!approval) {
    return;
  }

  if (approval.status === "SUBMITTED" || approval.status === "HOLD") {
    throw new ApiError(
      409,
      "An adjustment financial approval is pending or on hold. Advertisement Amount cannot be changed until the request is resolved."
    );
  }

  if (approval.status === "REJECTED") {
    throw new ApiError(
      409,
      "The adjustment request was rejected. Submit a new financial approval before applying an Advertisement Amount change."
    );
  }

  if (approval.status === "APPROVED") {
    if (approval.revokedAt !== null && approval.revokedAt !== undefined) {
      throw new ApiError(
        409,
        "The adjustment approval has been revoked. Submit a new financial approval before changing Advertisement Amount."
      );
    }

    if (approval.approvedAmount === null) {
      throw new ApiError(
        409,
        "The approved adjustment request does not contain an approved amount. Please review the financial approval before changing Advertisement Amount."
      );
    }

    const approvedAdjustmentAmount = Number(approval.approvedAmount);

    if (
      !Number.isFinite(approvedAdjustmentAmount) ||
      approvedAdjustmentAmount < 0
    ) {
      throw new ApiError(
        409,
        "The approved adjustment amount is invalid. Please review the financial approval before changing Advertisement Amount."
      );
    }

    const changeAmount = roundToTwo(
      Math.abs(
        (nextAdvertisementAmount ?? 0) - (currentAdvertisementAmount ?? 0)
      )
    );

    if (changeAmount > approvedAdjustmentAmount + 0.009) {
      throw new ApiError(
        409,
        `The Advertisement Amount change exceeds the approved adjustment limit of ${roundToTwo(approvedAdjustmentAmount).toFixed(2)}.`
      );
    }
  }
};

/**
 * Validates financial approvals before commercial changes are persisted.
 *
 * DISCOUNT requests govern discount percentage and calculated discount
 * amount.
 * ADJUSTMENT requests govern changes to Advertisement Amount.
 * REFUND and PARTIAL_REFUND concern payment operations.
 * CREDIT_EXCEPTION is a separate payment workflow and does not authorize
 * discounts, Advertisement Amount changes, or money received.
 */
const validateCommercialFinancialApprovals = async (
  advertisement: Advertisement,
  input: UpdateAdvertisementInputWithPlacement,
  financials: AdvertisementFinancialCalculation
): Promise<void> => {
  const discountOrAmountWasProvided =
    input.discountPercentage !== undefined ||
    input.advertisementAmount !== undefined;

  if (!discountOrAmountWasProvided) {
    return;
  }

  await validateDiscountApproval(advertisement, financials);

  await validateAdjustmentApproval(
    advertisement,
    financials.advertisementAmount
  );
};

/* ------------------------------------------------------------
 * Placement validation
 * ------------------------------------------------------------ */

const validatePlacementSelection = async (
  placementId: number | null | undefined,
  client?: import("pg").PoolClient
): Promise<void> => {
  if (placementId === undefined || placementId === null) {
    throw new ApiError(400, "Advertisement placement is required.");
  }

  if (!Number.isInteger(placementId) || placementId <= 0) {
    throw new ApiError(400, "Advertisement placement is invalid.");
  }

  const db = client ?? pool;

  const result = await db.query<{
    id: number | string;
    status: string;
    is_enabled: boolean;
  }>(
    `
      SELECT
        id,
        status,
        is_enabled
      FROM advertisement_placements
      WHERE id = $1
      LIMIT 1
    `,
    [placementId]
  );

  const placement = result.rows[0];

  if (!placement) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  if (placement.status !== "ACTIVE" || !placement.is_enabled) {
    throw new ApiError(
      409,
      "The selected advertisement placement is not active."
    );
  }
};

/* ------------------------------------------------------------
 * Workflow transition
 * ------------------------------------------------------------ */

const changeWorkflowStatus = async (
  id: number,
  nextStatus: AdvertisementWorkflowStatus,
  performedBy: number,
  options: {
    reason?: string | null;
    remarks?: string | null;
  } = {}
): Promise<AdvertisementWorkflowResult> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const advertisement = await repository.findByIdForUpdate(id, client);

    if (!advertisement) {
      throw new ApiError(404, "Advertisement not found.");
    }

    validateWorkflowTransition(advertisement.workflowStatus, nextStatus);

    /*
     * Every transition to APPROVED must pass the outstanding-balance check.
     * This covers initial Ad Manager approval and resuming an advertisement
     * previously placed on hold.
     */
    if (nextStatus === "APPROVED") {
      await validateCreditExceptionCoverage(advertisement);
    }

    const reason = options.reason ?? null;
    const remarks = options.remarks ?? null;

    if (nextStatus === "REJECTED" && !reason) {
      throw new ApiError(400, "Rejection reason is required.");
    }

    if (nextStatus === "ON_HOLD" && !reason) {
      throw new ApiError(400, "Hold reason is required.");
    }

    const transitionReason = reason ?? remarks;

    const updated = await repository.changeWorkflowStatus(
      id,
      advertisement.workflowStatus,
      nextStatus,
      performedBy,
      transitionReason,
      client
    );

    if (!updated) {
      throw new ApiError(
        409,
        "Advertisement workflow changed before this operation could be completed."
      );
    }

    const history = await repository.createWorkflowHistory(
      id,
      advertisement.workflowStatus,
      nextStatus,
      remarks,
      performedBy,
      client
    );

    // Archiving is both a workflow transition and an operational shutdown.
    // Cancel every recoverable schedule in the same transaction so neither
    // stale ACTIVE schedules nor a later manual activation can revive it.
    let resultAdvertisement = updated;
    if (nextStatus === "ARCHIVED") {
      await client.query(
        `UPDATE advertisement_schedules
         SET status = 'CANCELLED', updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE advertisement_id = $1
           AND status IN ('SCHEDULED', 'ACTIVE', 'PAUSED')`,
        [id, performedBy]
      );

      await client.query(
        `UPDATE advertisements
         SET status = 'ARCHIVED', updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id, performedBy]
      );

      await client.query(
        `INSERT INTO public.advertisement_operational_audit
         (advertisement_id, event_type, previous_status, new_status, remarks, performed_by)
         VALUES ($1, 'ARCHIVED', $2, 'ARCHIVED', $3, $4)`,
        [id, advertisement.status, transitionReason, performedBy]
      );

      const reloaded = await repository.findById(id, client);
      if (!reloaded) {
        throw new ApiError(
          500,
          "Advertisement was archived but could not be reloaded."
        );
      }
      resultAdvertisement = reloaded;
    }

    /*
     * A workflow hold must also stop operational delivery. Preserve the
     * approved workflow state on later release, but require the explicit
     * manual activation action before delivery can resume.
     */
    if (nextStatus === "ON_HOLD") {
      // A hold must pause any active schedule even if the advertisement's
      // operational status was already INACTIVE (for example, a prior pause).
      await client.query(
        `UPDATE advertisement_schedules
         SET status = 'PAUSED', updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE advertisement_id = $1 AND status = 'ACTIVE'`,
        [id, performedBy]
      );

      if (advertisement.status === "ACTIVE") {
        await client.query(
          `UPDATE advertisements
           SET status = 'INACTIVE', updated_by = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND status = 'ACTIVE'`,
          [id, performedBy]
        );
        await client.query(
          `INSERT INTO public.advertisement_operational_audit
           (advertisement_id, event_type, previous_status, new_status, remarks, performed_by)
           VALUES ($1, 'HELD', 'ACTIVE', 'INACTIVE', $2, $3)`,
          [id, transitionReason, performedBy]
        );
        const reloaded = await repository.findById(id, client);
        if (!reloaded)
          throw new ApiError(
            500,
            "Advertisement was placed on hold but could not be reloaded."
          );
        resultAdvertisement = reloaded;
      }
    }

    await client.query("COMMIT");

    return {
      advertisement: resultAdvertisement,
      history
    };
  } catch (error) {
    console.error("ADVERTISEMENT WORKFLOW ERROR:", error);

    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

/* ------------------------------------------------------------
 * Create
 * ------------------------------------------------------------ */

export const createAdvertisement = async (
  input: CreateAdvertisementInputWithPlacement,
  createdBy: number
): Promise<Advertisement> => {
  validateCampaignWindow(input.startAt, input.endAt);

  if (input.isHouseAd) {
    if (input.clientId !== undefined && input.clientId !== null) {
      throw new ApiError(400, "House advertisements cannot have a client.");
    }

    if (input.campaignId !== undefined) {
      throw new ApiError(400, "House advertisements cannot have a campaign.");
    }
  } else {
    if (input.clientId === undefined || input.clientId === null) {
      throw new ApiError(400, "Client is required for paid advertisements.");
    }

    const client = await repository.findClientById(input.clientId);

    if (!client) {
      throw new ApiError(404, "Advertisement client not found.");
    }

    if (client.status !== "ACTIVE") {
      throw new ApiError(
        409,
        "Advertisement cannot be created for an inactive or blocked client."
      );
    }

    if (client.adCreationHold) {
      throw new ApiError(
        409,
        client.adCreationHoldReason
          ? `Advertisement creation is currently on hold: ${client.adCreationHoldReason}`
          : "Advertisement creation is currently on hold for this client."
      );
    }
  }

  if (input.campaignId !== undefined) {
    const campaignExists = await repository.existsCampaignById(
      input.campaignId
    );

    if (!campaignExists) {
      throw new ApiError(404, "Advertisement campaign not found.");
    }
  }

  /*
   * Remove placementId before spreading the input into repository.create().
   * This avoids passing `placementId?: number | null` to a repository input
   * whose optional placement property may only accept a number.
   */
  const { placementId: inputPlacementId, ...inputWithoutPlacement } = input;

  const runtimePlacementId =
    inputPlacementId ?? input.pricing?.placementId ?? undefined;

  await validatePlacementSelection(runtimePlacementId);

  if (
    input.pricing?.placementId !== undefined &&
    inputPlacementId !== undefined &&
    inputPlacementId !== null &&
    input.pricing.placementId !== inputPlacementId
  ) {
    throw new ApiError(
      400,
      "Advertisement placement and pricing placement must match."
    );
  }

  /*
   * Without a pricing object, use the selected runtime placement without
   * creating a rate-card snapshot.
   */
  if (!input.pricing) {
    const financials = calculateAdvertisementFinancials(
      input.advertisementAmount,
      input.discountPercentage,
      input.advancePercentage
    );

    return repository.create(
      {
        ...inputWithoutPlacement,
        placementId: runtimePlacementId as number,

        ...(financials.advertisementAmount !== null
          ? { advertisementAmount: financials.advertisementAmount }
          : {}),

        discountPercentage: financials.discountPercentage,
        advancePercentage: financials.advancePercentage,
        ...toCalculatedFinancialFields(financials)
      },
      createdBy
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const effectiveAt = input.startAt ? new Date(input.startAt) : new Date();

    if (Number.isNaN(effectiveAt.getTime())) {
      throw new ApiError(400, "Advertisement start date/time is invalid.");
    }

    const rateCard = await rateCardRepository.findEffectiveRate(
      input.pricing.placementId,
      input.pricing.pricingUnit,
      effectiveAt,
      client
    );

    if (!rateCard) {
      throw new ApiError(
        404,
        "No active rate card is available for the specified placement and pricing unit."
      );
    }

    if (rateCard.placementId !== input.pricing.placementId) {
      throw new ApiError(
        400,
        "The effective rate card does not belong to the specified placement."
      );
    }

    if (rateCard.pricingUnit !== input.pricing.pricingUnit) {
      throw new ApiError(
        400,
        "The effective rate card does not match the specified pricing unit."
      );
    }

    const standardAmountResult = calculateStandardAmount({
      pricingUnit: rateCard.pricingUnit,
      rateAmount: rateCard.rateAmount,
      quantity: input.pricing.quantity,
      currencyCode: rateCard.currencyCode
    });

    const pricedFinancials = calculateAdvertisementFinancials(
      input.advertisementAmount,
      input.discountPercentage,
      input.advancePercentage,
      standardAmountResult.standardAmount
    );

    const advertisement = await repository.create(
      {
        ...inputWithoutPlacement,
        placementId: runtimePlacementId as number,

        ...(pricedFinancials.advertisementAmount !== null
          ? { advertisementAmount: pricedFinancials.advertisementAmount }
          : {}),

        discountPercentage: pricedFinancials.discountPercentage,
        advancePercentage: pricedFinancials.advancePercentage,
        ...toCalculatedFinancialFields(pricedFinancials),

        standardAmount: standardAmountResult.standardAmount,
        pricingPlacementId: input.pricing.placementId,
        pricingUnit: input.pricing.pricingUnit,
        pricingQuantity: input.pricing.quantity,
        currencyCode: rateCard.currencyCode
      },
      createdBy,
      client
    );

    await pricingSnapshotService.createFromRateCard(
      advertisement.id,
      input.pricing.placementId,
      rateCard.id,
      createdBy,
      client
    );

    await client.query("COMMIT");

    return advertisement;
  } catch (error) {
    console.error("ADVERTISEMENT PRICING CREATION ERROR:", error);

    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

/* ------------------------------------------------------------
 * Get
 * ------------------------------------------------------------ */

export const getAdvertisementById = async (
  id: number
): Promise<Advertisement> => {
  const advertisement = await repository.findById(id);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  return advertisement;
};

export const getAdvertisements = async (
  filters: AdvertisementSearchFilters
) => {
  return repository.list(filters);
};

/* ------------------------------------------------------------
 * Update
 * ------------------------------------------------------------ */

export const updateAdvertisement = async (
  id: number,
  input: UpdateAdvertisementInputWithPlacement,
  updatedBy: number
): Promise<Advertisement> => {
  const advertisement = await repository.findById(id);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  if (advertisement.workflowStatus === "APPROVED") {
    throw new ApiError(409, "Approved advertisements cannot be edited.");
  }

  if (advertisement.workflowStatus === "SUBMITTED") {
    throw new ApiError(
      409,
      "Submitted advertisements cannot be edited until the review workflow changes their status."
    );
  }

  if (advertisement.workflowStatus === "ARCHIVED") {
    throw new ApiError(409, "Archived advertisements cannot be edited.");
  }

  if (input.campaignId !== undefined) {
    const campaignExists = await repository.existsCampaignById(
      input.campaignId
    );

    if (!campaignExists) {
      throw new ApiError(404, "Advertisement campaign not found.");
    }
  }

  const mergedClickable = input.isClickable ?? advertisement.isClickable;

  const mergedDestinationUrl =
    input.destinationUrl ?? advertisement.destinationUrl;

  if (mergedClickable && !mergedDestinationUrl) {
    throw new ApiError(
      400,
      "Destination URL is required when the advertisement is clickable."
    );
  }

  const mergedStartAt = input.startAt ?? advertisement.startAt;
  const mergedEndAt = input.endAt ?? advertisement.endAt;

  validateCampaignWindow(mergedStartAt, mergedEndAt);

  /*
   * Placement is mandatory during creation. On update it is optional,
   * allowing existing advertisements to retain their current placement.
   */
  if (input.placementId !== undefined && input.placementId !== null) {
    await validatePlacementSelection(input.placementId);
  } else if (advertisement.placement === null) {
    throw new ApiError(
      409,
      "Advertisement does not have a persisted placement. Please select a placement before saving."
    );
  }

  const mergedDiscountPercentage =
    input.discountPercentage ?? advertisement.discountPercentage;

  const mergedAdvancePercentage =
    input.advancePercentage ?? advertisement.advancePercentage;

  const scheduleChanged =
    input.startAt !== undefined || input.endAt !== undefined;

  let recalculatedStandardAmount = advertisement.standardAmount;
  let recalculatedPricingQuantity = Number(advertisement.pricingQuantity);
  let effectiveRateCardId: number | null = null;
  let effectivePricingPlacementId = advertisement.pricingPlacementId;
  let effectivePricingUnit = advertisement.pricingUnit;
  let effectiveCurrencyCode = input.currencyCode ?? advertisement.currencyCode;

  if (
    scheduleChanged &&
    effectivePricingPlacementId !== null &&
    effectivePricingPlacementId !== undefined &&
    effectivePricingUnit !== null &&
    effectivePricingUnit !== undefined
  ) {
    const startDate = mergedStartAt
      ? mergedStartAt instanceof Date
        ? new Date(mergedStartAt.getTime())
        : new Date(mergedStartAt)
      : null;

    const endDate = mergedEndAt
      ? mergedEndAt instanceof Date
        ? new Date(mergedEndAt.getTime())
        : new Date(mergedEndAt)
      : null;

    if (
      !startDate ||
      !endDate ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      throw new ApiError(
        400,
        "Valid start and end dates are required to recalculate placement pricing."
      );
    }

    if (endDate.getTime() <= startDate.getTime()) {
      throw new ApiError(400, "End date/time must be after start date/time.");
    }

    if (effectivePricingUnit === "DAY") {
      const startUtc = Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate()
      );

      const endUtc = Date.UTC(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth(),
        endDate.getUTCDate()
      );

      recalculatedPricingQuantity =
        Math.floor((endUtc - startUtc) / 86_400_000) + 1;
    }

    if (
      !Number.isFinite(recalculatedPricingQuantity) ||
      recalculatedPricingQuantity <= 0
    ) {
      throw new ApiError(
        400,
        "A positive pricing quantity is required to calculate Standard Amount."
      );
    }

    const rateCard = await rateCardRepository.findEffectiveRate(
      Number(effectivePricingPlacementId),
      effectivePricingUnit,
      startDate
    );

    if (!rateCard) {
      throw new ApiError(
        409,
        "No active rate card is effective for the selected placement and pricing unit on the new schedule start date."
      );
    }

    const standardAmountResult = calculateStandardAmount({
      pricingUnit: rateCard.pricingUnit,
      rateAmount: rateCard.rateAmount,
      quantity: recalculatedPricingQuantity,
      currencyCode: rateCard.currencyCode
    });

    recalculatedStandardAmount = standardAmountResult.standardAmount;
    effectiveRateCardId = rateCard.id;
    effectiveCurrencyCode = rateCard.currencyCode;
  }

  const mergedAdvertisementAmount =
    input.advertisementAmount ?? advertisement.advertisementAmount;

  const financials = calculateAdvertisementFinancials(
    mergedAdvertisementAmount,
    mergedDiscountPercentage,
    mergedAdvancePercentage,
    recalculatedStandardAmount === null ||
      recalculatedStandardAmount === undefined
      ? null
      : Number(recalculatedStandardAmount)
  );

  /*
   * Server-side financial approval enforcement.
   *
   * This check runs before repository.update(), so the frontend cannot
   * bypass the approved limits by sending a direct API request.
   *
   * DISCOUNT controls discount percentage and calculated discount amount.
   * ADJUSTMENT controls changes to Advertisement Amount.
   * Refunds and credit exceptions remain separate payment workflows.
   */
  await validateCommercialFinancialApprovals(advertisement, input, financials);

  /*
   * Remove placementId from the spread so null/undefined is never passed
   * to repository.update() for an optional property.
   *
   * This is required with exactOptionalPropertyTypes enabled.
   */
  const { placementId, ...updateInput } = input;

  const updatePayload = {
    ...updateInput,

    ...(placementId !== undefined && placementId !== null
      ? { placementId }
      : {}),

    ...(financials.advertisementAmount !== null
      ? { advertisementAmount: financials.advertisementAmount }
      : {}),

    discountPercentage: financials.discountPercentage,
    advancePercentage: financials.advancePercentage,
    ...toCalculatedFinancialFields(financials),

    ...(scheduleChanged && effectiveRateCardId !== null
      ? {
          standardAmount: Number(recalculatedStandardAmount),
          pricingPlacementId: Number(effectivePricingPlacementId),
          pricingUnit: effectivePricingUnit,
          pricingQuantity: recalculatedPricingQuantity,
          currencyCode: effectiveCurrencyCode
        }
      : {})
  };

  let updated: Advertisement | null;

  if (scheduleChanged && effectiveRateCardId !== null) {
    /*
     * Keep the schedule, recalculated pricing, and pricing snapshot in one
     * transaction. Any failure rolls the entire change back.
     */
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      updated = await repository.update(id, updatePayload, updatedBy, client);

      if (!updated) {
        throw new ApiError(404, "Advertisement not found.");
      }

      if (effectivePricingPlacementId === null) {
        throw new ApiError(
          409,
          "Pricing placement is required to record the rate snapshot."
        );
      }

      await pricingSnapshotService.createFromRateCard(
        id,
        Number(effectivePricingPlacementId),
        effectiveRateCardId,
        updatedBy,
        client
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    updated = await repository.update(id, updatePayload, updatedBy);

    if (!updated) {
      throw new ApiError(404, "Advertisement not found.");
    }
  }

  return updated;
};

/* ------------------------------------------------------------
 * Workflow API
 * ------------------------------------------------------------ */

export const submitAdvertisement = async (
  id: number,
  submittedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<AdvertisementWorkflowResult> =>
  changeWorkflowStatus(id, "SUBMITTED", submittedBy, {
    remarks: normalizeRemarks(input.remarks)
  });

export const approveAdvertisement = async (
  id: number,
  approvedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<AdvertisementWorkflowResult> =>
  changeWorkflowStatus(id, "APPROVED", approvedBy, {
    remarks: normalizeRemarks(input.remarks)
  });

export const rejectAdvertisement = async (
  id: number,
  rejectedBy: number,
  input: AdvertisementRejectInput
): Promise<AdvertisementWorkflowResult> => {
  const reason = normalizeRequiredReason(
    input.reason,
    "Rejection reason is required."
  );

  return changeWorkflowStatus(id, "REJECTED", rejectedBy, {
    reason,
    remarks: normalizeRemarks(input.remarks)
  });
};

export const holdAdvertisement = async (
  id: number,
  heldBy: number,
  input: AdvertisementHoldInput
): Promise<AdvertisementWorkflowResult> => {
  const reason = normalizeRequiredReason(
    input.reason,
    "Hold reason is required."
  );

  return changeWorkflowStatus(id, "ON_HOLD", heldBy, {
    reason,
    remarks: normalizeRemarks(input.remarks)
  });
};

export const resumeAdvertisement = async (
  id: number,
  resumedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<AdvertisementWorkflowResult> =>
  changeWorkflowStatus(id, "APPROVED", resumedBy, {
    remarks: normalizeRemarks(input.remarks)
  });

/* ------------------------------------------------------------
 * Operational pause / stop controls
 * ------------------------------------------------------------ */

const changeOperationalState = async (
  id: number,
  performedBy: number,
  action: "PAUSE" | "STOP",
  input: AdvertisementWorkflowInput = {}
): Promise<Advertisement> => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Advertisement ID must be a positive integer.");
  }
  if (!Number.isInteger(performedBy) || performedBy <= 0) {
    throw new ApiError(400, "Performed by must be a positive integer.");
  }
  const remarks = normalizeRemarks(input.remarks);
  if (!remarks) {
    throw new ApiError(
      400,
      `Remarks are required to ${action.toLowerCase()} an advertisement.`
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await repository.findByIdForUpdate(id, client);
    if (!current) throw new ApiError(404, "Advertisement not found.");
    if (current.workflowStatus !== "APPROVED") {
      throw new ApiError(
        409,
        "Only approved advertisements can be paused or stopped operationally."
      );
    }
    if (current.status === "ARCHIVED") {
      throw new ApiError(
        409,
        "Archived advertisements cannot be paused or stopped."
      );
    }
    if (current.status !== "ACTIVE") {
      throw new ApiError(
        409,
        `Only ACTIVE advertisements can be ${action === "PAUSE" ? "paused" : "stopped"}.`
      );
    }

    // Pause keeps schedules recoverable for manual re-activation. Stop cancels
    // current/future schedules, requiring new schedules before re-activation.
    const scheduleStatus = action === "PAUSE" ? "PAUSED" : "CANCELLED";
    const allowedStatuses =
      action === "PAUSE"
        ? "status = 'ACTIVE'"
        : "status IN ('SCHEDULED', 'ACTIVE', 'PAUSED')";
    await client.query(
      `UPDATE advertisement_schedules
       SET status = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
       WHERE advertisement_id = $1 AND ${allowedStatuses}`,
      [id, scheduleStatus, performedBy]
    );

    const updated = await client.query<{ id: number | string }>(
      `UPDATE advertisements
       SET status = 'INACTIVE', updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'ACTIVE' AND workflow_status = 'APPROVED'
       RETURNING id`,
      [id, performedBy]
    );
    if (!updated.rows[0]) {
      throw new ApiError(
        409,
        "Advertisement operational status changed before the action completed."
      );
    }
    await client.query(
      `INSERT INTO public.advertisement_operational_audit
       (advertisement_id, event_type, previous_status, new_status, remarks, performed_by)
       VALUES ($1, $2, 'ACTIVE', 'INACTIVE', $3, $4)`,
      [id, action === "PAUSE" ? "PAUSED" : "STOPPED", remarks, performedBy]
    );
    const result = await repository.findById(id, client);
    if (!result)
      throw new ApiError(
        500,
        "Advertisement state was changed but could not be reloaded."
      );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const pauseAdvertisement = (
  id: number,
  pausedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<Advertisement> =>
  changeOperationalState(id, pausedBy, "PAUSE", input);

export const stopAdvertisement = (
  id: number,
  stoppedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<Advertisement> =>
  changeOperationalState(id, stoppedBy, "STOP", input);

/* ------------------------------------------------------------
 * Operational activation validation
 * ------------------------------------------------------------ */

interface ActivationScheduleRow {
  id: number | string;
  advertisement_id: number | string;
  placement_id: number | string;
  placement_rule_id: number | string | null;
  start_at: Date | string;
  end_at: Date | string;
}

interface ActivationPlacementRow {
  id: number | string;
  status: string;
  is_enabled: boolean;
  format_id: number | string | null;
  format_status: string | null;
  width_px: number | string | null;
  height_px: number | string | null;
  mobile_width_px: number | string | null;
  mobile_height_px: number | string | null;
}

interface ActivationCreativeRow {
  id: number | string;
  format_id: number | string | null;
  creative_type: string;
  variant: "DESKTOP" | "MOBILE";
  media_url: string;
  width_px: number | string | null;
  height_px: number | string | null;
  is_primary: boolean;
  status: string;
  creative_format_status: string | null;
}

interface ActivationCreativeDimensions {
  width: number;
  height: number;
}

const ACTIVATION_DIMENSION_TOLERANCE_PX = 10;

const parseActivationDimension = (
  value: number | string | null,
  label: string
): number => {
  if (value === null) {
    throw new ApiError(409, `${label} is not configured.`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(409, `${label} must be a positive number.`);
  }

  return parsed;
};

const validateActivationCreativeDimensions = (
  creative: ActivationCreativeRow,
  expected: ActivationCreativeDimensions
): void => {
  const actualWidth = parseActivationDimension(
    creative.width_px,
    `Creative ${creative.id} width`
  );

  const actualHeight = parseActivationDimension(
    creative.height_px,
    `Creative ${creative.id} height`
  );

  if (
    Math.abs(actualWidth - expected.width) >
      ACTIVATION_DIMENSION_TOLERANCE_PX ||
    Math.abs(actualHeight - expected.height) > ACTIVATION_DIMENSION_TOLERANCE_PX
  ) {
    throw new ApiError(
      409,
      `Creative ${creative.id} does not match its placement format. Expected ${expected.width} × ${expected.height}px, received ${actualWidth} × ${actualHeight}px. The permitted difference is ${ACTIVATION_DIMENSION_TOLERANCE_PX}px per dimension.`
    );
  }
};

const validateActivationCreatives = async (
  advertisementId: number,
  placement: ActivationPlacementRow,
  client: import("pg").PoolClient
): Promise<void> => {
  if (placement.format_id === null || placement.format_status !== "ACTIVE") {
    throw new ApiError(
      409,
      "The selected placement must have an active advertisement format before activation."
    );
  }

  const desktopWidth = parseActivationDimension(
    placement.width_px,
    "Placement desktop format width"
  );

  const desktopHeight = parseActivationDimension(
    placement.height_px,
    "Placement desktop format height"
  );

  const mobileWidthConfigured = placement.mobile_width_px !== null;
  const mobileHeightConfigured = placement.mobile_height_px !== null;

  if (mobileWidthConfigured !== mobileHeightConfigured) {
    throw new ApiError(
      409,
      "The placement mobile format dimensions are incomplete. Configure both mobile width and height, or leave both unset."
    );
  }

  const mobileExpected: ActivationCreativeDimensions | null =
    mobileWidthConfigured && mobileHeightConfigured
      ? {
          width: parseActivationDimension(
            placement.mobile_width_px,
            "Placement mobile format width"
          ),
          height: parseActivationDimension(
            placement.mobile_height_px,
            "Placement mobile format height"
          )
        }
      : null;

  const result = await client.query<ActivationCreativeRow>(
    `
      SELECT
        c.id,
        c.format_id,
        c.creative_type,
        c.variant,
        c.media_url,
        c.width_px,
        c.height_px,
        c.is_primary,
        c.status,
        f.status AS creative_format_status
      FROM advertisement_creatives c
      LEFT JOIN advertisement_formats f
        ON f.id = c.format_id
      WHERE
        c.advertisement_id = $1
        AND c.status = 'ACTIVE'
      ORDER BY
        c.variant ASC,
        c.is_primary DESC,
        c.display_order ASC,
        c.id ASC
      FOR UPDATE OF c
    `,
    [advertisementId]
  );

  const creatives = result.rows;

  if (creatives.length === 0) {
    throw new ApiError(
      409,
      "At least one active creative is required before activation."
    );
  }

  const limits = await rotationRepository.findRotationLimits(client);

  if (creatives.length > limits.maxActiveCreativesPerAdvertisement) {
    throw new ApiError(
      409,
      `The advertisement has ${creatives.length} active creatives. The configured maximum is ${limits.maxActiveCreativesPerAdvertisement}. Deactivate excess creatives before activation.`
    );
  }

  const desktopCreatives = creatives.filter(
    (creative) => creative.variant === "DESKTOP"
  );

  const mobileCreatives = creatives.filter(
    (creative) => creative.variant === "MOBILE"
  );

  const desktopPrimary = desktopCreatives.filter(
    (creative) => creative.is_primary
  );

  const mobilePrimary = mobileCreatives.filter(
    (creative) => creative.is_primary
  );

  if (desktopPrimary.length !== 1) {
    throw new ApiError(
      409,
      "Exactly one active primary desktop creative is required before activation."
    );
  }

  if (mobileCreatives.length > 0 && mobilePrimary.length !== 1) {
    throw new ApiError(
      409,
      "When mobile creatives are configured, exactly one active primary mobile creative is required."
    );
  }

  if (mobileCreatives.length > 0 && mobileExpected === null) {
    throw new ApiError(
      409,
      "Active mobile creatives cannot be activated because the placement has no complete mobile format dimensions."
    );
  }

  for (const creative of creatives) {
    if (!creative.media_url?.trim()) {
      throw new ApiError(
        409,
        `Creative ${creative.id} does not have usable media or content.`
      );
    }

    if (
      creative.format_id === null ||
      creative.creative_format_status !== "ACTIVE"
    ) {
      throw new ApiError(
        409,
        `Creative ${creative.id} must use an active advertisement format.`
      );
    }

    if (Number(creative.format_id) !== Number(placement.format_id)) {
      throw new ApiError(
        409,
        `Creative ${creative.id} does not use the selected placement format.`
      );
    }

    const expectedDimensions =
      creative.variant === "DESKTOP"
        ? {
            width: desktopWidth,
            height: desktopHeight
          }
        : mobileExpected;

    if (expectedDimensions === null) {
      throw new ApiError(
        409,
        `Creative ${creative.id} cannot be validated because its variant has no configured placement dimensions.`
      );
    }

    validateActivationCreativeDimensions(creative, expectedDimensions);
  }
};

const validateActivationPlacement = async (
  advertisementId: number,
  schedule: ActivationScheduleRow,
  client: import("pg").PoolClient
): Promise<void> => {
  const placementResult = await client.query<ActivationPlacementRow>(
    `
      SELECT
        p.id,
        p.status,
        p.is_enabled,
        p.format_id,
        f.status AS format_status,
        f.width_px,
        f.height_px,
        f.mobile_width_px,
        f.mobile_height_px
      FROM advertisement_placements p
      LEFT JOIN advertisement_formats f
        ON f.id = p.format_id
      WHERE p.id = $1
      FOR UPDATE OF p
    `,
    [schedule.placement_id]
  );

  const placement = placementResult.rows[0];

  if (!placement) {
    throw new ApiError(
      409,
      `Placement for schedule ${schedule.id} was not found.`
    );
  }

  if (placement.status !== "ACTIVE" || placement.is_enabled !== true) {
    throw new ApiError(
      409,
      `Placement for schedule ${schedule.id} is not active and enabled.`
    );
  }

  let hasValidRule = false;

  if (schedule.placement_rule_id !== null) {
    const ruleResult = await client.query<{ id: number | string }>(
      `
        SELECT id
        FROM advertisement_placement_rules
        WHERE
          id = $1
          AND advertisement_id = $2
          AND placement_id = $3
          AND status = 'ACTIVE'
        LIMIT 1
        FOR UPDATE
      `,
      [schedule.placement_rule_id, advertisementId, schedule.placement_id]
    );

    hasValidRule = ruleResult.rows.length > 0;
  } else {
    const ruleResult = await client.query<{ id: number | string }>(
      `
        SELECT id
        FROM advertisement_placement_rules
        WHERE
          advertisement_id = $1
          AND placement_id = $2
          AND status = 'ACTIVE'
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE
      `,
      [advertisementId, schedule.placement_id]
    );

    hasValidRule = ruleResult.rows.length > 0;
  }

  if (!hasValidRule) {
    throw new ApiError(
      409,
      `Schedule ${schedule.id} does not have a valid active placement rule.`
    );
  }

  await validateActivationCreatives(advertisementId, placement, client);

  /*
   * The rotation configuration must exist and be readable even when
   * rotation is disabled. Disabled rotation does not require active members.
   */
  const rotationConfig = await rotationRepository.findRotationConfig(
    Number(schedule.placement_id),
    client
  );

  if (!rotationConfig) {
    throw new ApiError(
      409,
      `Rotation configuration for placement ${schedule.placement_id} was not found. Save and verify the placement's rotation settings before activation.`
    );
  }

  if (!rotationConfig.rotationEnabled) {
    return;
  }

  if (
    rotationConfig.rotationMode !== "TIME_BASED" ||
    rotationConfig.rotationStrategy !== "ROUND_ROBIN" ||
    !Number.isInteger(rotationConfig.rotationIntervalSeconds) ||
    rotationConfig.rotationIntervalSeconds < 1 ||
    rotationConfig.rotationIntervalSeconds > 3600
  ) {
    throw new ApiError(
      409,
      `Rotation configuration for placement ${schedule.placement_id} is invalid.`
    );
  }

  const limits = await rotationRepository.findRotationLimits(client);

  const activeMembers = await rotationRepository.findActiveMembersByPlacement(
    Number(schedule.placement_id),
    client
  );

  if (
    activeMembers.length === 0 ||
    activeMembers.length > limits.maxActiveRotationMembersPerPlacement
  ) {
    throw new ApiError(
      409,
      `Placement ${schedule.placement_id} does not have a valid number of active rotation members.`
    );
  }

  const advertisementIsMember = activeMembers.some(
    (member) => Number(member.advertisementId) === advertisementId
  );

  if (!advertisementIsMember) {
    throw new ApiError(
      409,
      `Advertisement ${advertisementId} must be an active member of the placement rotation before activation.`
    );
  }
};

export const activateAdvertisement = async (
  id: number,
  activatedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<{
  advertisement: Advertisement;
  activatedSchedules: number[];
  remarks: string;
}> => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Advertisement ID must be a positive integer.");
  }

  if (!Number.isInteger(activatedBy) || activatedBy <= 0) {
    throw new ApiError(400, "Activated by must be a positive integer.");
  }

  const remarks = normalizeRemarks(input.remarks);

  if (!remarks) {
    throw new ApiError(
      400,
      "Remarks are required for advertisement activation."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Serialize activation attempts for this advertisement.
     * Approval remains a separate workflow requirement.
     */
    const advertisement = await repository.findByIdForUpdate(id, client);

    if (!advertisement) {
      throw new ApiError(404, "Advertisement not found.");
    }

    if (advertisement.workflowStatus !== "APPROVED") {
      throw new ApiError(409, "Only approved advertisements can be activated.");
    }

    if (advertisement.status === "ARCHIVED") {
      throw new ApiError(409, "Archived advertisements cannot be activated.");
    }

    // Recheck financial eligibility at the final manual activation boundary.
    // A pending/held discount or amount-adjustment request must not be bypassed
    // by activating an already-approved advertisement. An optional advance
    // payment is not a blocker by itself; outstanding-balance rules are handled
    // separately by validateCreditExceptionCoverage.
    for (const approvalType of ["DISCOUNT", "ADJUSTMENT"] as const) {
      const latestApproval = await getLatestFinancialApproval(id, approvalType);
      if (
        latestApproval?.status === "SUBMITTED" ||
        latestApproval?.status === "HOLD"
      ) {
        throw new ApiError(
          409,
          `Advertisement cannot be activated while its ${approvalType.toLowerCase()} financial approval is pending or on hold.`
        );
      }
    }

    // Recheck the financial position at activation time. An approved credit
    // exception may have expired or been revoked since workflow approval.
    await validateCreditExceptionCoverage(advertisement);

    // Activation may happen before or after the campaign window, but a valid
    // campaign window must exist and every schedule must remain inside it.
    validateCampaignWindow(advertisement.startAt, advertisement.endAt, {
      required: true
    });

    // Keep narrowed local values: TypeScript cannot infer the validation
    // helper's runtime guarantee from its return type.
    const campaignStart = advertisement.startAt;
    const campaignEnd = advertisement.endAt;

    if (!campaignStart || !campaignEnd) {
      throw new ApiError(400, "Campaign start and end date/time are required.");
    }

    const campaignStartTime =
      campaignStart instanceof Date
        ? campaignStart.getTime()
        : new Date(campaignStart).getTime();
    const campaignEndTime =
      campaignEnd instanceof Date
        ? campaignEnd.getTime()
        : new Date(campaignEnd).getTime();

    /*
     * Administrative activation is independent of the current campaign
     * period. Campaign and schedule dates continue to govern public delivery.
     *
     * Select every SCHEDULED or PAUSED record, including future and expired schedules.
     * Do not mark only currently eligible schedules as operationally active.
     */
    const schedulesResult = await client.query<ActivationScheduleRow>(
      `
        SELECT
          id,
          advertisement_id,
          placement_id,
          placement_rule_id,
          start_at,
          end_at
        FROM advertisement_schedules
        WHERE
          advertisement_id = $1
          AND status IN ('SCHEDULED', 'PAUSED')
        ORDER BY id ASC
        FOR UPDATE
      `,
      [id]
    );

    const eligibleSchedules = schedulesResult.rows;

    if (eligibleSchedules.length === 0) {
      throw new ApiError(
        409,
        "No scheduled or paused record is available for activation. Create or correct a schedule before activating this advertisement."
      );
    }

    // Acquire the same per-placement transaction lock used by schedule create
    // and update. Sort ids to avoid lock-order deadlocks for multi-placement ads.
    const placementIds = [
      ...new Set(
        eligibleSchedules.map((schedule) => Number(schedule.placement_id))
      )
    ].sort((a, b) => a - b);
    for (const placementId of placementIds) {
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
        73421,
        placementId
      ]);
    }

    /*
     * Validate every selected schedule before updating anything.
     * Schedule dates must be valid, and the end must be after the start.
     * They do not need to contain the current database time.
     */
    for (const schedule of eligibleSchedules) {
      const startTime = new Date(schedule.start_at).getTime();
      const endTime = new Date(schedule.end_at).getTime();

      if (
        !Number.isFinite(startTime) ||
        !Number.isFinite(endTime) ||
        endTime <= startTime
      ) {
        throw new ApiError(
          409,
          `Schedule ${schedule.id} has an invalid date range. Configure valid start and end dates, with the end after the start, before activation.`
        );
      }

      if (startTime < campaignStartTime || endTime > campaignEndTime) {
        throw new ApiError(
          409,
          `Schedule ${schedule.id} falls outside the advertisement campaign window. Update the schedule or campaign dates before activation.`
        );
      }

      await validateActivationPlacement(id, schedule, client);

      /*
       * Prevent activation when another schedule for the same advertisement
       * and placement overlaps this schedule.
       *
       * Keep the original conflict policy for SCHEDULED, ACTIVE and PAUSED
       * records. Dates are compared with each other, not with the current time.
       */
      const overlapResult = await client.query<{
        id: number | string;
      }>(
        `
          SELECT id
          FROM advertisement_schedules
          WHERE
            advertisement_id = $1
            AND placement_id = $2
            AND id <> $3
            AND status IN ('SCHEDULED', 'ACTIVE', 'PAUSED')
            AND start_at < $5
            AND end_at > $4
          ORDER BY id ASC
          LIMIT 1
          FOR UPDATE
        `,
        [
          id,
          schedule.placement_id,
          schedule.id,
          schedule.start_at,
          schedule.end_at
        ]
      );

      if (overlapResult.rows.length > 0) {
        throw new ApiError(
          409,
          `Schedule ${schedule.id} overlaps another scheduled, active, or paused schedule for the same placement. Resolve the schedule conflict before activation.`
        );
      }

      // Rotation-disabled placements are exclusive across advertisements.
      // The advisory lock serializes this final check with schedule create/update
      // and other activations for the same placement.
      const crossAdvertisementOverlap = await client.query<{
        id: number | string;
        advertisement_id: number | string;
      }>(
        `
          SELECT s.id, s.advertisement_id
          FROM advertisement_schedules s
          INNER JOIN advertisement_placements p ON p.id = s.placement_id
          WHERE s.placement_id = $1
            AND s.advertisement_id <> $2
            AND COALESCE(p.rotation_enabled, FALSE) = FALSE
            AND s.status IN ('SCHEDULED', 'ACTIVE', 'PAUSED')
            AND s.start_at < $4
            AND s.end_at > $3
          ORDER BY s.start_at ASC, s.id ASC
          LIMIT 1
          FOR UPDATE OF s
        `,
        [schedule.placement_id, id, schedule.start_at, schedule.end_at]
      );

      if (crossAdvertisementOverlap.rows.length > 0) {
        const conflict = crossAdvertisementOverlap.rows[0];
        throw new ApiError(
          409,
          `Schedule ${schedule.id} overlaps schedule ${conflict?.id ?? "unknown"} for another advertisement on an exclusive placement. Resolve the placement conflict before activation.`
        );
      }
    }

    /*
     * All schedules have passed validation. Mark scheduled and paused records operationally ACTIVE,
     * regardless of whether their start date is in the future or their end
     * date is in the past.
     *
     * Public delivery must independently enforce schedule and campaign date
     * windows so this administrative state change never bypasses delivery
     * timing restrictions.
     */
    const activatedSchedules: number[] = [];

    for (const schedule of eligibleSchedules) {
      const updateResult = await client.query<{ id: number | string }>(
        `
          UPDATE advertisement_schedules
          SET
            status = 'ACTIVE',
            updated_by = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = $1
            AND advertisement_id = $3
            AND status IN ('SCHEDULED', 'PAUSED')
          RETURNING id
        `,
        [schedule.id, activatedBy, id]
      );

      const updatedSchedule = updateResult.rows[0];

      if (!updatedSchedule) {
        throw new ApiError(
          409,
          `Schedule ${schedule.id} changed before activation could complete.`
        );
      }

      activatedSchedules.push(Number(updatedSchedule.id));
    }

    /*
     * Change operational status only.
     * workflow_status remains APPROVED.
     */
    const advertisementResult = await client.query<{
      id: number | string;
    }>(
      `
        UPDATE advertisements
        SET
          status = 'ACTIVE',
          updated_by = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE
          id = $1
          AND workflow_status = 'APPROVED'
          AND status <> 'ARCHIVED'
        RETURNING id
      `,
      [id, activatedBy]
    );

    if (!advertisementResult.rows[0]) {
      throw new ApiError(
        409,
        "The advertisement could not be activated because its current status changed."
      );
    }

    /*
     * Record activation in the operational audit table.
     * This is not a workflow transition.
     *
     * If auditing or reloading fails, the transaction rolls back the schedule
     * and advertisement updates as well.
     */
    await client.query(
      `
        INSERT INTO public.advertisement_operational_audit
        (
          advertisement_id,
          event_type,
          previous_status,
          new_status,
          remarks,
          performed_by
        )
        VALUES ($1, 'ACTIVATED', $2, 'ACTIVE', $3, $4)
      `,
      [id, advertisement.status, remarks, activatedBy]
    );

    const updatedAdvertisement = await repository.findById(id, client);

    if (!updatedAdvertisement) {
      throw new ApiError(
        500,
        "The advertisement was activated but could not be reloaded."
      );
    }

    await client.query("COMMIT");

    return {
      advertisement: updatedAdvertisement,
      activatedSchedules,
      remarks
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const archiveAdvertisement = async (
  id: number,
  archivedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<AdvertisementWorkflowResult> =>
  changeWorkflowStatus(id, "ARCHIVED", archivedBy, {
    remarks: normalizeRemarks(input.remarks)
  });

export const getAdvertisementWorkflowHistory = async (
  id: number
): Promise<AdvertisementWorkflowHistory[]> => {
  const advertisement = await repository.findById(id);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  return repository.findWorkflowHistory(id);
};
