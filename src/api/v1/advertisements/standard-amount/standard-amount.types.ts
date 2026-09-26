import type { AdvertisementPricingSnapshotPricingUnit } from "../pricing-snapshots/pricing-snapshot.types.js";

export interface CalculateAdvertisementStandardAmountInput {
  pricingUnit: AdvertisementPricingSnapshotPricingUnit;
  rateAmount: number;
  quantity: number;
  currencyCode: string;
}

export interface AdvertisementStandardAmountResult {
  pricingUnit: AdvertisementPricingSnapshotPricingUnit;
  rateAmount: number;
  quantity: number;
  standardAmount: number;
  currencyCode: string;
}
