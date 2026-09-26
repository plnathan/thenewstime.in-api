export interface CalculateAdvertisementAgreedAmountInput {
  standardAmount: number;
  agreedAmount: number;
  currencyCode: string;
}

export interface AdvertisementAgreedAmountResult {
  standardAmount: number;
  agreedAmount: number;
  varianceAmount: number;
  variancePercentage: number | null;
  currencyCode: string;
}
