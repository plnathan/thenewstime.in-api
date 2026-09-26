export type AdvertisementCreativeType = "IMAGE" | "HTML" | "TEXT";

export type AdvertisementCreativeStatus = "ACTIVE" | "INACTIVE";

export interface AdvertisementCreative {
  id: number;
  advertisementId: number;
  formatId: number | null;
  creativeType: AdvertisementCreativeType;
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
