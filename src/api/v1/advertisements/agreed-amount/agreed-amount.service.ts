import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import type {
  AdvertisementAgreedAmountResult,
  CalculateAdvertisementAgreedAmountInput
} from "./agreed-amount.types.js";

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeCurrencyCode = (currencyCode: string): string => {
  const normalized = currencyCode.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new ApiError(400, "Currency code must be a valid three-letter code.");
  }

  return normalized;
};

const validateAmount = (value: number, fieldName: string): number => {
  if (!Number.isFinite(value)) {
    throw new ApiError(400, `${fieldName} must be a finite number.`);
  }

  if (value < 0) {
    throw new ApiError(400, `${fieldName} cannot be negative.`);
  }

  return roundToTwo(value);
};

export const calculateAgreedAmount = (
  input: CalculateAdvertisementAgreedAmountInput
): AdvertisementAgreedAmountResult => {
  if (!input || typeof input !== "object") {
    throw new ApiError(400, "Agreed amount calculation input is required.");
  }

  const standardAmount = validateAmount(
    input.standardAmount,
    "Standard amount"
  );

  const agreedAmount = validateAmount(input.agreedAmount, "Agreed amount");

  if (typeof input.currencyCode !== "string") {
    throw new ApiError(400, "Currency code is required.");
  }

  const currencyCode = normalizeCurrencyCode(input.currencyCode);

  const varianceAmount = roundToTwo(agreedAmount - standardAmount);

  const variancePercentage =
    standardAmount === 0
      ? null
      : roundToTwo((varianceAmount / standardAmount) * 100);

  return {
    standardAmount,
    agreedAmount,
    varianceAmount,
    variancePercentage,
    currencyCode
  };
};
