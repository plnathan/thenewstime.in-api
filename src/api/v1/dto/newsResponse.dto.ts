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

  status: string;

  publishedAt: Date | null;
}
