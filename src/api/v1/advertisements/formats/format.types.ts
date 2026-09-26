export type AdvertisementFormatStatus = "ACTIVE" | "INACTIVE";

export interface AdvertisementFormat {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  widthPx: number | null;
  heightPx: number | null;
  isResponsive: boolean;
  isSystemFormat: boolean;
  status: AdvertisementFormatStatus;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
