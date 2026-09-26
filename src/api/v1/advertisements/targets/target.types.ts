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
}

export interface AdvertisementTargetContext {
  site?: string;
  newsId?: number;
  category?: string;
  state?: string;
  district?: string;
  country?: string;
}
