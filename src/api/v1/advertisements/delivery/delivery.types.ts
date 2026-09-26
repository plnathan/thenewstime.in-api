export type AdvertisementDeliveryPageType =
  "HOME" | "NEWS_LIST" | "NEWS_DETAIL";

export type AdvertisementDeliveryPlacementType =
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

export interface AdvertisementDeliveryRequest {
  pageType: AdvertisementDeliveryPageType;
  placementType: AdvertisementDeliveryPlacementType;
  placementId?: number;
  context?: AdvertisementDeliveryContext;
}

export interface AdvertisementDeliveryContext {
  site?: string;
  newsId?: number;
  category?: string;
  state?: string;
  district?: string;
  country?: string;
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
  fallbackBehavior: "HIDE" | "HOUSE_AD";
  displayFrequency:
    | "EVERY_VISIT"
    | "ONCE_PER_SESSION"
    | "ONCE_PER_DAY"
    | "ONCE_PER_PERIOD"
    | null;
  frequencyValue: number | null;
  autoCloseEnabled: boolean;
  autoCloseSeconds: number | null;
  closeButtonEnabled: boolean;
  closeOnOverlayClick: boolean;
}

export interface AdvertisementDeliveryCreative {
  id: number;
  formatId: number | null;
  creativeType: "IMAGE" | "HTML" | "TEXT";
  title: string | null;
  altText: string | null;
  mediaUrl: string;
  thumbnailUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  displayOrder: number;
  isPrimary: boolean;
}

export interface AdvertisementDeliveryFormat {
  id: number;
  code: string;
  displayName: string;
  widthPx: number | null;
  heightPx: number | null;
  isResponsive: boolean;
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
  placementDisplayOrder: number;
  insertionType: string;
  insertionPosition: number | null;
  maxImpressions: number | null;
  creative: AdvertisementDeliveryCreative | null;
  format: AdvertisementDeliveryFormat | null;
}

export interface AdvertisementDeliveryResponse {
  placement: AdvertisementDeliveryPlacement | null;
  advertisements: AdvertisementDeliveryItem[];
  fallbackApplied: boolean;
}
