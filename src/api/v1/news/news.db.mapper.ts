import type {
  News,
  NewsCategory,
  NewsCountry,
  NewsDistrict,
  NewsState
} from "./news.types.js";

/**
 * Maps a PostgreSQL news row to the News domain model.
 */
export const mapNews = (row: any): News => {
  const category: NewsCategory = {
    id: Number(row.category_id),
    code: row.category_code,
    displayName: row.category_display_name,
    urlName: row.category_url_name
  };

  const country: NewsCountry | null =
    row.country_id !== null
      ? {
          id: Number(row.country_id),
          code: row.country_code,
          displayName: row.country_display_name,
          urlName: row.country_url_name,
          isoCode: row.country_iso_code ?? null
        }
      : null;

  const state: NewsState | null =
    row.state_id !== null
      ? {
          id: Number(row.state_id),
          countryId: Number(row.state_country_id),
          code: row.state_code,
          displayName: row.state_display_name,
          urlName: row.state_url_name
        }
      : null;

  const district: NewsDistrict | null =
    row.district_id !== null
      ? {
          id: Number(row.district_id),
          stateId: Number(row.district_state_id),
          code: row.district_code,
          displayName: row.district_display_name,
          urlName: row.district_url_name
        }
      : null;

  return {
    id: Number(row.id),

    newsNumber: Number(row.news_number),

    title: row.title,

    slug: row.slug,

    summary: row.summary,

    content: row.content,

    newsScope: row.news_scope,

    countryId: row.country_id !== null ? Number(row.country_id) : null,

    stateId: row.state_id !== null ? Number(row.state_id) : null,

    districtId: row.district_id !== null ? Number(row.district_id) : null,

    categoryId: Number(row.category_id),

    category,

    country,

    state,

    district,

    media: Array.isArray(row.media) ? row.media : [],

    views: Number(row.view_count ?? 0),

    status: row.status,

    displayPriority:
      row.display_priority !== null && row.display_priority !== undefined
        ? Number(row.display_priority)
        : 0,

    displayPriorityUntil:
      row.display_priority_until !== null &&
      row.display_priority_until !== undefined
        ? new Date(row.display_priority_until)
        : null,

    draftedBy: Number(row.drafted_by),

    approvedBy: row.approved_by !== null ? Number(row.approved_by) : null,

    publishedBy: row.published_by !== null ? Number(row.published_by) : null,

    archivedBy: row.archived_by !== null ? Number(row.archived_by) : null,

    draftedAt: new Date(row.drafted_at),

    approvedAt: row.approved_at !== null ? new Date(row.approved_at) : null,

    publishedAt: row.published_at !== null ? new Date(row.published_at) : null,

    createdBy: Number(row.created_by),

    updatedBy: row.updated_by !== null ? Number(row.updated_by) : null,

    createdAt: new Date(row.created_at),

    updatedAt: new Date(row.updated_at)
  };
};

/**
 * Maps multiple PostgreSQL rows.
 */
export const mapNewsList = (rows: any[]): News[] => {
  return rows.map(mapNews);
};
