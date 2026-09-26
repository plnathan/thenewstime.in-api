import type { PoolClient } from "pg";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as advertisementRepository from "../../advertisements/advertisement/advertisement.repository.js";
import * as rateCardRepository from "../rate-cards/rate-card.repository.js";

import * as repository from "./pricing-snapshot.repository.js";

import type {
  AdvertisementPricingSnapshot,
  AdvertisementPricingSnapshotPricingUnit,
  CreateAdvertisementPricingSnapshotInput
} from "./pricing-snapshot.types.js";

const validateId = (value: number, fieldName: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`);
  }
};

const validateRateAmount = (rateAmount: number): void => {
  if (!Number.isFinite(rateAmount) || rateAmount < 0) {
    throw new ApiError(
      400,
      "rateAmount must be a finite number greater than or equal to zero."
    );
  }
};

const validateQuantity = (quantity: number): void => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(
      400,
      "Pricing quantity must be a finite number greater than zero."
    );
  }
};

const validateCurrencyCode = (currencyCode: string): string => {
  const normalized = currencyCode.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new ApiError(
      400,
      "currencyCode must be a valid three-letter currency code."
    );
  }

  return normalized;
};

const validateDate = (value: string | Date, fieldName: string): Date => {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${fieldName} must be a valid date.`);
  }

  return date;
};

const validateEffectivePeriod = (
  effectiveFrom: string | Date,
  effectiveTo: string | Date | null | undefined
): void => {
  const from = validateDate(effectiveFrom, "rateEffectiveFrom");

  if (effectiveTo === undefined || effectiveTo === null) {
    return;
  }

  const to = validateDate(effectiveTo, "rateEffectiveTo");

  if (to <= from) {
    throw new ApiError(
      400,
      "rateEffectiveTo must be later than rateEffectiveFrom."
    );
  }
};

const validatePricingUnit = (
  pricingUnit: AdvertisementPricingSnapshotPricingUnit
): void => {
  const supportedUnits: AdvertisementPricingSnapshotPricingUnit[] = [
    "DAY",
    "WEEK",
    "MONTH",
    "IMPRESSION",
    "CAMPAIGN",
    "FIXED"
  ];

  if (!supportedUnits.includes(pricingUnit)) {
    throw new ApiError(400, `Unsupported pricingUnit '${pricingUnit}'.`);
  }
};

const calculateStandardAmount = (
  rateAmount: number,
  quantity: number
): number => {
  const standardAmount = Number((rateAmount * quantity).toFixed(2));

  if (!Number.isFinite(standardAmount) || standardAmount < 0) {
    throw new ApiError(
      400,
      "The calculated standard advertisement amount is invalid."
    );
  }

  return standardAmount;
};

export const getById = async (
  id: number
): Promise<AdvertisementPricingSnapshot> => {
  validateId(id, "id");

  const snapshot = await repository.findById(id);

  if (snapshot === null) {
    throw new ApiError(404, "Pricing snapshot not found.");
  }

  return snapshot;
};

export const getByAdvertisementId = async (
  advertisementId: number
): Promise<AdvertisementPricingSnapshot[]> => {
  validateId(advertisementId, "advertisementId");

  return repository.findByAdvertisementId(advertisementId);
};

export const getLatestByAdvertisementId = async (
  advertisementId: number
): Promise<AdvertisementPricingSnapshot | null> => {
  validateId(advertisementId, "advertisementId");

  return repository.findLatestByAdvertisementId(advertisementId);
};

export const getLatestByAdvertisementAndPlacement = async (
  advertisementId: number,
  placementId: number
): Promise<AdvertisementPricingSnapshot | null> => {
  validateId(advertisementId, "advertisementId");
  validateId(placementId, "placementId");

  return repository.findLatestByAdvertisementAndPlacement(
    advertisementId,
    placementId
  );
};

export const createFromRateCard = async (
  advertisementId: number,
  placementId: number,
  rateCardId: number,
  createdBy: number,
  client?: PoolClient
): Promise<AdvertisementPricingSnapshot> => {
  validateId(advertisementId, "advertisementId");
  validateId(placementId, "placementId");
  validateId(rateCardId, "rateCardId");
  validateId(createdBy, "createdBy");

  const advertisement = await advertisementRepository.findById(
    advertisementId,
    client
  );

  if (advertisement === null) {
    throw new ApiError(404, "Advertisement not found.");
  }

  if (
    advertisement.pricingPlacementId !== null &&
    advertisement.pricingPlacementId !== placementId
  ) {
    throw new ApiError(
      400,
      "The specified placement does not match the advertisement pricing placement."
    );
  }

  const quantity = advertisement.pricingQuantity;

  if (quantity === null) {
    throw new ApiError(
      400,
      "Advertisement pricing quantity is required before creating a pricing snapshot."
    );
  }

  validateQuantity(quantity);

  const rateCard = await rateCardRepository.findById(rateCardId, client);

  if (rateCard === null) {
    throw new ApiError(404, "Rate card not found.");
  }

  if (rateCard.placementId !== placementId) {
    throw new ApiError(
      400,
      "The rate card does not belong to the specified placement."
    );
  }

  if (rateCard.status !== "ACTIVE") {
    throw new ApiError(
      400,
      "Only an active rate card can be used to create a pricing snapshot."
    );
  }

  validatePricingUnit(rateCard.pricingUnit);
  validateRateAmount(rateCard.rateAmount);

  const currencyCode = validateCurrencyCode(rateCard.currencyCode);

  validateEffectivePeriod(rateCard.effectiveFrom, rateCard.effectiveTo);

  const standardAmount = calculateStandardAmount(rateCard.rateAmount, quantity);

  const input: CreateAdvertisementPricingSnapshotInput = {
    advertisementId,
    placementId,
    rateCardId: rateCard.id,
    pricingUnit: rateCard.pricingUnit,
    rateAmount: rateCard.rateAmount,
    currencyCode,
    rateEffectiveFrom: rateCard.effectiveFrom,
    rateEffectiveTo: rateCard.effectiveTo,
    quantity,
    standardAmount
  };

  try {
    return await repository.create(input, createdBy, client);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (
        error as {
          code?: unknown;
        }
      ).code;

      if (code === "23503") {
        throw new ApiError(
          400,
          "The advertisement, placement, rate card, or user does not exist."
        );
      }

      if (code === "23514") {
        throw new ApiError(
          400,
          "The pricing snapshot violates a database business rule."
        );
      }
    }

    throw error;
  }
};
