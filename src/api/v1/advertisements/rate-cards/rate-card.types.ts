export type AdvertisementRateCardPricingUnit =
  "DAY" | "WEEK" | "MONTH" | "IMPRESSION" | "CAMPAIGN" | "FIXED";

export type AdvertisementRateCardStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface AdvertisementRateCard {
  id: number;

  placementId: number;

  pricingUnit: AdvertisementRateCardPricingUnit;

  rateAmount: number;

  currencyCode: string;

  effectiveFrom: Date;

  effectiveTo: Date | null;

  status: AdvertisementRateCardStatus;

  createdBy: number;

  updatedBy: number | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface CreateAdvertisementRateCardInput {
  placementId: number;
  pricingUnit: AdvertisementRateCardPricingUnit;
  rateAmount: number;
  currencyCode?: string | undefined;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null | undefined;
  status?: AdvertisementRateCardStatus | undefined;
}

export interface UpdateAdvertisementRateCardInput {
  placementId?: number | undefined;
  pricingUnit?: AdvertisementRateCardPricingUnit | undefined;
  rateAmount?: number | undefined;
  currencyCode?: string | undefined;
  effectiveFrom?: string | Date | undefined;
  effectiveTo?: string | Date | null | undefined;
  status?: AdvertisementRateCardStatus | undefined;
}

export interface AdvertisementRateCardSearchFilters {
  placementId?: number | undefined;
  pricingUnit?: AdvertisementRateCardPricingUnit | undefined;
  status?: AdvertisementRateCardStatus | undefined;
}
