// Token management interface definitions

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  name?: string;
  iat?: number; // Issued at
  exp?: number; // Expires at
  type?: 'access' | 'refresh';
  sessionId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: JwtPayload;
  error?: string;
  errorCode?: 'EXPIRED' | 'INVALID' | 'MALFORMED' | 'NOT_FOUND';
}

export interface RefreshTokenData {
  userId: string;
  tokenId: string;
  createdAt: string;
  expiresAt: string;
  isRevoked: boolean;
  lastUsed?: string;
  deviceInfo?: {
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface TokenGenerationOptions {
  accessTokenTtl?: number;
  refreshTokenTtl?: number;
  includeUserInfo?: boolean;
  sessionId?: string;
}

export interface TokenRevocationResult {
  success: boolean;
  tokensRevoked: number;
  errors?: string[];
}