// 공통 인터페이스
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface SearchFilters {
  maxCookingTime?: number;
  tags?: string[];
  ingredients?: string[];
}

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
