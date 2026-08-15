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
  country: {
    id: 1,
    code: "IN",
    displayName: "India",
    urlName: "india",
    isoCode: "IN"
  },

  stateId: 33,
  state: {
    id: 33,
    countryId: 1,
    code: "TN",
    displayName: "Tamil Nadu",
    urlName: "tamil-nadu"
  },

  districtId: 601,
  district: {
    id: 601,
    stateId: 33,
    code: "CHN",
    displayName: "Chennai",
    urlName: "chennai"
  },

  categoryId: 5,
  category: {
    id: 5,
    code: "POLITICS",
    displayName: "Politics",
    urlName: "politics"
  },

  status: "DRAFT",

  displayPriority: 0,

  displayPriorityUntil: null,

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
  country: {
    id: 1,
    code: "IN",
    displayName: "India",
    urlName: "india",
    isoCode: "IN"
  },
  stateId: 33,
  state: {
    id: 33,
    countryId: 1,
    code: "TN",
    displayName: "Tamil Nadu",
    urlName: "tamil-nadu"
  },
  district: {
    id: 601,
    stateId: 33,
    code: "CHN",
    displayName: "Chennai",
    urlName: "chennai"
  },
  districtId: 601,
  categoryId: 5,
  category: {
    id: 5,
    code: "POLITICS",
    displayName: "Politics",
    urlName: "politics"
  },
  status: "DRAFT",
  displayPriority: 0,
  displayPriorityUntil: null,
  publishedAt: null
};
