import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./rate-card.repository.js";

import type {
  AdvertisementRateCard,
  AdvertisementRateCardPricingUnit,
  AdvertisementRateCardSearchFilters,
  AdvertisementRateCardStatus,
  CreateAdvertisementRateCardInput,
  UpdateAdvertisementRateCardInput
} from "./rate-card.types.js";

const validateId = (id: number, fieldName: string): void => {
  if (!Number.isInteger(id) || id <= 0) {
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

const normalizeCurrencyCode = (currencyCode: string | undefined): string => {
  const normalized = currencyCode?.trim().toUpperCase() ?? "INR";

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new ApiError(
      400,
      "currencyCode must be a valid three-letter currency code."
    );
  }

  return normalized;
};

const toValidDate = (value: string | Date, fieldName: string): Date => {
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
  const from = toValidDate(effectiveFrom, "effectiveFrom");

  if (effectiveTo === undefined || effectiveTo === null) {
    return;
  }

  const to = toValidDate(effectiveTo, "effectiveTo");

  if (to <= from) {
    throw new ApiError(400, "effectiveTo must be later than effectiveFrom.");
  }
};

const validatePricingUnit = (
  pricingUnit: AdvertisementRateCardPricingUnit
): void => {
  const supportedUnits: AdvertisementRateCardPricingUnit[] = [
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

const validateStatus = (status: AdvertisementRateCardStatus): void => {
  const supportedStatuses: AdvertisementRateCardStatus[] = [
    "ACTIVE",
    "INACTIVE",
    "ARCHIVED"
  ];

  if (!supportedStatuses.includes(status)) {
    throw new ApiError(400, `Unsupported rate card status '${status}'.`);
  }
};

const mapRepositoryError = (error: unknown): never => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;

    if (code === "23P01") {
      throw new ApiError(
        409,
        "An active rate card already exists for the same placement and pricing unit during the specified effective period."
      );
    }

    if (code === "23503") {
      throw new ApiError(
        400,
        "The referenced placement or user does not exist."
      );
    }

    if (code === "23514") {
      throw new ApiError(
        400,
        "The rate card violates a database business rule."
      );
    }

    if (code === "23505") {
      throw new ApiError(409, "A conflicting rate card already exists.");
    }
  }

  throw error;
};

export const getAll = async (
  filters: AdvertisementRateCardSearchFilters = {}
): Promise<AdvertisementRateCard[]> => {
  if (filters.placementId !== undefined) {
    validateId(filters.placementId, "placementId");
  }

  if (filters.pricingUnit !== undefined) {
    validatePricingUnit(filters.pricingUnit);
  }

  if (filters.status !== undefined) {
    validateStatus(filters.status);
  }

  return repository.findAll(filters);
};

export const getById = async (id: number): Promise<AdvertisementRateCard> => {
  validateId(id, "id");

  const rateCard = await repository.findById(id);

  if (!rateCard) {
    throw new ApiError(404, "Advertisement rate card not found.");
  }

  return rateCard;
};

export const getByPlacementId = async (
  placementId: number
): Promise<AdvertisementRateCard[]> => {
  validateId(placementId, "placementId");

  return repository.findByPlacementId(placementId);
};

export const getEffectiveRate = async (
  placementId: number,
  pricingUnit: AdvertisementRateCardPricingUnit,
  effectiveAt: Date | string
): Promise<AdvertisementRateCard | null> => {
  validateId(placementId, "placementId");
  validatePricingUnit(pricingUnit);

  toValidDate(effectiveAt, "effectiveAt");

  return repository.findEffectiveRate(placementId, pricingUnit, effectiveAt);
};

export const create = async (
  input: CreateAdvertisementRateCardInput,
  createdBy: number
): Promise<AdvertisementRateCard> => {
  validateId(input.placementId, "placementId");
  validateId(createdBy, "createdBy");

  validatePricingUnit(input.pricingUnit);
  validateRateAmount(input.rateAmount);
  normalizeCurrencyCode(input.currencyCode);
  validateEffectivePeriod(input.effectiveFrom, input.effectiveTo);

  if (input.status !== undefined) {
    validateStatus(input.status);
  }

  const normalizedInput: CreateAdvertisementRateCardInput = {
    ...input,
    currencyCode: normalizeCurrencyCode(input.currencyCode)
  };

  try {
    return await repository.create(normalizedInput, createdBy);
  } catch (error) {
    return mapRepositoryError(error);
  }
};

export const update = async (
  id: number,
  input: UpdateAdvertisementRateCardInput,
  updatedBy: number
): Promise<AdvertisementRateCard> => {
  validateId(id, "id");
  validateId(updatedBy, "updatedBy");

  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Advertisement rate card not found.");
  }

  if (input.placementId !== undefined) {
    validateId(input.placementId, "placementId");
  }

  if (input.pricingUnit !== undefined) {
    validatePricingUnit(input.pricingUnit);
  }

  if (input.rateAmount !== undefined) {
    validateRateAmount(input.rateAmount);
  }

  if (input.currencyCode !== undefined) {
    normalizeCurrencyCode(input.currencyCode);
  }

  if (input.status !== undefined) {
    validateStatus(input.status);
  }

  const effectiveFrom =
    input.effectiveFrom !== undefined
      ? input.effectiveFrom
      : existing.effectiveFrom;

  const effectiveTo =
    input.effectiveTo !== undefined ? input.effectiveTo : existing.effectiveTo;

  validateEffectivePeriod(effectiveFrom, effectiveTo);

  const normalizedInput: UpdateAdvertisementRateCardInput = {
    ...input,
    ...(input.currencyCode !== undefined
      ? {
          currencyCode: normalizeCurrencyCode(input.currencyCode)
        }
      : {})
  };

  try {
    const updated = await repository.update(id, normalizedInput, updatedBy);

    if (!updated) {
      throw new ApiError(404, "Advertisement rate card not found.");
    }

    return updated;
  } catch (error) {
    return mapRepositoryError(error);
  }
};

export const deactivate = async (
  id: number,
  updatedBy: number
): Promise<AdvertisementRateCard> => {
  validateId(id, "id");
  validateId(updatedBy, "updatedBy");

  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Advertisement rate card not found.");
  }

  if (existing.status === "INACTIVE") {
    throw new ApiError(409, "Advertisement rate card is already inactive.");
  }

  if (existing.status === "ARCHIVED") {
    throw new ApiError(
      409,
      "Archived advertisement rate cards cannot be deactivated."
    );
  }

  try {
    const updated = await repository.update(
      id,
      {
        status: "INACTIVE"
      },
      updatedBy
    );

    if (!updated) {
      throw new ApiError(404, "Advertisement rate card not found.");
    }

    return updated;
  } catch (error) {
    return mapRepositoryError(error);
  }
};

export const archive = async (
  id: number,
  updatedBy: number
): Promise<AdvertisementRateCard> => {
  validateId(id, "id");
  validateId(updatedBy, "updatedBy");

  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Advertisement rate card not found.");
  }

  if (existing.status === "ARCHIVED") {
    throw new ApiError(409, "Advertisement rate card is already archived.");
  }

  try {
    const updated = await repository.update(
      id,
      {
        status: "ARCHIVED"
      },
      updatedBy
    );

    if (!updated) {
      throw new ApiError(404, "Advertisement rate card not found.");
    }

    return updated;
  } catch (error) {
    return mapRepositoryError(error);
  }
};
