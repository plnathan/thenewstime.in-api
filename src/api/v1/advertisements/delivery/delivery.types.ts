export type AdvertisementDeliveryPageType =
  "HOME" | "NEWS_LIST" | "NEWS_DETAIL";

export type AdvertisementDeliveryPlacementType =
  | "HOME_BANNER"
  | "HOME_TOP"
  | "HOME_BETWEEN_SECTIONS"
  | "HOME_SIDEBAR"
  | "NEWS_LIST_TOP"
  | "NEWS_LIST_BETWEEN"
  | "NEWS_LIST_BOTTOM"
  | "NEWS_LIST_SIDEBAR"
  | "NEWS_LIST_MODAL"
  | "NEWS_DETAIL_TOP"
  | "NEWS_DETAIL_BETWEEN"
  | "NEWS_DETAIL_SIDEBAR"
  | "NEWS_DETAIL_BOTTOM"
  | "NEWS_DETAIL_MODAL";

export type AdvertisementDeliveryRotationMode = "TIME_BASED";

export type AdvertisementDeliveryRotationStrategy = "ROUND_ROBIN";

export type AdvertisementDeliveryCreativeType =
  "IMAGE" | "VIDEO" | "HTML" | "TEXT";

export type AdvertisementDeliveryCreativeVariant = "DESKTOP" | "MOBILE";

export type AdvertisementDeliveryFallbackBehavior = "HIDE" | "HOUSE_AD";

export type AdvertisementDeliveryDisplayFrequency =
  "EVERY_VISIT" | "ONCE_PER_SESSION" | "ONCE_PER_DAY" | "ONCE_PER_PERIOD";

export interface AdvertisementDeliveryContext {
  site?: string;
  newsId?: number | string;
  category?: string;
  state?: string;
  district?: string;
  country?: string;
}

export interface AdvertisementDeliveryFormat {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  widthPx: number | null;
  heightPx: number | null;
  mobileWidthPx: number | null;
  mobileHeightPx: number | null;
  isResponsive: boolean;
}

export interface AdvertisementDeliveryCreative {
  id: number;
  creativeType: AdvertisementDeliveryCreativeType;
  variant: AdvertisementDeliveryCreativeVariant;
  title: string | null;
  altText: string | null;
  mediaUrl: string;
  thumbnailUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  formatId: number | null;
  displayOrder: number;
  isPrimary: boolean;
}

export interface AdvertisementDeliveryPlacement {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  pageType: AdvertisementDeliveryPageType;
  placementType: AdvertisementDeliveryPlacementType;
  insertionType: string;
  displayOrder: number;
  collapseWhenEmpty: boolean;
  fallbackBehavior: AdvertisementDeliveryFallbackBehavior;
  displayFrequency: AdvertisementDeliveryDisplayFrequency | null;
  frequencyValue: number | null;
  autoCloseEnabled: boolean;
  autoCloseSeconds: number | null;
  closeButtonEnabled: boolean;
  closeOnOverlayClick: boolean;
  isEnabled: boolean;
  rotationEnabled: boolean;
  rotationMode: AdvertisementDeliveryRotationMode;
  rotationIntervalSeconds: number;
  rotationStrategy: AdvertisementDeliveryRotationStrategy;
}

export interface AdvertisementDeliveryTargeting {
  id: number;
  targetType: string;
  targetValue: string;
  isInclude: boolean;
}

export interface AdvertisementDeliveryItem {
  advertisementId: number;
  name: string;
  advertisementType: string;
  destinationUrl: string | null;
  priority: number;
  openInNewTab: boolean;
  isClickable: boolean;
  isHouseAd: boolean;
  schedulePriority: number;

  placementRuleId: number;
  placementRuleDisplayOrder: number;
  placementRuleInsertionType: string | null;
  insertionPosition: number | null;
  maxImpressions: number | null;

  creatives: AdvertisementDeliveryCreative[];
  creative: AdvertisementDeliveryCreative | null;
  format: AdvertisementDeliveryFormat | null;

  targeting: AdvertisementDeliveryTargeting[];
}

export interface AdvertisementDeliveryResponse {
  placement: AdvertisementDeliveryPlacement | null;
  advertisements: AdvertisementDeliveryItem[];
  fallbackApplied: boolean;
}

export interface AdvertisementDeliveryRequest {
  pageType: AdvertisementDeliveryPageType;
  placementType: AdvertisementDeliveryPlacementType;
  placementId?: number;
  context?: AdvertisementDeliveryContext;
  deviceType?: AdvertisementDeliveryCreativeVariant;
  path?: string;
  districtId?: number | null;
  stateId?: number | null;
  countryId?: number | null;
}

export interface AdvertisementDeliveryRotationMetadata {
  enabled: boolean;
  mode: AdvertisementDeliveryRotationMode;
  intervalSeconds: number;
  strategy: AdvertisementDeliveryRotationStrategy;
}
