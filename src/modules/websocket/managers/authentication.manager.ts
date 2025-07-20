import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../user/user.service';
import { AuthService } from '../../auth/auth.service';
import {
  AuthenticatedSocket,
  UserProfile,
  WebSocketError,
} from '../interfaces/websocket.interface';
import {
  WEBSOCKET_CONFIG,
  ERROR_CODES,
  ERROR_MESSAGES,
} from '../constants/websocket.constants';

@Injectable()
export class AuthenticationManager {
  private readonly logger = new Logger(AuthenticationManager.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  /**
   * WebSocket 연결 인증
   */
  async authenticateConnection(socket: AuthenticatedSocket): Promise<UserProfile | null> {
    try {
      const token = this.extractToken(socket);
      
      if (!token) {
        this.logger.warn(`No token provided for connection: ${socket.id}`);
        return null;
      }

      const userProfile = await this.validateToken(token);
      
      if (!userProfile) {
        this.logger.warn(`Invalid token for connection: ${socket.id}`);
        return null;
      }

      this.logger.log(`Authentication successful for user: ${userProfile.email}`);
      return userProfile;

    } catch (error) {
      this.logger.error('Connection authentication failed:', error);
      return null;
    }
  }

  /**
   * 토큰 기반 사용자 인증
   */
  async authenticateUser(token: string): Promise<UserProfile> {
    try {
      if (!token) {
        throw this.createAuthError(ERROR_CODES.AUTH_REQUIRED);
      }

      const userProfile = await this.validateToken(token);
      
      if (!userProfile) {
        throw this.createAuthError(ERROR_CODES.AUTH_INVALID_TOKEN);
      }

      return userProfile;

    } catch (error) {
      const isWebSocketError = (err: unknown): err is WebSocketError => {
        return !!(err && typeof err === 'object' && 'code' in err);
      };
      
      if (isWebSocketError(error)) {
        throw error;
      }
      
      this.logger.error('User authentication failed:', error);
      throw this.createAuthError(ERROR_CODES.AUTH_INVALID_TOKEN);
    }
  }

  /**
   * 클라이언트가 인증되었는지 확인
   */
  isAuthenticated(socket: AuthenticatedSocket): boolean {
    return socket.isAuthenticated === true && socket.user !== undefined;
  }

  /**
   * 인증 필요 여부 확인 (옵션)
   */
  requiresAuthentication(eventName: string): boolean {
    const publicEvents = [
      'ping',
      'get_status',
      'connect',
      'disconnect',
    ];
    
    return !publicEvents.includes(eventName);
  }

  /**
   * 인증 상태 확인 및 검증
   */
  async validateAuthentication(
    socket: AuthenticatedSocket,
    eventName: string
  ): Promise<void> {
    // 인증이 필요없는 이벤트인 경우 통과
    if (!this.requiresAuthentication(eventName)) {
      return;
    }

    // 인증되지 않은 경우
    if (!this.isAuthenticated(socket)) {
      throw this.createAuthError(ERROR_CODES.AUTH_REQUIRED);
    }

    // 토큰 만료 확인
    if (this.isTokenExpired(socket)) {
      throw this.createAuthError(ERROR_CODES.AUTH_EXPIRED_TOKEN);
    }
  }

  /**
   * 사용자 권한 확인
   */
  async checkPermission(
    socket: AuthenticatedSocket,
    permission: string
  ): Promise<boolean> {
    try {
      if (!this.isAuthenticated(socket)) {
        return false;
      }

      // 실제 구현에서는 사용자 역할/권한 체크
      // 예시: admin, user, guest 등의 권한 체크
      return true; // 기본적으로 모든 인증된 사용자에게 권한 부여
      
    } catch (error) {
      this.logger.error('Permission check failed:', error);
      return false;
    }
  }

  /**
   * 인증 토큰 갱신
   */
  async refreshAuthentication(socket: AuthenticatedSocket): Promise<UserProfile | null> {
    try {
      if (!socket.user?.id) {
        return null;
      }

      // 사용자 정보 다시 조회
      const userInfo = await this.userService.findById(socket.user.id);
      
      if (!userInfo) {
        return null;
      }

      const userProfile: UserProfile = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name || userInfo.email,
        cookingLevel: userInfo.settings?.cookingLevel,
        allergies: userInfo.settings?.allergies,
        preferences: userInfo.settings?.preferences,
        joinedAt: Date.now(),
      };

      // 소켓 정보 업데이트
      socket.user = {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
      };
      socket.authTimestamp = Date.now();

      return userProfile;

    } catch (error) {
      this.logger.error('Authentication refresh failed:', error);
      return null;
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * 소켓에서 토큰 추출
   */
  private extractToken(socket: AuthenticatedSocket): string | null {
    // Authorization 헤더에서 토큰 추출
    const authHeader = socket.handshake.headers[WEBSOCKET_CONFIG.AUTH_TOKEN_HEADER];
    if (authHeader && typeof authHeader === 'string') {
      const match = authHeader.match(/Bearer\s+(.+)/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 쿼리 파라미터에서 토큰 추출
    const queryToken = socket.handshake.query[WEBSOCKET_CONFIG.AUTH_TOKEN_QUERY];
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  /**
   * JWT 토큰 검증 및 사용자 정보 조회
   */
  private async validateToken(token: string): Promise<UserProfile | null> {
    try {
      // JWT 토큰 검증
      const payload = this.jwtService.verify(token);
      
      if (!payload || !payload.sub) {
        this.logger.warn('Invalid JWT payload');
        return null;
      }

      // 사용자 정보 조회
      const userInfo = await this.userService.findById(payload.sub);
      
      if (!userInfo) {
        this.logger.warn(`User not found: ${payload.sub}`);
        return null;
      }

      // UserProfile 생성
      const userProfile: UserProfile = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name || userInfo.email,
        cookingLevel: userInfo.settings?.cookingLevel,
        allergies: userInfo.settings?.allergies || [],
        preferences: userInfo.settings?.preferences || [],
        joinedAt: Date.now(),
      };

      return userProfile;

    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        this.logger.warn('JWT token expired');
        return null;
      } else if (error instanceof Error && error.name === 'JsonWebTokenError') {
        this.logger.warn('Invalid JWT token');
        return null;
      }
      
      this.logger.error('Token validation failed:', error);
      return null;
    }
  }

  /**
   * 토큰 만료 확인
   */
  private isTokenExpired(socket: AuthenticatedSocket): boolean {
    if (!socket.authTimestamp) {
      return true;
    }

    const now = Date.now();
    const authAge = now - socket.authTimestamp;
    
    return authAge > WEBSOCKET_CONFIG.SESSION_DURATION;
  }

  /**
   * 인증 에러 생성
   */
  private createAuthError(code: string, details?: Record<string, any>): WebSocketError {
    return {
      code,
      message: ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || 'Authentication failed',
      details,
      timestamp: Date.now(),
    };
  }

  /**
   * 사용자 세션 정보 생성
   */
  createUserSession(userProfile: UserProfile): any {
    return {
      userId: userProfile.id,
      email: userProfile.email,
      name: userProfile.name,
      cookingLevel: userProfile.cookingLevel,
      allergies: userProfile.allergies || [],
      preferences: userProfile.preferences || [],
      authenticatedAt: Date.now(),
    };
  }

  /**
   * 인증 성공 응답 생성
   */
  createAuthSuccessResponse(userProfile: UserProfile): any {
    return {
      success: true,
      message: '인증에 성공했습니다.',
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        cookingLevel: userProfile.cookingLevel,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 인증 실패 응답 생성
   */
  createAuthFailureResponse(error: WebSocketError): any {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
      timestamp: Date.now(),
    };
  }
}