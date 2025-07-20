// Authentication-related interface definitions

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  cookingLevel?: string;
  preferences?: string[];
  allergies?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  refreshToken: string;
  user: UserData;
  sessionExpires?: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface UserData {
  id: string;
  email: string;
  name: string;
  cookingLevel?: string;
  preferences?: string[];
  allergies?: string[];
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuthValidationResult {
  isValid: boolean;
  user?: UserData;
  error?: string;
  errorCode?: string;
}

export interface PasswordValidationOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

export interface RegisterValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

export interface LoginValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}