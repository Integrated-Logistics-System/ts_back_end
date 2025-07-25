import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { UserSessionData } from '../auth.service';

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);
    private readonly SESSION_TTL = 86400 * 7; // 7일

    constructor(private readonly cacheService: CacheService) {}

    /**
     * 사용자 세션 저장 (Redis)
     */
    async saveUserSession(userId: string, sessionData: UserSessionData): Promise<void> {
        try {
            const sessionKey = `user_session:${userId}`;
            
            await this.cacheService.set(sessionKey, JSON.stringify(sessionData), this.SESSION_TTL);
            this.logger.log(`💾 세션 저장 완료: ${userId}`);
        } catch (error: unknown) {
            this.logger.error(`세션 저장 실패 for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    /**
     * 사용자 세션 조회 (Redis)
     */
    async getUserSession(userId: string): Promise<UserSessionData | null> {
        try {
            const sessionKey = `user_session:${userId}`;
            const sessionData = await this.cacheService.get<UserSessionData>(sessionKey);
            
            if (!sessionData) {
                this.logger.warn(`세션 없음: ${userId}`);
                return null;
            }
            
            // CacheService가 이미 JSON.parse를 해주므로 추가 파싱 불필요
            let session: UserSessionData;
            
            if (typeof sessionData === 'string') {
                // 문자열인 경우에만 JSON.parse 수행
                session = JSON.parse(sessionData) as UserSessionData;
            } else {
                // 이미 객체인 경우 그대로 사용
                session = sessionData as UserSessionData;
            }
            
            // 마지막 활동 시간 업데이트
            session.lastActivity = new Date().toISOString();
            await this.saveUserSession(userId, session);
            
            return session;
        } catch (error: unknown) {
            this.logger.error(`세션 조회 실패 for ${userId}:`, error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    /**
     * 세션 기반 빠른 인증 (웹소켓용)
     */
    async authenticateBySession(userId: string): Promise<UserSessionData | null> {
        try {
            const session = await this.getUserSession(userId);
            
            if (!session) {
                this.logger.warn(`세션 없음: ${userId}`);
                return null;
            }
            
            // 세션 유효성 검증 (로그인 후 7일 이내)
            const loginTime = new Date(session.loginAt).getTime();
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            
            if (now - loginTime > sevenDays) {
                this.logger.warn(`세션 만료: ${userId}`);
                await this.clearSession(userId);
                return null;
            }
            
            this.logger.log(`🚀 세션 빠른 인증 성공: ${session.email}`);
            
            return {
                id: session.id,
                email: session.email,
                name: session.name,
                cookingLevel: session.cookingLevel,
                preferences: session.preferences,
                allergies: session.allergies,
                token: session.token,
                refreshToken: session.refreshToken,
                loginAt: session.loginAt,
                lastActivity: session.lastActivity
            };
        } catch (error: unknown) {
            this.logger.error(`세션 인증 실패 for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }

    /**
     * 세션 삭제
     */
    async clearSession(userId: string): Promise<void> {
        try {
            const sessionKey = `user_session:${userId}`;
            await this.cacheService.del(sessionKey);
            this.logger.log(`🗑️ 세션 삭제 완료: ${userId}`);
        } catch (error: unknown) {
            this.logger.error(`세션 삭제 실패 for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    /**
     * 세션 정보 업데이트
     */
    async updateSession(userId: string, updates: Partial<UserSessionData>): Promise<void> {
        try {
            const existingSession = await this.getUserSession(userId);
            if (existingSession) {
                const updatedSession = { ...existingSession, ...updates };
                await this.saveUserSession(userId, updatedSession);
            }
        } catch (error: unknown) {
            this.logger.error(`세션 업데이트 실패 for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }
}