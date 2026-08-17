import type {
  NewsCategoryResponseDto,
  NewsCountryResponseDto,
  NewsDistrictResponseDto,
  NewsMediaResponseDto,
  NewsResponseDto,
  NewsStateResponseDto
} from "../dto/newsResponse.dto.js";
import type { News } from "../news/news.types.js";

export function toNewsResponseDto(news: News): NewsResponseDto {
  const category: NewsCategoryResponseDto = {
    id: news.category.id,

    code: news.category.code,

    displayName: news.category.displayName,

    urlName: news.category.urlName
  };

  const country: NewsCountryResponseDto | null = news.country
    ? {
        id: news.country.id,

        code: news.country.code,

        displayName: news.country.displayName,

        urlName: news.country.urlName,

        isoCode: news.country.isoCode
      }
    : null;

  const state: NewsStateResponseDto | null = news.state
    ? {
        id: news.state.id,

        countryId: news.state.countryId,

        code: news.state.code,

        displayName: news.state.displayName,

        urlName: news.state.urlName
      }
    : null;

  const district: NewsDistrictResponseDto | null = news.district
    ? {
        id: news.district.id,

        stateId: news.district.stateId,

        code: news.district.code,

        displayName: news.district.displayName,

        urlName: news.district.urlName
      }
    : null;

  const media: NewsMediaResponseDto[] = (news.media ?? []).map((item) => ({
    id: Number(item.id),

    mediaAssetId: Number(item.mediaAssetId),

    provider: item.provider,

    assetType: item.assetType,

    mediaRole: item.mediaRole,

    displayOrder: Number(item.displayOrder),

    publicId: item.publicId,

    originalFileName: item.originalFileName,

    mimeType: item.mimeType,

    fileExtension: item.fileExtension,

    fileSizeBytes:
      item.fileSizeBytes === null ? null : Number(item.fileSizeBytes),

    width: item.width === null ? null : Number(item.width),

    height: item.height === null ? null : Number(item.height),

    altText: item.altText,

    caption: item.caption,

    fileUrl: item.fileUrl,

    thumbnailUrl: item.thumbnailUrl
  }));

  return {
    id: news.id,

    newsNumber: news.newsNumber,

    title: news.title,

    slug: news.slug,

    summary: news.summary,

    content: news.content,

    newsScope: news.newsScope,

    categoryId: news.categoryId,

    category,

    countryId: news.countryId,

    country,

    stateId: news.stateId,

    state,

    districtId: news.districtId,

    district,

    media,

    status: news.status,

    displayPriority: news.displayPriority,

    displayPriorityUntil: news.displayPriorityUntil,

    publishedAt: news.publishedAt
  };
}

export function toNewsResponseDtoList(newsList: News[]): NewsResponseDto[] {
  return newsList.map(toNewsResponseDto);
}
