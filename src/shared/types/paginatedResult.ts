export interface PaginatedResult<T> {
  items: T[];
  totalRecords: number;
  page: number;
  pageSize: number;
}
