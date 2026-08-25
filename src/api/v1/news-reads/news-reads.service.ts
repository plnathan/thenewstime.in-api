import type { PoolClient } from "pg";

import * as newsRepository from "../news/news.repository.js";
import * as newsReadsRepository from "./news-reads.repository.js";

import type {
  CreateNewsReadInput,
  NewsRead,
  PopularNewsItem,
  PopularNewsSearchFilter
} from "./news-reads.types.js";

import { ApiError } from "../../../shared/utils/apiErrorInfo.js";

export interface CreateNewsReadResult {
  created: boolean;
  data: NewsRead | null;
}

/**
 * Create News Read
 *
 * Only PUBLISHED news can record reads.
 *
 * A session can record one read for the same article
 * within the configured duplicate-read window.
 */
export const createNewsRead = async (
  data: CreateNewsReadInput,
  client?: PoolClient
): Promise<CreateNewsReadResult> => {
  const news = await newsRepository.findById(data.newsId, client);

  if (!news) {
    throw new ApiError(400, "News not found.");
  }

  if (news.status !== "PUBLISHED") {
    throw new ApiError(400, "Only published news can record reads.");
  }

  /**
   * Prevent repeated reads from the same session
   * for the same article within 30 minutes.
   */
  const alreadyRead = await newsReadsRepository.existsRecentRead(
    data.newsId,
    data.sessionId,
    30,
    client
  );

  if (alreadyRead) {
    return {
      created: false,
      data: null
    };
  }

  const newsRead = await newsReadsRepository.create(data, client);

  return {
    created: true,
    data: newsRead
  };
};

/**
 * Count News Reads
 */
export const countNewsReads = async (
  newsId: number,
  client?: PoolClient
): Promise<number> => {
  const news = await newsRepository.findById(newsId, client);

  if (!news) {
    throw new ApiError(404, "News not found.");
  }

  return newsReadsRepository.countByNewsId(newsId, client);
};

/**
 * Find Popular News
 */
export const findPopularNews = async (
  filter: PopularNewsSearchFilter,
  client?: PoolClient
): Promise<PopularNewsItem[]> => {
  return newsReadsRepository.findPopularNews(filter, client);
};
