import type {
  CreateNewsInput,
  News,
  NewsSearchFilter,
  PaginatedNews,
  UpdateNewsInput,
  NewsStatus
} from "./news.types.js";

export interface INewsRepository {
  create(data: CreateNewsInput): Promise<News>;

  update(id: number, data: UpdateNewsInput): Promise<News | null>;

  delete(id: number): Promise<boolean>;

  findById(id: number): Promise<News | null>;

  findBySlug(slug: string): Promise<News | null>;

  findByNewsNumber(newsNumber: number): Promise<News | null>;

  existsBySlug(slug: string): Promise<boolean>;

  findAll(filter: NewsSearchFilter): Promise<PaginatedNews>;

  changeStatus(id: number, status: NewsStatus, userId: number): Promise<void>;
}
