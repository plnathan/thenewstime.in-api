export type PlacementPageType = "HOME" | "NEWS_LIST" | "NEWS_DETAIL";

export type AdvertisementPlacementType =
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

export type PlacementInsertionType =
  "FIXED" | "AFTER_N_ITEMS" | "BETWEEN_SECTIONS";

export type PlacementFallbackBehavior = "HIDE" | "HOUSE_AD";

export type PlacementDisplayFrequency =
  "EVERY_VISIT" | "ONCE_PER_SESSION" | "ONCE_PER_DAY" | "ONCE_PER_PERIOD";

export type PlacementStatus = "ACTIVE" | "INACTIVE";

export interface AdvertisementPlacementFormat {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  widthPx: number | null;
  heightPx: number | null;
  isResponsive: boolean;
}

export interface AdvertisementPlacement {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  pageType: PlacementPageType;
  placementType: AdvertisementPlacementType;
  insertionType: PlacementInsertionType;
  displayOrder: number;
  isEnabled: boolean;

  /**
   * System-defined advertisement format assigned to this placement.
   *
   * The ID is stored on advertisement_placements.
   * Dimensions and responsive information are resolved from
   * advertisement_formats.
   */
  formatId: number | null;
  format: AdvertisementPlacementFormat | null;

  collapseWhenEmpty: boolean;
  fallbackBehavior: PlacementFallbackBehavior;
  displayFrequency: PlacementDisplayFrequency | null;
  frequencyValue: number | null;
  autoCloseEnabled: boolean;
  autoCloseSeconds: number | null;
  closeButtonEnabled: boolean;
  closeOnOverlayClick: boolean;
  status: PlacementStatus;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdvertisementPlacementInput {
  code: string;
  displayName: string;
  description?: string | undefined;
  pageType: PlacementPageType;
  placementType: AdvertisementPlacementType;
  insertionType?: PlacementInsertionType | undefined;
  displayOrder?: number | undefined;
  isEnabled?: boolean | undefined;

  /**
   * null = placement intentionally has no assigned format.
   * number = assign the supplied advertisement format.
   */
  formatId?: number | null | undefined;

  collapseWhenEmpty?: boolean | undefined;
  fallbackBehavior?: PlacementFallbackBehavior | undefined;
  displayFrequency?: PlacementDisplayFrequency | null | undefined;
  frequencyValue?: number | null | undefined;
  autoCloseEnabled?: boolean | undefined;
  autoCloseSeconds?: number | null | undefined;
  closeButtonEnabled?: boolean | undefined;
  closeOnOverlayClick?: boolean | undefined;
  status?: PlacementStatus | undefined;
}

export interface UpdateAdvertisementPlacementInput {
  displayName?: string | undefined;
  description?: string | undefined;
  pageType?: PlacementPageType | undefined;
  placementType?: AdvertisementPlacementType | undefined;
  insertionType?: PlacementInsertionType | undefined;
  displayOrder?: number | undefined;
  isEnabled?: boolean | undefined;

  /**
   * undefined = do not change.
   * null = explicitly remove the assigned format.
   * number = assign the supplied format.
   */
  formatId?: number | null | undefined;

  collapseWhenEmpty?: boolean | undefined;
  fallbackBehavior?: PlacementFallbackBehavior | undefined;
  displayFrequency?: PlacementDisplayFrequency | null | undefined;
  frequencyValue?: number | null | undefined;
  autoCloseEnabled?: boolean | undefined;
  autoCloseSeconds?: number | null | undefined;
  closeButtonEnabled?: boolean | undefined;
  closeOnOverlayClick?: boolean | undefined;
  status?: PlacementStatus | undefined;
}
