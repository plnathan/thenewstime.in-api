import type { News } from "./news.types.js";
//import type { News } from "../news/index.js";

/**
 * Maps a PostgreSQL news row to the News domain model.
 */
export const mapNews = (row: any): News => ({
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

  categoryName: row.category_name,

  status: row.status,

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
});

/**
 * Maps multiple PostgreSQL rows.
 */
export const mapNewsList = (rows: any[]): News[] => {
  return rows.map(mapNews);
};
