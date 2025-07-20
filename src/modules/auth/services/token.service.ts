import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import {
  JwtPayload,
  TokenPair,
  TokenValidationResult,
  RefreshTokenData,
  TokenGenerationOptions,
  TokenRevocationResult,
} from '../interfaces/token.interface';
import {
  AUTH_CONSTANTS,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
} from '../constants/auth.constants';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 액세스 토큰과 리프레시 토큰 쌍 생성
   */
  async generateTokenPair(
    userId: string,
    email: string,
    name?: string,
    options: TokenGenerationOptions = {}
  ): Promise<TokenPair> {
    try {
      const accessToken = await this.generateAccessToken(userId, email, name, options);
      const refreshToken = await this.generateRefreshToken(userId, options);

      this.logger.debug(`Token pair generated for user: ${userId}`);

      return {
        accessToken,
        refreshToken,
        expiresIn: options.accessTokenTtl || AUTH_CONSTANTS.JWT_ACCESS_TOKEN_TTL,
        tokenType: 'Bearer',
      };
    } catch (error) {
      this.logger.error('Token pair generation failed:', error);
      throw new Error('토큰 생성에 실패했습니다.');
    }
  }

  /**
   * 액세스 토큰 생성
   */
  private async generateAccessToken(
    userId: string,
    email: string,
    name?: string,
    options: TokenGenerationOptions = {}
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      name,
      type: 'access',
      sessionId: options.sessionId,
    };

    const expiresIn = options.accessTokenTtl || AUTH_CONSTANTS.JWT_ACCESS_TOKEN_TTL;

    return this.jwtService.signAsync(payload, {
      expiresIn,
    });
  }

  /**
   * 리프레시 토큰 생성
   */
  private async generateRefreshToken(
    userId: string,
    options: TokenGenerationOptions = {}
  ): Promise<string> {
    const tokenId = this.generateTokenId();
    const expiresIn = options.refreshTokenTtl || AUTH_CONSTANTS.JWT_REFRESH_TOKEN_TTL;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const payload: JwtPayload = {
      sub: userId,
      email: '', // 리프레시 토큰에는 민감한 정보 최소화
      type: 'refresh',
      sessionId: options.sessionId,
    };

    const refreshToken = this.jwtService.signAsync(payload, {
      expiresIn,
    });

    // 리프레시 토큰 메타데이터 저장
    const refreshTokenData: RefreshTokenData = {
      userId,
      tokenId,
      createdAt: new Date().toISOString(),
      expiresAt,
      isRevoked: false,
    };

    const cacheKey = `${AUTH_CONSTANTS.REFRESH_TOKEN_KEY_PREFIX}${tokenId}`;
    await this.cacheService.set(cacheKey, refreshTokenData, expiresIn);

    return refreshToken;
  }

  /**
   * 토큰 검증
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      if (!token) {
        return {
          isValid: false,
          errorCode: 'NOT_FOUND',
          error: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.TOKEN_NOT_FOUND],
        };
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (!payload || !payload.sub) {
        return {
          isValid: false,
          errorCode: 'INVALID',
          error: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.TOKEN_INVALID],
        };
      }

      // 리프레시 토큰인 경우 추가 검증
      if (payload.type === 'refresh') {
        const isRevoked = await this.isRefreshTokenRevoked(token);
        if (isRevoked) {
          return {
            isValid: false,
            errorCode: 'INVALID',
            error: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.TOKEN_INVALID],
          };
        }
      }

      return {
        isValid: true,
        payload,
      };
    } catch (error: unknown) {
      this.logger.warn('Token validation failed:', error);

      if (error instanceof Error && error.name === 'TokenExpiredError') {
        return {
          isValid: false,
          errorCode: 'EXPIRED',
          error: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.TOKEN_EXPIRED],
        };
      }

      if (error instanceof Error && error.name === 'JsonWebTokenError') {
        return {
          isValid: false,
          errorCode: 'MALFORMED',
          error: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.TOKEN_MALFORMED],
        };
      }

      return {
        isValid: false,
        errorCode: 'INVALID',
        error: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.TOKEN_INVALID],
      };
    }
  }

  /**
   * 리프레시 토큰으로 새 토큰 쌍 생성
   */
  async refreshTokens(refreshToken: string, email: string, name?: string): Promise<TokenPair> {
    try {
      // 리프레시 토큰 검증
      const validation = await this.validateToken(refreshToken);
      
      if (!validation.isValid || !validation.payload) {
        throw new Error('유효하지 않은 리프레시 토큰입니다.');
      }

      const { sub: userId, sessionId } = validation.payload;

      // 리프레시 토큰 사용 기록 업데이트
      await this.updateRefreshTokenUsage(refreshToken);

      // 새 토큰 쌍 생성
      const newTokenPair = await this.generateTokenPair(userId, email, name, { sessionId });

      this.logger.debug(`Tokens refreshed for user: ${userId}`);

      return newTokenPair;
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new Error('토큰 갱신에 실패했습니다.');
    }
  }

  /**
   * 사용자의 모든 토큰 폐기
   */
  async revokeAllUserTokens(userId: string): Promise<TokenRevocationResult> {
    try {
      let tokensRevoked = 0;
      const errors: string[] = [];

      // 리프레시 토큰 폐기
      const refreshTokenKeys = await this.cacheService.getKeysPattern(
        `${AUTH_CONSTANTS.REFRESH_TOKEN_KEY_PREFIX}*`
      );

      for (const key of refreshTokenKeys) {
        try {
          const tokenData = await this.cacheService.get<RefreshTokenData>(key);
          if (tokenData && tokenData.userId === userId) {
            tokenData.isRevoked = true;
            await this.cacheService.set(key, tokenData, AUTH_CONSTANTS.REFRESH_TOKEN_TTL);
            tokensRevoked++;
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to revoke token ${key}: ${errorMessage}`);
        }
      }

      this.logger.log(`Revoked ${tokensRevoked} tokens for user: ${userId}`);

      return {
        success: errors.length === 0,
        tokensRevoked,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: unknown) {
      this.logger.error('Token revocation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        tokensRevoked: 0,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 특정 리프레시 토큰 폐기
   */
  async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    try {
      const validation = await this.validateToken(refreshToken);
      
      if (!validation.isValid || !validation.payload) {
        return false;
      }

      const tokenId = this.extractTokenId(refreshToken);
      const cacheKey = `${AUTH_CONSTANTS.REFRESH_TOKEN_KEY_PREFIX}${tokenId}`;
      
      const tokenData = await this.cacheService.get<RefreshTokenData>(cacheKey);
      if (tokenData) {
        tokenData.isRevoked = true;
        await this.cacheService.set(cacheKey, tokenData, AUTH_CONSTANTS.REFRESH_TOKEN_TTL);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Refresh token revocation failed:', error);
      return false;
    }
  }

  // ==================== Private Helper Methods ====================

  private generateTokenId(): string {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractTokenId(token: string): string {
    try {
      const payload = this.jwtService.decode(token) as JwtPayload;
      return payload.sessionId || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  private async isRefreshTokenRevoked(refreshToken: string): Promise<boolean> {
    try {
      const tokenId = this.extractTokenId(refreshToken);
      const cacheKey = `${AUTH_CONSTANTS.REFRESH_TOKEN_KEY_PREFIX}${tokenId}`;
      
      const tokenData = await this.cacheService.get<RefreshTokenData>(cacheKey);
      return tokenData ? tokenData.isRevoked : true;
    } catch (error) {
      this.logger.error('Refresh token revocation check failed:', error);
      return true; // 에러 시 안전하게 폐기된 것으로 간주
    }
  }

  private async updateRefreshTokenUsage(refreshToken: string): Promise<void> {
    try {
      const tokenId = this.extractTokenId(refreshToken);
      const cacheKey = `${AUTH_CONSTANTS.REFRESH_TOKEN_KEY_PREFIX}${tokenId}`;
      
      const tokenData = await this.cacheService.get<RefreshTokenData>(cacheKey);
      if (tokenData) {
        tokenData.lastUsed = new Date().toISOString();
        await this.cacheService.set(cacheKey, tokenData, AUTH_CONSTANTS.REFRESH_TOKEN_TTL);
      }
    } catch (error) {
      this.logger.warn('Failed to update refresh token usage:', error);
      // 사용 기록 실패는 치명적이지 않으므로 에러를 throw하지 않음
    }
  }
}