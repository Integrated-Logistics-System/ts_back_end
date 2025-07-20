// Session management interface definitions

export interface UserSessionData {
  id: string;
  email: string;
  name: string;
  cookingLevel?: string;
  preferences?: string[];
  allergies?: string[];
  token: string;
  refreshToken?: string;
  loginAt: string;
  lastActivity?: string;
  expiresAt?: string;
  metadata?: SessionMetadata;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
  location?: string;
  loginMethod?: 'email' | 'social' | 'sso';
  isRemembered?: boolean;
}

export interface SessionStatus {
  hasSession: boolean;
  isExpired: boolean;
  isActive: boolean;
  lastActivity?: string;
  loginAt?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  timeUntilExpiry?: number;
  sessionDuration?: number;
}

export interface SessionValidationResult {
  isValid: boolean;
  session?: UserSessionData;
  reason?: 'expired' | 'not_found' | 'invalid' | 'corrupted';
  shouldRefresh?: boolean;
}

export interface SessionCleanupResult {
  cleaned: number;
  errors: number;
  totalProcessed: number;
  duration: number;
}

export interface ActiveSessionInfo {
  userId: string;
  email: string;
  name: string;
  loginAt: string;
  lastActivity: string;
  expiresAt: string;
  isExpired: boolean;
  metadata?: SessionMetadata;
}

export interface SessionStatistics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  averageSessionDuration: number;
  oldestSession?: string;
  newestSession?: string;
}