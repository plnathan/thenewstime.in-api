import { pool } from "../../../../shared/config/db.js";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as rateCardRepository from "../rate-cards/rate-card.repository.js";

import * as pricingSnapshotService from "../pricing-snapshots/pricing-snapshot.service.js";

import { calculateStandardAmount } from "../standard-amount/standard-amount.service.js";

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

  advancePercentage: number | undefined
): AdvertisementFinancialCalculation => {
  const amount =
    advertisementAmount === undefined || advertisementAmount === null
      ? null
      : advertisementAmount;

  const discountRate = discountPercentage ?? 0;

  const advanceRate = advancePercentage ?? 0;

  if (discountRate < 0 || discountRate > 100) {
    throw new ApiError(400, "Discount percentage must be between 0 and 100.");
  }

  if (advanceRate < 0 || advanceRate > 100) {
    throw new ApiError(400, "Advance percentage must be between 0 and 100.");
  }

  if (amount === null) {
    if (discountRate > 0) {
      throw new ApiError(
        400,
        "Advertisement amount is required when discount percentage is greater than zero."
      );
    }

    if (advanceRate > 0) {
      throw new ApiError(
        400,
        "Advertisement amount is required when advance percentage is greater than zero."
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

  const discountAmount = roundToTwo((amount * discountRate) / 100);

  const advanceAmount = roundToTwo((amount * advanceRate) / 100);

  const netAdvertisementAmount = roundToTwo(amount - discountAmount);

  if (discountAmount > amount) {
    throw new ApiError(
      400,
      "Calculated discount amount cannot be greater than the advertisement amount."
    );
  }

  if (advanceAmount > netAdvertisementAmount) {
    throw new ApiError(
      400,
      "Calculated advance amount cannot be greater than the net advertisement amount after discount."
    );
  }

  return {
    advertisementAmount: amount,

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
  const {
    placementId: inputPlacementId,
    ...inputWithoutPlacement
  } = input;

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

  const financials = calculateAdvertisementFinancials(
    input.advertisementAmount,
    input.discountPercentage,
    input.advancePercentage
  );

  /*
   * No pricing object means that the advertisement uses the explicitly
   * selected runtime placement without creating a rate-card snapshot.
   */
  if (!input.pricing) {
    return repository.create(
      {
        ...inputWithoutPlacement,

        /*
         * runtimePlacementId has already passed validatePlacementSelection(),
         * therefore this property is always a valid number at this point.
         */
        placementId: runtimePlacementId as number,

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

    const effectiveAt = new Date();

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

    const advertisement = await repository.create(
      {
        ...inputWithoutPlacement,

        /*
         * runtimePlacementId has already passed validatePlacementSelection(),
         * therefore this property is always a valid number at this point.
         */
        placementId: runtimePlacementId as number,

        discountPercentage: financials.discountPercentage,

        advancePercentage: financials.advancePercentage,

        ...toCalculatedFinancialFields(financials),

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

  const mergedAdvertisementAmount =
    input.advertisementAmount ?? advertisement.advertisementAmount;

  const mergedDiscountPercentage =
    input.discountPercentage ?? advertisement.discountPercentage;

  const mergedAdvancePercentage =
    input.advancePercentage ?? advertisement.advancePercentage;

  const financials = calculateAdvertisementFinancials(
    mergedAdvertisementAmount,
    mergedDiscountPercentage,
    mergedAdvancePercentage
  );

  /*
   * Remove placementId from the spread so that `null` or `undefined`
   * is never passed to repository.update() for an optional property.
   *
   * This is required because the project uses:
   *
   * exactOptionalPropertyTypes: true
   */
  const { placementId, ...updateInput } = input;

  const updated = await repository.update(
    id,
    {
      ...updateInput,

      ...(placementId !== undefined && placementId !== null
        ? { placementId }
        : {}),

      discountPercentage: financials.discountPercentage,

      advancePercentage: financials.advancePercentage,

      ...toCalculatedFinancialFields(financials)
    },
    updatedBy
  );

  if (!updated) {
    throw new ApiError(404, "Advertisement not found.");
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