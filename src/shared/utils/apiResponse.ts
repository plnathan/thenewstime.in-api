export interface ValidationError {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: ValidationError[] | null;
  meta: PaginationMeta | null;
}
