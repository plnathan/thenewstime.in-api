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

export const createAdvertisement = async (
  input: CreateAdvertisementInput,
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

  const financials = calculateAdvertisementFinancials(
    input.advertisementAmount,
    input.discountPercentage,
    input.advancePercentage
  );

  /*
   * ------------------------------------------------------------
   * Existing non-priced advertisement creation
   * ------------------------------------------------------------
   *
   * If pricing is not supplied, preserve the existing repository
   * creation contract.
   *
   * The pricing database columns are nullable and therefore remain
   * NULL when no system pricing is requested.
   */
  if (!input.pricing) {
    return repository.create(
      {
        ...input,
        discountPercentage: financials.discountPercentage,
        advancePercentage: financials.advancePercentage,
        ...toCalculatedFinancialFields(financials)
      },
      createdBy
    );
  }

  /*
   * ------------------------------------------------------------
   * 8C-9D SYSTEM PRICING FLOW
   * ------------------------------------------------------------
   *
   * Pricing values supplied by the caller:
   *
   *   placementId
   *   pricingUnit
   *   quantity
   *
   * System values:
   *
   *   rateAmount
   *   standardAmount
   *
   * The rate is always obtained from the effective active
   * system rate card.
   */

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
        ...input,
        discountPercentage: financials.discountPercentage,
        advancePercentage: financials.advancePercentage,
        ...toCalculatedFinancialFields(financials),

        /*
         * System-calculated pricing fields.
         */
        standardAmount: standardAmountResult.standardAmount,
        pricingPlacementId: input.pricing.placementId,
        pricingUnit: input.pricing.pricingUnit,
        pricingQuantity: input.pricing.quantity,

        /*
         * The rate-card currency is authoritative for
         * system pricing.
         */
        currencyCode: rateCard.currencyCode
      },
      createdBy,
      client
    );

    /*
     * Create the immutable pricing snapshot using the
     * SAME transaction client.
     */
    await pricingSnapshotService.createFromRateCard(
      advertisement.id,
      input.pricing.placementId,
      rateCard.id,
      createdBy,
      client
    );

    await client.query("COMMIT");

    /*
     * The advertisement returned by repository.create()
     * already contains the calculated pricing fields.
     */
    return advertisement;
  } catch (error) {
    console.error("ADVERTISEMENT PRICING CREATION ERROR:", error);

    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

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

export const updateAdvertisement = async (
  id: number,
  input: UpdateAdvertisementInput,
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
   * ------------------------------------------------------------
   * Agreed amount / financial update
   * ------------------------------------------------------------
   *
   * `agreedAmount` is the API/domain name for the negotiated
   * commercial amount.
   *
   * `advertisementAmount` remains supported for compatibility
   * with existing callers.
   *
   * Precedence:
   *
   *   1. agreedAmount
   *   2. advertisementAmount
   *   3. existing advertisement amount
   *
   * The effective amount is used for recalculating discount and
   * advance amounts.
   *
   * `standardAmount` is intentionally NOT changed here because
   * system pricing is immutable after the pricing snapshot.
   */
  const mergedAdvertisementAmount =
    input.agreedAmount ??
    input.advertisementAmount ??
    advertisement.advertisementAmount;

  const mergedDiscountPercentage =
    input.discountPercentage ?? advertisement.discountPercentage;

  const mergedAdvancePercentage =
    input.advancePercentage ?? advertisement.advancePercentage;

  const financials = calculateAdvertisementFinancials(
    mergedAdvertisementAmount,
    mergedDiscountPercentage,
    mergedAdvancePercentage
  );

  const updated = await repository.update(
    id,
    {
      ...input,
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

export const submitAdvertisement = async (
  id: number,
  submittedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<AdvertisementWorkflowResult> => {
  return changeWorkflowStatus(id, "SUBMITTED", submittedBy, {
    remarks: normalizeRemarks(input.remarks)
  });
};

export const approveAdvertisement = async (
  id: number,
  approvedBy: number,
  input: AdvertisementWorkflowInput = {}
): Promise<AdvertisementWorkflowResult> => {
  return changeWorkflowStatus(id, "APPROVED", approvedBy, {
    remarks: normalizeRemarks(input.remarks)
  });
};

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
): Promise<AdvertisementWorkflowResult> => {
  return changeWorkflowStatus(id, "APPROVED", resumedBy, {
    remarks: normalizeRemarks(input.remarks)
  });
};

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
): Promise<AdvertisementWorkflowResult> => {
  return changeWorkflowStatus(id, "ARCHIVED", archivedBy, {
    remarks: normalizeRemarks(input.remarks)
  });
};

export const getAdvertisementWorkflowHistory = async (
  id: number
): Promise<AdvertisementWorkflowHistory[]> => {
  const advertisement = await repository.findById(id);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  return repository.findWorkflowHistory(id);
};
