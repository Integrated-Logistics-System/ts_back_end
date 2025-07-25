import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class TokenService {
    private readonly logger = new Logger(TokenService.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly cacheService: CacheService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * 액세스 토큰 생성
     */
    generateAccessToken(userId: string, email: string): string {
        return this.jwtService.sign({
            sub: userId,
            email: email
        });
    }

    /**
     * 리프레시 토큰 생성 및 저장
     */
    async generateAndStoreRefreshToken(userId: string): Promise<string> {
        const refreshTokenExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d';
        const refreshToken = this.jwtService.sign({ sub: userId }, { expiresIn: refreshTokenExpiry });
        
        // TTL 계산: 30d = 30 * 24 * 60 * 60 = 2,592,000초
        const refreshTokenTtl = this.parseExpiryToSeconds(refreshTokenExpiry);
        await this.cacheService.set(`refresh_token:${userId}`, refreshToken, refreshTokenTtl);
        
        return refreshToken;
    }

    /**
     * 리프레시 토큰 검증
     */
    async validateRefreshToken(refreshToken: string): Promise<string | null> {
        try {
            const payload = this.jwtService.verify(refreshToken) as { sub: string };
            const userId = payload.sub;
            
            // 저장된 리프레시 토큰과 비교
            const storedRefreshToken = await this.cacheService.get(`refresh_token:${userId}`);
            if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
                return null;
            }
            
            return userId;
        } catch (error) {
            this.logger.warn('리프레시 토큰 검증 실패:', error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }

    /**
     * 토큰 기반 사용자 ID 추출
     */
    extractUserIdFromToken(token: string): string | null {
        try {
            const payload = this.jwtService.verify(token) as { sub?: string; userId?: string };
            return payload.sub || payload.userId || null;
        } catch (error) {
            this.logger.warn('토큰에서 사용자 ID 추출 실패:', error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }

    /**
     * 리프레시 토큰 무효화
     */
    async revokeRefreshToken(userId: string): Promise<{ success: boolean; message: string }> {
        try {
            const refreshTokenKey = `refresh_token:${userId}`;
            await this.cacheService.del(refreshTokenKey);
            
            this.logger.log(`🚫 리프레시 토큰 무효화 완료: ${userId}`);
            
            return {
                success: true,
                message: '리프레시 토큰이 무효화되었습니다'
            };
        } catch (error: unknown) {
            this.logger.error(`리프레시 토큰 무효화 실패 for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
            return {
                success: false,
                message: '리프레시 토큰 무효화 실패'
            };
        }
    }

    /**
     * 모든 토큰 정리 (로그아웃 시)
     */
    async clearAllTokens(userId: string): Promise<void> {
        try {
            const refreshTokenKey = `refresh_token:${userId}`;
            await this.cacheService.del(refreshTokenKey);
            
            // 채팅 히스토리도 선택적으로 삭제
            const chatKey = `chat_history:${userId}`;
            await this.cacheService.del(chatKey);
            
            this.logger.log(`🧹 모든 토큰 정리 완료: ${userId}`);
        } catch (error: unknown) {
            this.logger.error(`토큰 정리 실패 for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    /**
     * JWT 만료 시간 문자열을 초 단위로 변환
     */
    private parseExpiryToSeconds(expiry: string): number {
        const match = expiry.match(/^(\d+)([dhms]?)$/);
        if (!match) {
            this.logger.warn(`Invalid expiry format: ${expiry}, defaulting to 30 days`);
            return 30 * 24 * 60 * 60; // 30일
        }

        const value = parseInt(match[1] || '0', 10);
        const unit = match[2] || 's';

        switch (unit) {
            case 'd': // days
                return value * 24 * 60 * 60;
            case 'h': // hours
                return value * 60 * 60;
            case 'm': // minutes
                return value * 60;
            case 's': // seconds
            default:
                return value;
        }
    }
}