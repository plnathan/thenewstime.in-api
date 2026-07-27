import type { News } from "../news/news.types.js";
import type { NewsResponseDto } from "../dto/newsResponse.dto.js";

export function toNewsResponseDto(news: News): NewsResponseDto {
  return {
    id: news.id,

    newsNumber: news.newsNumber,

    title: news.title,

    slug: news.slug,

    summary: news.summary,

    content: news.content,

    newsScope: news.newsScope,

    categoryId: news.categoryId,

    countryId: news.countryId,

    stateId: news.stateId,

    districtId: news.districtId,

    status: news.status,

    publishedAt: news.publishedAt
  };
}

export function toNewsResponseDtoList(newsList: News[]): NewsResponseDto[] {
  return newsList.map(toNewsResponseDto);
}
