// 기본 사용자 인터페이스
export interface User {
  id: string;
  email: string;
  name?: string;
  allergies?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// API 응답 기본 형태
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
