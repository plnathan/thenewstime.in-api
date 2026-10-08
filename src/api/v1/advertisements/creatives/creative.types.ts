export type AdvertisementCreativeType = "IMAGE" | "VIDEO" | "HTML" | "TEXT";

export type AdvertisementCreativeStatus = "ACTIVE" | "INACTIVE";

export type AdvertisementCreativeVariant = "DESKTOP" | "MOBILE";

export type AdvertisementCreativePreviewStatus =
  | "EXACT_MATCH"
  | "SLIGHTLY_DIFFERENT"
  | "DIMENSION_MISMATCH"
  | "ASPECT_RATIO_MISMATCH"
  | "DIMENSIONS_NOT_AVAILABLE"
  | "NO_EXPECTED_DIMENSIONS";

export type AdvertisementCreativeRenderMode =
  "CONTAIN" | "NATIVE" | "FALLBACK_DESKTOP";

export interface AdvertisementCreative {
  id: number;
  advertisementId: number;
  formatId: number | null;
  creativeType: AdvertisementCreativeType;
  variant: AdvertisementCreativeVariant;
  title: string | null;
  altText: string | null;
  mediaUrl: string;
  thumbnailUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  displayOrder: number;
  isPrimary: boolean;
  status: AdvertisementCreativeStatus;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdvertisementCreativeInput {
  formatId?: number | null | undefined;
  creativeType: AdvertisementCreativeType;
  variant?: AdvertisementCreativeVariant | undefined;
  title?: string | null | undefined;
  altText?: string | null | undefined;
  mediaUrl: string;
  thumbnailUrl?: string | null | undefined;
  widthPx?: number | null | undefined;
  heightPx?: number | null | undefined;
  displayOrder?: number | undefined;
  isPrimary?: boolean | undefined;
  status?: AdvertisementCreativeStatus | undefined;
}

export interface UpdateAdvertisementCreativeInput {
  formatId?: number | null | undefined;
  creativeType?: AdvertisementCreativeType | undefined;
  variant?: AdvertisementCreativeVariant | undefined;
  title?: string | null | undefined;
  altText?: string | null | undefined;
  mediaUrl?: string | undefined;
  thumbnailUrl?: string | null | undefined;
  widthPx?: number | null | undefined;
  heightPx?: number | null | undefined;
  displayOrder?: number | undefined;
  isPrimary?: boolean | undefined;
  status?: AdvertisementCreativeStatus | undefined;
}

export interface AdvertisementCreativeExpectedDimensions {
  widthPx: number | null;
  heightPx: number | null;
  aspectRatio: number | null;
}

export interface AdvertisementCreativeActualDimensions {
  widthPx: number | null;
  heightPx: number | null;
  aspectRatio: number | null;
}

export interface AdvertisementCreativePreview {
  creativeId: number;
  advertisementId: number;
  formatId: number | null;
  creativeType: AdvertisementCreativeType;
  variant: AdvertisementCreativeVariant;

  previewUrl: string;
  thumbnailUrl: string | null;

  expected: AdvertisementCreativeExpectedDimensions;
  actual: AdvertisementCreativeActualDimensions;

  status: AdvertisementCreativePreviewStatus;
  statusMessage: string;

  renderMode: AdvertisementCreativeRenderMode;

  usesDesktopFallback: boolean;
}

export interface AdvertisementCreativePreviewResponse {
  desktop: AdvertisementCreativePreview | null;
  mobile: AdvertisementCreativePreview | null;
}
