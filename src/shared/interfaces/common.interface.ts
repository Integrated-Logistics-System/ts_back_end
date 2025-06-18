/**
 * 공통으로 사용되는 인터페이스 정의
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

export interface SearchOptions {
  query: string;
  filters?: Record<string, any>;
  pagination?: PaginationOptions;
  fuzzy?: boolean;
  boost?: Record<string, number>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
  details?: Record<string, any>;
  features?: string[];
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  path?: string;
}
