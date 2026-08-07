export interface NewsResponseDto {
  id: number;

  newsNumber: number;

  title: string;

  slug: string;

  summary: string | null;

  content: string;

  newsScope: string;

  categoryId: number;

  categoryName: string;
  
  countryId: number | null;

  stateId: number | null;

  districtId: number | null;

  status: string;

  publishedAt: Date | null;
}
