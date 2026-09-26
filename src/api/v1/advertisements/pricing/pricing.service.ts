import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as pricingSnapshotRepository from "../pricing-snapshots/pricing-snapshot.repository.js";

export interface AdvertisementStandardAmount {
  advertisementId: number;
  placementId: number;
  pricingUnit: string;
  rateAmount: number;
  standardAmount: number;
  currencyCode: string;
  pricingSnapshotId: number;
  snapshotAt: Date;
}

const validateId = (value: number, fieldName: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`);
  }
};

export const getStandardAmount = async (
  advertisementId: number
): Promise<AdvertisementStandardAmount> => {
  validateId(advertisementId, "advertisementId");

  const snapshot =
    await pricingSnapshotRepository.findLatestByAdvertisementId(
      advertisementId
    );

  if (snapshot === null) {
    throw new ApiError(
      404,
      "No pricing snapshot exists for the advertisement."
    );
  }

  /*
   * The current pricing model has one snapshot rate as the standard
   * campaign pricing basis. Duration/quantity is not stored in the
   * pricing snapshot table, therefore the standard amount for the
   * current model is the snapshot rate itself.
   *
   * Future duration/quantity pricing must be introduced explicitly
   * rather than multiplying by an inferred value.
   */
  const standardAmount = snapshot.rateAmount;

  return {
    advertisementId: snapshot.advertisementId,
    placementId: snapshot.placementId,
    pricingUnit: snapshot.pricingUnit,
    rateAmount: snapshot.rateAmount,
    standardAmount,
    currencyCode: snapshot.currencyCode,
    pricingSnapshotId: snapshot.id,
    snapshotAt: snapshot.snapshotAt
  };
};
