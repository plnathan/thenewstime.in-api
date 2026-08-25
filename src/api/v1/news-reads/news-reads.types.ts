export interface CreateNewsReadInput {
  newsId: number;
  sessionId: string;
  visitorId?: string | null | undefined;
  ipHash?: string | null | undefined;
  browser?: string | null | undefined;
  operatingSystem?: string | null | undefined;
  deviceType?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface NewsRead {
  id: number;
  newsId: number;
  sessionId: string;
  visitorId: string | null;
  ipHash: string | null;
  browser: string | null;
  operatingSystem: string | null;
  deviceType: string | null;
  userAgent: string | null;
  readAt: Date;
}

export interface PopularNewsItem {
  newsId: number;
  readCount: number;
}

export interface PopularNewsSearchFilter {
  limit: number;
  days?: number | undefined;
}
