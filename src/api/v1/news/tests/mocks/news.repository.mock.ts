import type { News } from "../../news.types.js";

export const mockNews: News = {
  id: 1,

  newsNumber: 1001,

  title: "Tamil Nadu Budget 2026",

  slug: "tamil-nadu-budget-2026",

  summary: "Budget Summary",

  content: "Budget Content",

  newsScope: "STATE",

  countryId: 1,

  stateId: 33,

  districtId: 601,

  categoryId: 5,

  status: "DRAFT",

  draftedBy: 1,

  approvedBy: null,

  publishedBy: null,

  archivedBy: null,

  draftedAt: new Date(),

  approvedAt: null,

  publishedAt: null,

  createdBy: 1,

  updatedBy: null,

  createdAt: new Date(),

  updatedAt: new Date()
};

export const mockNewsResponse = {
  id: 1,
  newsNumber: 1001,
  title: "Tamil Nadu Budget 2026",
  slug: "tamil-nadu-budget-2026",
  summary: "Budget Summary",
  content: "Budget Content",
  newsScope: "STATE",
  countryId: 1,
  stateId: 33,
  districtId: 601,
  categoryId: 5,
  status: "DRAFT",
  publishedAt: null
};
