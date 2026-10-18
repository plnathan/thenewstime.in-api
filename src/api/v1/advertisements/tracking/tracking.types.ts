export type AdvertisementTrackingPageType =
  "HOME" | "NEWS_LIST" | "NEWS_DETAIL";

export type AdvertisementTrackingPlacementType =
  | "HOME_BANNER"
  | "HOME_TOP"
  | "HOME_BETWEEN_SECTIONS"
  | "HOME_SIDEBAR"
  | "NEWS_LIST_TOP"
  | "NEWS_LIST_BETWEEN"
  | "NEWS_LIST_SIDEBAR"
  | "NEWS_LIST_BOTTOM"
  | "NEWS_LIST_MODAL"
  | "NEWS_DETAIL_TOP"
  | "NEWS_DETAIL_BETWEEN"
  | "NEWS_DETAIL_SIDEBAR"
  | "NEWS_DETAIL_BOTTOM"
  | "NEWS_DETAIL_MODAL";

export interface AdvertisementTrackingContext {
  site?: string;
  newsId?: number;
  category?: string;
  state?: string;
  district?: string;
  country?: string;
}

export interface AdvertisementTrackingRequest {
  advertisementId: number;
  placementId: number;
  placementRuleId: number;
  scheduleId: number;
  creativeId: number;

  pageType: AdvertisementTrackingPageType;
  placementType: AdvertisementTrackingPlacementType;

  sessionId?: string;
  visitorId?: string;

  browser?: string;
  operatingSystem?: string;
  deviceType?: string;

  pageUrl?: string;
  referrerUrl?: string;

  context?: AdvertisementTrackingContext;

  ipHash?: string;
  userAgent?: string;
}

export interface AdvertisementTrackingRelationship {
  advertisementId: number;
  placementId: number;
  placementRuleId: number | null;
  scheduleId: number | null;
  creativeId: number | null;

  pageType: AdvertisementTrackingPageType;
  placementType: AdvertisementTrackingPlacementType;

  placementEnabled: boolean;
  placementStatus: string;

  placementRuleStatus: string | null;
  insertionType: string | null;
  maxImpressions: number | null;

  scheduleStatus: string | null;
  scheduleStartAt: Date | null;
  scheduleEndAt: Date | null;

  advertisementStatus: string;
  advertisementWorkflowStatus: string;
  advertisementStartAt: Date | null;
  advertisementEndAt: Date | null;
  rotationEnabled: boolean;
  rotationMemberActive: boolean;

  creativeStatus: string | null;
}

export interface AdvertisementTrackingResult {
  tracked: boolean;
  eventId: number | null;
  eventAt: Date | null;
  reason?: "MAX_IMPRESSIONS_REACHED";
}

export interface AdvertisementMetricsTotals {
  impressions: number;
  clicks: number;
  uniqueImpressionVisitors: number;
  uniqueClickVisitors: number;
  clickThroughRate: number;
}

export interface AdvertisementDailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  clickThroughRate: number;
}

export interface AdvertisementPlacementMetric {
  placementId: number;
  impressions: number;
  clicks: number;
  clickThroughRate: number;
}

export interface AdvertisementCreativeMetric {
  creativeId: number;
  impressions: number;
  clicks: number;
  clickThroughRate: number;
}

export interface AdvertisementMetrics {
  advertisementId: number;
  period: {
    from: Date | null;
    to: Date | null;
  };
  totals: AdvertisementMetricsTotals;
  daily: AdvertisementDailyMetric[];
  placements: AdvertisementPlacementMetric[];
  creatives: AdvertisementCreativeMetric[];
}
