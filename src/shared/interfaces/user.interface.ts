// 기본 사용자 인터페이스
export interface User {
  id: string;
  email: string;
  name?: string;
  allergies?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// 레시피 인터페이스 (간소화)
export interface Recipe {
  id?: string;
  name: string;
  name_ko?: string;
  description?: string;
  ingredients?: string[];
  minutes?: number;
  tags?: string[];
  steps?: string[];
  _score?: number;
  highlights?: any;
}

// 레시피 검색 결과
export interface RecipeSearchResult {
  recipes: Recipe[];
  total: number;
  page?: number;
  totalPages?: number;
  success?: boolean;
  message?: string;
}

// 채팅 메시지
export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

// API 응답 기본 형태
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
