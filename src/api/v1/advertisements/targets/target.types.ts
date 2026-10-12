export type AdvertisementTargetType =
  "SITE" | "NEWS" | "CATEGORY" | "STATE" | "DISTRICT" | "COUNTRY";

export interface AdvertisementTarget {
  id: number;
  advertisementId: number;
  targetType: AdvertisementTargetType;
  targetValue: string;
  isInclude: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
  updatedBy: number | null;
  createdByName: string | null;
  updatedByName: string | null;
}

export interface AdvertisementTargetContext {
  site?: string;
  newsId?: number;
  category?: string;
  state?: string;
  district?: string;
  country?: string;
}

/**
 * Targeting fields supplied by an API caller.
 *
 * advertisementId and audit user IDs are derived by the server.
 */
export interface CreateAdvertisementTargetInput {
  targetType: AdvertisementTargetType;
  targetValue: string;
  isInclude?: boolean;
}

/**
 * Complete insert input used by the repository.
 */
export interface CreateAdvertisementTargetRecordInput extends CreateAdvertisementTargetInput {
  advertisementId: number;
  createdBy: number;
  updatedBy: number;
}

export interface UpdateAdvertisementTargetInput {
  targetType?: AdvertisementTargetType;
  targetValue?: string;
  isInclude?: boolean;
}

export interface ReplaceAdvertisementTargetsInput {
  targets: CreateAdvertisementTargetInput[];
}
