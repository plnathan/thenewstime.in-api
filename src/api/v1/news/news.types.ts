export type NewsStatus =
  "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED" | "REJECTED";

export type NewsScope = "GLOBAL" | "COUNTRY" | "STATE" | "DISTRICT";

export interface News {
  id: number;

  newsNumber: number;

  title: string;

  slug: string;

  summary: string | null;

  content: string;

  newsScope: NewsScope;

  countryId: number | null;

  stateId: number | null;

  districtId: number | null;

  categoryId: number;

  status: NewsStatus;

  draftedBy: number;

  approvedBy: number | null;

  publishedBy: number | null;

  archivedBy: number | null;
  
  draftedAt: Date;

  approvedAt: Date | null;

  publishedAt: Date | null;

  createdBy: number;

  updatedBy: number | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface CreateNewsInput {
  title: string;

  slug: string;

  summary?: string;

  content: string;

  newsScope: NewsScope;

  countryId?: number;

  stateId?: number;

  districtId?: number;

  categoryId: number;

  draftedBy: number;

  createdBy: number;
}

export interface UpdateNewsInput {
  title?: string;

  slug?: string;

  summary?: string;

  content?: string;

  newsScope?: NewsScope;

  countryId?: number | null;

  stateId?: number | null;

  districtId?: number | null;

  categoryId?: number;

  updatedBy: number;
}

export interface NewsSearchFilter {
  page: number;

  pageSize: number;

  search?: string | undefined;

  status?: NewsStatus | undefined;

  categoryId?: number | undefined;

  scope?: NewsScope | undefined;

  stateId?: number | undefined;

  districtId?: number | undefined;

  sortBy?: string | undefined;

  sortOrder?: "ASC" | "DESC" | undefined;
}

export interface PaginatedNews {
  items: News[];

  total: number;

  page: number;

  pageSize: number;
}
