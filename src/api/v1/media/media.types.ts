export type MediaProvider = "CLOUDINARY";

export type MediaAssetType = "IMAGE";

export type MediaRole = "DETAIL";

export type MediaStatus = "ACTIVE" | "DELETED";

export interface NewsMediaItem {
  id: number;

  mediaAssetId: number;

  provider: MediaProvider;

  assetType: MediaAssetType;

  mediaRole: MediaRole;

  displayOrder: number;

  publicId: string;

  originalFileName: string | null;

  mimeType: string | null;

  fileExtension: string | null;

  fileSizeBytes: number | null;

  width: number | null;

  height: number | null;

  altText: string | null;

  caption: string | null;

  fileUrl: string;

  thumbnailUrl: string | null;
}

export interface MediaUploadMetadata {
  altText?: string | null;

  caption?: string | null;
}

export interface MediaOrderItem {
  mediaId: number;

  displayOrder: number;
}
