import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import type {
  CalculateAdvertisementStandardAmountInput,
  AdvertisementStandardAmountResult
} from "./standard-amount.types.js";

const SUPPORTED_PRICING_UNITS = new Set([
  "DAY",
  "WEEK",
  "MONTH",
  "IMPRESSION",
  "CAMPAIGN",
  "FIXED"
]);

const roundCurrency = (amount: number): number => {
  return Number(amount.toFixed(2));
};

const validatePricingUnit = (
  pricingUnit: CalculateAdvertisementStandardAmountInput["pricingUnit"]
): void => {
  if (!SUPPORTED_PRICING_UNITS.has(pricingUnit)) {
    throw new ApiError(
      400,
      `Unsupported advertisement pricing unit '${pricingUnit}'.`
    );
  }
};

const validateRateAmount = (rateAmount: number): void => {
  if (!Number.isFinite(rateAmount)) {
    throw new ApiError(
      400,
      "Advertisement rate amount must be a finite number."
    );
  }

  if (rateAmount < 0) {
    throw new ApiError(400, "Advertisement rate amount cannot be negative.");
  }
};

const validateQuantity = (quantity: number): void => {
  if (!Number.isFinite(quantity)) {
    throw new ApiError(
      400,
      "Advertisement pricing quantity must be a finite number."
    );
  }

  if (quantity <= 0) {
    throw new ApiError(
      400,
      "Advertisement pricing quantity must be greater than zero."
    );
  }
};

const normalizeCurrencyCode = (currencyCode: string): string => {
  const normalized = currencyCode.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new ApiError(
      400,
      "Advertisement pricing currency code must contain exactly three letters."
    );
  }

  return normalized;
};

export const calculateStandardAmount = (
  input: CalculateAdvertisementStandardAmountInput
): AdvertisementStandardAmountResult => {
  validatePricingUnit(input.pricingUnit);
  validateRateAmount(input.rateAmount);
  validateQuantity(input.quantity);

  const currencyCode = normalizeCurrencyCode(input.currencyCode);

  const standardAmount = roundCurrency(input.rateAmount * input.quantity);

  return {
    pricingUnit: input.pricingUnit,
    rateAmount: roundCurrency(input.rateAmount),
    quantity: input.quantity,
    standardAmount,
    currencyCode
  };
};
