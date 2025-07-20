// Authentication constants and configuration

export const AUTH_CONSTANTS = {
  // Session configuration
  SESSION_TTL: 86400 * 7, // 7 days in seconds
  REFRESH_TOKEN_TTL: 2592000, // 30 days in seconds
  ACTIVITY_UPDATE_INTERVAL: 300, // 5 minutes in seconds
  
  // Redis key prefixes
  SESSION_KEY_PREFIX: 'user_session:',
  REFRESH_TOKEN_KEY_PREFIX: 'refresh_token:',
  CHAT_HISTORY_KEY_PREFIX: 'chat_history:',
  USER_LOCK_PREFIX: 'user_lock:',
  
  // Password validation
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  
  // Rate limiting
  LOGIN_ATTEMPTS_LIMIT: 5,
  LOGIN_ATTEMPTS_WINDOW: 900, // 15 minutes
  RATE_LIMIT_PREFIX: 'rate_limit:',
  
  // Token configuration
  JWT_ACCESS_TOKEN_TTL: 3600, // 1 hour
  JWT_REFRESH_TOKEN_TTL: 2592000, // 30 days
  
  // Session cleanup
  CLEANUP_BATCH_SIZE: 100,
  CLEANUP_INTERVAL: 3600, // 1 hour
  
} as const;

export const AUTH_ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  
  // Password errors
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  PASSWORD_TOO_LONG: 'PASSWORD_TOO_LONG',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  
  // Token errors
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_MALFORMED: 'TOKEN_MALFORMED',
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  
  // Session errors
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_INVALID: 'SESSION_INVALID',
  MULTIPLE_SESSIONS: 'MULTIPLE_SESSIONS',
  
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  EMAIL_INVALID: 'EMAIL_INVALID',
  EMAIL_REQUIRED: 'EMAIL_REQUIRED',
  PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
  NAME_REQUIRED: 'NAME_REQUIRED',
  
  // Rate limiting
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
} as const;

export const AUTH_ERROR_MESSAGES = {
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: '이메일 또는 비밀번호가 올바르지 않습니다.',
  [AUTH_ERROR_CODES.USER_NOT_FOUND]: '사용자를 찾을 수 없습니다.',
  [AUTH_ERROR_CODES.USER_ALREADY_EXISTS]: '이미 존재하는 이메일입니다.',
  [AUTH_ERROR_CODES.ACCOUNT_LOCKED]: '계정이 잠겨있습니다. 잠시 후 다시 시도해주세요.',
  
  [AUTH_ERROR_CODES.WEAK_PASSWORD]: '비밀번호가 너무 약합니다.',
  [AUTH_ERROR_CODES.PASSWORD_TOO_SHORT]: '비밀번호는 최소 8자 이상이어야 합니다.',
  [AUTH_ERROR_CODES.PASSWORD_TOO_LONG]: '비밀번호가 너무 깁니다.',
  [AUTH_ERROR_CODES.PASSWORD_MISMATCH]: '비밀번호가 일치하지 않습니다.',
  
  [AUTH_ERROR_CODES.TOKEN_EXPIRED]: '토큰이 만료되었습니다.',
  [AUTH_ERROR_CODES.TOKEN_INVALID]: '유효하지 않은 토큰입니다.',
  [AUTH_ERROR_CODES.TOKEN_MALFORMED]: '토큰 형식이 올바르지 않습니다.',
  [AUTH_ERROR_CODES.TOKEN_NOT_FOUND]: '토큰을 찾을 수 없습니다.',
  [AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED]: 'Refresh 토큰이 만료되었습니다.',
  
  [AUTH_ERROR_CODES.SESSION_EXPIRED]: '세션이 만료되었습니다.',
  [AUTH_ERROR_CODES.SESSION_NOT_FOUND]: '세션을 찾을 수 없습니다.',
  [AUTH_ERROR_CODES.SESSION_INVALID]: '유효하지 않은 세션입니다.',
  [AUTH_ERROR_CODES.MULTIPLE_SESSIONS]: '다른 곳에서 로그인되어 세션이 종료됩니다.',
  
  [AUTH_ERROR_CODES.EMAIL_INVALID]: '유효하지 않은 이메일 형식입니다.',
  [AUTH_ERROR_CODES.EMAIL_REQUIRED]: '이메일은 필수입니다.',
  [AUTH_ERROR_CODES.PASSWORD_REQUIRED]: '비밀번호는 필수입니다.',
  [AUTH_ERROR_CODES.NAME_REQUIRED]: '이름은 필수입니다.',
  
  [AUTH_ERROR_CODES.TOO_MANY_ATTEMPTS]: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
  [AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED]: '요청 한도를 초과했습니다.',
  
  [AUTH_ERROR_CODES.INTERNAL_ERROR]: '내부 서버 오류가 발생했습니다.',
  [AUTH_ERROR_CODES.SERVICE_UNAVAILABLE]: '서비스를 사용할 수 없습니다.',
  [AUTH_ERROR_CODES.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다.',
  [AUTH_ERROR_CODES.CACHE_ERROR]: '캐시 오류가 발생했습니다.',
} as const;

export const AUTH_SUCCESS_MESSAGES = {
  REGISTRATION_SUCCESS: '회원가입이 완료되었습니다.',
  LOGIN_SUCCESS: '로그인이 완료되었습니다.',
  LOGOUT_SUCCESS: '로그아웃이 완료되었습니다.',
  TOKEN_REFRESHED: '토큰이 갱신되었습니다.',
  SESSION_CREATED: '세션이 생성되었습니다.',
  SESSION_UPDATED: '세션이 업데이트되었습니다.',
  PASSWORD_UPDATED: '비밀번호가 변경되었습니다.',
} as const;

export const COOKIE_CONFIG = {
  ACCESS_TOKEN: {
    name: 'access_token',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: AUTH_CONSTANTS.JWT_ACCESS_TOKEN_TTL * 1000,
  },
  REFRESH_TOKEN: {
    name: 'refresh_token',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: AUTH_CONSTANTS.JWT_REFRESH_TOKEN_TTL * 1000,
  },
} as const;

export const PASSWORD_VALIDATION_RULES = {
  minLength: AUTH_CONSTANTS.PASSWORD_MIN_LENGTH,
  maxLength: AUTH_CONSTANTS.PASSWORD_MAX_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  forbiddenPatterns: [
    /(.)\1{2,}/, // 같은 문자 3번 이상 반복
    /123456|654321|qwerty|password/i, // 일반적인 약한 패스워드
  ],
} as const;