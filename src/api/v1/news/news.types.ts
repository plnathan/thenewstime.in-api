import type { NewsMediaItem } from "../media/media.types.js";

export type NewsStatus =
  "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED" | "REJECTED";

export type NewsScope = "WORLD" | "INDIA" | "STATE" | "DISTRICT";

/**
 * Category master-data representation.
 */
export interface NewsCategory {
  id: number;

  code: string;

  displayName: string;

  urlName: string;
}

/**
 * Country master-data representation.
 */
export interface NewsCountry {
  id: number;

  code: string;

  displayName: string;

  urlName: string;

  isoCode: string | null;
}

/**
 * State master-data representation.
 */
export interface NewsState {
  id: number;

  countryId: number;

  code: string;

  displayName: string;

  urlName: string;
}

/**
 * District master-data representation.
 */
export interface NewsDistrict {
  id: number;

  stateId: number;

  code: string;

  displayName: string;

  urlName: string;
}

export interface News {
  id: number;

  newsNumber: number;

  title: string;

  slug: string;

  summary: string | null;

  content: string;

  /**
   * Ordered media associated with this article.
   *
   * displayOrder = 1 is the primary image.
   */
  media?: NewsMediaItem[];

  /**
   * Total recorded article views.
   */
  views: number;

  newsScope: NewsScope;

  countryId: number | null;

  stateId: number | null;

  districtId: number | null;

  categoryId: number;

  category: NewsCategory;

  country: NewsCountry | null;

  state: NewsState | null;

  district: NewsDistrict | null;

  status: NewsStatus;

  /**
   * Display ordering / promotion.
   *
   * A value greater than 0 is meaningful only while
   * displayPriorityUntil is in the future.
   */
  displayPriority: number;

  displayPriorityUntil: Date | null;

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

export interface PromoteNewsInput {
  promotedBy: number;

  /**
   * Promotion duration in days.
   *
   * The API currently supports exactly 3 days.
   */
  durationDays: 3;
}

export interface NewsSearchFilter {
  page: number;

  pageSize: number;

  search?: string | undefined;

  status?: NewsStatus | undefined;

  categoryId?: number | undefined;

  countryId?: number | undefined;

  scope?: NewsScope | undefined;

  stateId?: number | undefined;

  districtId?: number | undefined;

  sortBy?: string | undefined;

  sortOrder?: "ASC" | "DESC" | undefined;

  /**
   * Public/homepage ordering.
   *
   * When true:
   *
   * 1. PUBLISHED news only
   * 2. published_at DESC
   * 3. scope priority for identical published_at values
   * 4. id DESC as deterministic tie-breaker
   *
   * Promotion/display priority must NOT override
   * chronological public ordering.
   */
  publicOrder?: boolean | undefined;

  popularOrder?: boolean | undefined;
}

export interface PaginatedNews {
  items: News[];

  totalRecords: number;

  page: number;

  pageSize: number;
}
