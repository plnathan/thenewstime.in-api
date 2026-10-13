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
   * The repository orders records by requested_at DESC, id DESC.
   * The first matching record is therefore the latest request for this
   * advertisement and approval type.
   */
  return result.items[0] ?? null;
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
 * Ensures a pending, rejected, or approved discount request cannot be
 * bypassed by directly editing commercial values in the advertisement
 * workspace.
 *
 * DISCOUNT approval limits apply to the discount percentage and the
 * calculated discount amount, not to Standard Amount.
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
   * An advertisement without a DISCOUNT approval record retains its
   * existing behaviour. Approval thresholds and request creation remain
   * the responsibility of the financial-approval workflow.
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
        approval.approvedPercentage + Number.EPSILON
    ) {
      throw new ApiError(
        409,
        `The discount percentage exceeds the approved limit of ${approval.approvedPercentage}%.`
      );
    }

    if (
      approval.approvedAmount !== null &&
      financials.discountAmount > approval.approvedAmount + 0.009
    ) {
      throw new ApiError(
        409,
        `The calculated discount amount exceeds the approved limit of ${roundToTwo(approval.approvedAmount).toFixed(2)}.`
      );
    }

    return;
  }

  /*
   * A rejected request must not authorize the rejected discount.
   * A lower discount can still be saved where it does not exceed either
   * rejected requested limit.
   */
  if (approval.status === "REJECTED") {
    if (
      approval.requestedPercentage !== null &&
      financials.discountPercentage >
        approval.requestedPercentage + Number.EPSILON
    ) {
      throw new ApiError(
        409,
        "The requested discount percentage was rejected. A higher discount cannot be saved without a new financial approval."
      );
    }

    if (
      approval.requestedAmount !== null &&
      financials.discountAmount > approval.requestedAmount + 0.009
    ) {
      throw new ApiError(
        409,
        "The requested discount amount was rejected. A higher discount amount cannot be saved without a new financial approval."
      );
    }

    if (
      approval.requestedPercentage === null &&
      approval.requestedAmount === null &&
      (financials.discountPercentage > 0 || financials.discountAmount > 0)
    ) {
      throw new ApiError(
        409,
        "The discount request was rejected and has no requested limit. Submit a new financial approval before applying a discount."
      );
    }
  }
};

/**
 * Ensures changes to Advertisement Amount cannot bypass a pending,
 * rejected, or approved ADJUSTMENT request.
 *
 * For an adjustment request, the approved amount is treated as the
 * maximum permitted change from the previously saved Advertisement Amount.
 * Standard Amount and pricing snapshots remain system-derived.
 */
/**
 * Ensures changes to Advertisement Amount cannot bypass a pending,
 * rejected, or approved ADJUSTMENT request.
 *
 * An approved adjustment authorizes only a change within its approved
 * limit. A rejected request never authorizes a new adjustment.
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
    if (approval.approvedAmount === null) {
      throw new ApiError(
        409,
        "The approved adjustment request does not contain an approved amount. Please review the financial approval before changing Advertisement Amount."
      );
    }

    const changeAmount = roundToTwo(
      Math.abs(
        (nextAdvertisementAmount ?? 0) -
          (currentAdvertisementAmount ?? 0)
      )
    );

    if (changeAmount > approval.approvedAmount + 0.009) {
      throw new ApiError(
        409,
        `The Advertisement Amount change exceeds the approved adjustment limit of ${roundToTwo(approval.approvedAmount).toFixed(2)}.`
      );
    }
  }
};

/**
 * Validates financial approvals before any commercial update is persisted.
 *
 * REFUND and PARTIAL_REFUND requests concern payment operations rather
 * than changing the advertisement's discount or negotiated amount.
 * CREDIT_EXCEPTION is also separate: it does not authorize discounts,
 * advertisement amount changes, or count as money received.
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

    await client.query("COMMIT");

    return {
      advertisement: updated,
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
   * Remove placementId from the object that will later be spread into
   * repository.create().
   *
   * This is important because CreateAdvertisementInput expects:
   *
   *   placementId?: number
   *
   * while the service-level input intentionally allows:
   *
   *   placementId?: number | null
   *
   * With exactOptionalPropertyTypes enabled, spreading the original
   * input would preserve `placementId?: number | null` and therefore
   * make the repository.create() call invalid even when we conditionally
   * add a valid placementId afterward.
   */
  const { placementId: inputPlacementId, ...inputWithoutPlacement } = input;

  /*
   * Runtime placement is mandatory for every advertisement.
   *
   * A pricing placement may also be supplied when the advertisement
   * is being created through the pricing workflow.
   */
  const runtimePlacementId =
    inputPlacementId ?? input.pricing?.placementId ?? undefined;

  await validatePlacementSelection(runtimePlacementId);

  /*
   * If both runtime placement and pricing placement are supplied,
   * they must point to the same configured placement.
   */
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
   * No pricing object means that the advertisement uses the explicitly
   * selected runtime placement without creating a rate-card snapshot.
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

        /*
         * runtimePlacementId has already passed validatePlacementSelection(),
         * therefore this property is always a valid number at this point.
         */
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

        /*
         * runtimePlacementId has already passed validatePlacementSelection(),
         * therefore this property is always a valid number at this point.
         */
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

  if (mergedStartAt && mergedEndAt) {
    const start =
      mergedStartAt instanceof Date
        ? mergedStartAt.getTime()
        : new Date(mergedStartAt).getTime();

    const end =
      mergedEndAt instanceof Date
        ? mergedEndAt.getTime()
        : new Date(mergedEndAt).getTime();

    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      throw new ApiError(400, "End date/time must be after start date/time.");
    }
  }

  /*
   * Placement is required on Create.
   *
   * On Update, placementId is optional so existing advertisements
   * can be updated without changing their runtime placement.
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
   * Validate financial approvals before persisting any commercial changes.
   *
   * DISCOUNT requests govern discount limits.
   * ADJUSTMENT requests govern changes to Advertisement Amount.
   * Payment refunds and credit exceptions remain separate workflows.
   */
  await validateCommercialFinancialApprovals(advertisement, input, financials);

  /*
   * Remove placementId from the spread so that `null` or `undefined`
   * is never passed to repository.update() for an optional property.
   *
   * This is required because the project uses:
   *
   * exactOptionalPropertyTypes: true
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
     * Keep the new schedule, calculated pricing, and pricing snapshot
     * in one transaction. If any part fails, the entire change rolls back.
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

export const activateAdvertisement = async (
  id: number,
  activatedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<AdvertisementWorkflowResult> => {
  const remarks = normalizeRemarks(input.remarks);

  if (!remarks) {
    throw new ApiError(
      400,
      "Remarks are required for this workflow transition."
    );
  }

  return changeWorkflowStatus(id, "DRAFT", activatedBy, {
    remarks
  });
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
