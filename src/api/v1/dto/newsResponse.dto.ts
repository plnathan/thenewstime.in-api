export interface NewsCategoryResponseDto {
  id: number;

  code: string;

  displayName: string;

  urlName: string;
}

export interface NewsCountryResponseDto {
  id: number;

  code: string;

  displayName: string;

  urlName: string;

  isoCode: string | null;
}

export interface NewsStateResponseDto {
  id: number;

  countryId: number;

  code: string;

  displayName: string;

  urlName: string;
}

export interface NewsDistrictResponseDto {
  id: number;

  stateId: number;

  code: string;

  displayName: string;

  urlName: string;
}

export interface NewsMediaResponseDto {
  id: number;

  mediaAssetId: number;

  provider: string;

  assetType: string;

  mediaRole: string;

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

export interface NewsResponseDto {
  id: number;

  newsNumber: number;

  title: string;

  slug: string;

  summary: string | null;

  content: string;

  newsScope: string;

  categoryId: number;

  category: NewsCategoryResponseDto;

  countryId: number | null;

  country: NewsCountryResponseDto | null;

  stateId: number | null;

  state: NewsStateResponseDto | null;

  districtId: number | null;

  district: NewsDistrictResponseDto | null;

  media: NewsMediaResponseDto[];

  views: number;

  status: string;

  displayPriority: number | null;

  displayPriorityUntil: Date | null;

  publishedAt: Date | null;
}
