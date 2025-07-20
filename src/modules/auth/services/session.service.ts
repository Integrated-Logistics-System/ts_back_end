import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import {
  UserSessionData,
  SessionStatus,
  SessionValidationResult,
  SessionCleanupResult,
  ActiveSessionInfo,
  SessionStatistics,
  SessionMetadata,
} from '../interfaces/session.interface';
import {
  AUTH_CONSTANTS,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
} from '../constants/auth.constants';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * 사용자 세션 저장
   */
  async saveSession(userId: string, sessionData: UserSessionData): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(userId);
      
      // 세션 만료 시간 설정
      const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.SESSION_TTL * 1000).toISOString();
      const sessionWithExpiry = {
        ...sessionData,
        expiresAt,
        lastActivity: new Date().toISOString(),
      };

      await this.cacheService.set(sessionKey, sessionWithExpiry, AUTH_CONSTANTS.SESSION_TTL);
      
      this.logger.debug(`Session saved for user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to save session:', error);
      throw new Error('세션 저장에 실패했습니다.');
    }
  }

  /**
   * 사용자 세션 조회
   */
  async getSession(userId: string): Promise<UserSessionData | null> {
    try {
      const sessionKey = this.getSessionKey(userId);
      const session = await this.cacheService.get<UserSessionData>(sessionKey);
      
      if (!session) {
        return null;
      }

      // 세션 만료 확인
      if (this.isSessionExpired(session.loginAt, session.expiresAt)) {
        await this.deleteSession(userId);
        return null;
      }

      return session;
    } catch (error) {
      this.logger.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * 사용자 세션 삭제
   */
  async deleteSession(userId: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(userId);
      await this.cacheService.delete(sessionKey);
      
      this.logger.debug(`Session deleted for user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to delete session:', error);
      throw new Error('세션 삭제에 실패했습니다.');
    }
  }

  /**
   * 세션 유효성 검증
   */
  async validateSession(userId: string): Promise<SessionValidationResult> {
    try {
      const session = await this.getSession(userId);
      
      if (!session) {
        return {
          isValid: false,
          reason: 'not_found',
        };
      }

      // 세션 만료 확인
      if (this.isSessionExpired(session.loginAt, session.expiresAt)) {
        await this.deleteSession(userId);
        return {
          isValid: false,
          reason: 'expired',
        };
      }

      // 세션 데이터 무결성 확인
      if (!this.isSessionDataValid(session)) {
        await this.deleteSession(userId);
        return {
          isValid: false,
          reason: 'corrupted',
        };
      }

      // 세션 갱신이 필요한지 확인
      const shouldRefresh = this.shouldRefreshSession(session);

      return {
        isValid: true,
        session,
        shouldRefresh,
      };
    } catch (error) {
      this.logger.error('Session validation failed:', error);
      return {
        isValid: false,
        reason: 'invalid',
      };
    }
  }

  /**
   * 마지막 활동 시간 업데이트
   */
  async updateLastActivity(userId: string): Promise<void> {
    try {
      const session = await this.getSession(userId);
      
      if (!session) {
        return;
      }

      // 마지막 활동 시간으로부터 일정 시간이 지난 경우에만 업데이트
      const lastActivity = new Date(session.lastActivity || session.loginAt);
      const now = new Date();
      const timeDiff = now.getTime() - lastActivity.getTime();
      
      if (timeDiff > AUTH_CONSTANTS.ACTIVITY_UPDATE_INTERVAL * 1000) {
        session.lastActivity = now.toISOString();
        await this.saveSession(userId, session);
        
        this.logger.debug(`Last activity updated for user: ${userId}`);
      }
    } catch (error) {
      this.logger.warn('Failed to update last activity:', error);
      // 활동 시간 업데이트 실패는 치명적이지 않으므로 에러를 throw하지 않음
    }
  }

  /**
   * 세션 상태 조회
   */
  async getSessionStatus(userId: string): Promise<SessionStatus> {
    try {
      const session = await this.getSession(userId);
      
      if (!session) {
        return {
          hasSession: false,
          isExpired: false,
          isActive: false,
        };
      }

      const isExpired = this.isSessionExpired(session.loginAt, session.expiresAt);
      const loginTime = new Date(session.loginAt);
      const lastActivity = new Date(session.lastActivity || session.loginAt);
      const now = new Date();

      return {
        hasSession: true,
        isExpired,
        isActive: !isExpired && (now.getTime() - lastActivity.getTime()) < 30 * 60 * 1000, // 30분 이내 활동
        lastActivity: session.lastActivity,
        loginAt: session.loginAt,
        user: {
          id: session.id,
          email: session.email,
          name: session.name,
        },
        timeUntilExpiry: session.expiresAt ? 
          new Date(session.expiresAt).getTime() - now.getTime() : 
          undefined,
        sessionDuration: now.getTime() - loginTime.getTime(),
      };
    } catch (error) {
      this.logger.error('Failed to get session status:', error);
      return {
        hasSession: false,
        isExpired: false,
        isActive: false,
      };
    }
  }

  /**
   * 만료된 세션 정리
   */
  async cleanupExpiredSessions(): Promise<SessionCleanupResult> {
    const startTime = Date.now();
    let cleaned = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      this.logger.log('Starting expired session cleanup...');

      // 모든 세션 키 조회
      const sessionKeys = await this.cacheService.getKeysPattern(
        `${AUTH_CONSTANTS.SESSION_KEY_PREFIX}*`
      );

      totalProcessed = sessionKeys.length;

      // 배치 단위로 처리
      const batchSize = AUTH_CONSTANTS.CLEANUP_BATCH_SIZE;
      for (let i = 0; i < sessionKeys.length; i += batchSize) {
        const batch = sessionKeys.slice(i, i + batchSize);
        
        for (const sessionKey of batch) {
          try {
            const session = await this.cacheService.get<UserSessionData>(sessionKey);
            
            if (!session) {
              cleaned++;
              continue;
            }

            if (this.isSessionExpired(session.loginAt, session.expiresAt)) {
              await this.cacheService.delete(sessionKey);
              cleaned++;
            }
          } catch (error) {
            this.logger.warn(`Failed to process session ${sessionKey}:`, error);
            errors++;
          }
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Session cleanup completed: ${cleaned} cleaned, ${errors} errors, ${duration}ms`);

      return {
        cleaned,
        errors,
        totalProcessed,
        duration,
      };
    } catch (error) {
      this.logger.error('Session cleanup failed:', error);
      return {
        cleaned,
        errors: errors + 1,
        totalProcessed,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 활성 세션 목록 조회
   */
  async getActiveSessions(): Promise<ActiveSessionInfo[]> {
    try {
      const sessionKeys = await this.cacheService.getKeysPattern(
        `${AUTH_CONSTANTS.SESSION_KEY_PREFIX}*`
      );

      const activeSessions: ActiveSessionInfo[] = [];

      for (const sessionKey of sessionKeys) {
        try {
          const session = await this.cacheService.get<UserSessionData>(sessionKey);
          
          if (session && !this.isSessionExpired(session.loginAt, session.expiresAt)) {
            activeSessions.push({
              userId: session.id,
              email: session.email,
              name: session.name,
              loginAt: session.loginAt,
              lastActivity: session.lastActivity || session.loginAt,
              expiresAt: session.expiresAt || '',
              isExpired: false,
              metadata: session.metadata,
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to process session ${sessionKey}:`, error);
        }
      }

      return activeSessions.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
    } catch (error) {
      this.logger.error('Failed to get active sessions:', error);
      return [];
    }
  }

  /**
   * 세션 통계 조회
   */
  async getSessionStatistics(): Promise<SessionStatistics> {
    try {
      const activeSessions = await this.getActiveSessions();
      const now = new Date();

      let totalDuration = 0;
      let oldestSession: string | undefined;
      let newestSession: string | undefined;

      activeSessions.forEach(session => {
        const loginTime = new Date(session.loginAt);
        const duration = now.getTime() - loginTime.getTime();
        totalDuration += duration;

        if (!oldestSession || loginTime < new Date(oldestSession)) {
          oldestSession = session.loginAt;
        }
        if (!newestSession || loginTime > new Date(newestSession)) {
          newestSession = session.loginAt;
        }
      });

      return {
        totalSessions: activeSessions.length,
        activeSessions: activeSessions.filter(s => 
          (now.getTime() - new Date(s.lastActivity).getTime()) < 30 * 60 * 1000
        ).length,
        expiredSessions: 0, // 정리되므로 항상 0
        averageSessionDuration: activeSessions.length > 0 ? totalDuration / activeSessions.length : 0,
        oldestSession,
        newestSession,
      };
    } catch (error) {
      this.logger.error('Failed to get session statistics:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        averageSessionDuration: 0,
      };
    }
  }

  // ==================== Private Helper Methods ====================

  private getSessionKey(userId: string): string {
    return `${AUTH_CONSTANTS.SESSION_KEY_PREFIX}${userId}`;
  }

  private isSessionExpired(loginAt: string, expiresAt?: string): boolean {
    const now = Date.now();
    
    if (expiresAt) {
      return new Date(expiresAt).getTime() < now;
    }
    
    // expiresAt이 없는 경우 loginAt 기준으로 계산
    const loginTime = new Date(loginAt).getTime();
    return (now - loginTime) > AUTH_CONSTANTS.SESSION_TTL * 1000;
  }

  private isSessionDataValid(session: UserSessionData): boolean {
    // 필수 필드 확인
    if (!session.id || !session.email || !session.loginAt) {
      return false;
    }

    // 날짜 형식 확인
    if (isNaN(new Date(session.loginAt).getTime())) {
      return false;
    }

    // 토큰 존재 확인
    if (!session.token) {
      return false;
    }

    return true;
  }

  private shouldRefreshSession(session: UserSessionData): boolean {
    const now = new Date();
    const lastActivity = new Date(session.lastActivity || session.loginAt);
    const timeSinceActivity = now.getTime() - lastActivity.getTime();
    
    // 1시간 이상 활동이 없으면 갱신 권장
    return timeSinceActivity > 60 * 60 * 1000;
  }
}