import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { CacheService } from '../cache/cache.service';
import { TrialChefService } from '../user/trial-chef.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

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
  isTrialUser?: boolean; // 체험용 계정 여부
  trialUsername?: string; // 체험용 계정명
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ✅ JWT Refresh Token 로직 구현 완료 (JWT_REFRESH_EXPIRES_IN 활용)
  // TODO: Redis 클러스터링 활성화 시 세션 관리 로직 개선 필요

  // 세션 TTL 상수
  private readonly SESSION_TTL = 86400 * 7; // 7일

  constructor(
      private readonly userService: UserService,
      private readonly jwtService: JwtService,
      private readonly cacheService: CacheService,
      private readonly configService: ConfigService,
      private readonly trialChefService: TrialChefService,
  ) {}

  async register(
      email: string,
      password: string,
      name?: string,
      cookingLevel?: string,
      preferences?: string[]
  ) {
    this.logger.log(`Register attempt for email: ${email}`);

    try {
      // 중복 이메일 체크
      const userExists = await this.userService.userExists(email);
      if (userExists) {
        throw new ConflictException('이미 존재하는 이메일입니다');
      }

      // 사용자 생성 (UserService를 통해)
      const savedUser = await this.userService.createUser({
        email,
        password,
        name,
        cookingLevel,
        preferences,
      });

      const userId = String(savedUser._id);

      // JWT 토큰 생성
      const token = this.jwtService.sign({
        sub: userId,
        email: savedUser.email
      });

      const refreshTokenExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d';
      const refreshToken = this.jwtService.sign({ sub: userId }, { expiresIn: refreshTokenExpiry });
      
      // TTL 계산: 30d = 30 * 24 * 60 * 60 = 2,592,000초
      const refreshTokenTtl = this.parseExpiryToSeconds(refreshTokenExpiry);
      await this.cacheService.set(`refresh_token:${userId}`, refreshToken, refreshTokenTtl);

      // 회원가입 시 Redis 세션 저장 (선택적)
      try {
        const sessionData: UserSessionData = {
          id: userId,
          email: savedUser.email,
          name: savedUser.name,
          cookingLevel: savedUser.settings?.cookingLevel,
          preferences: savedUser.settings?.preferences,
          allergies: savedUser.settings?.allergies,
          token,
          loginAt: new Date().toISOString()
        };
        await this.saveUserSession(userId, sessionData);
        this.logger.log(`💾 회원가입 세션 저장 완료: ${email}`);
      } catch (sessionError: unknown) {
        this.logger.warn('회원가입 세션 저장 실패:', sessionError instanceof Error ? sessionError.message : 'Unknown error');
        // 세션 저장 실패해도 회원가입은 성공으로 처리
      }

      this.logger.log(`Registration successful for ${email}`);
      return {
        success: true,
        message: '회원가입 성공',
        token,
        refreshToken, // refreshToken 반환
        user: {
          id: userId,
          email: savedUser.email,
          name: savedUser.name,
          cookingLevel: savedUser.settings?.cookingLevel,
          preferences: savedUser.settings?.preferences,
          allergies: savedUser.settings?.allergies
        }
      };
    } catch (error: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Registration error for ${email}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async login(email: string, password: string) {
    this.logger.log(`Login attempt for email: ${email}`);

    try {
      // 사용자 조회 (UserService를 통해)
      const user = await this.userService.findByEmail(email);
      if (!user) {
        throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다');
      }

      // 비밀번호 확인
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다');
      }

      const userId = String(user._id);

      // 🚫 중복 로그인 방지 - 기존 세션 확인
      const existingSession = await this.getUserSession(userId);
      if (existingSession) {
        // 기존 세션이 있으면 로그아웃 처리 후 새로 로그인
        await this.logout(userId);
        this.logger.log(`기존 세션 발견하여 로그아웃 처리: ${email}`);
      }

      // JWT 토큰 생성
      const token = this.jwtService.sign({
        sub: userId,
        email: user.email
      });

      const refreshTokenExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d';
      const refreshToken = this.jwtService.sign({ sub: userId }, { expiresIn: refreshTokenExpiry });
      
      // TTL 계산: 30d = 30 * 24 * 60 * 60 = 2,592,000초
      const refreshTokenTtl = this.parseExpiryToSeconds(refreshTokenExpiry);
      await this.cacheService.set(`refresh_token:${userId}`, refreshToken, refreshTokenTtl);

      // 💾 로그인 시 Redis 세션 저장
      try {
        const sessionData: UserSessionData = {
          id: userId,
          email: user.email,
          name: user.name,
          allergies: user.settings?.allergies,
          cookingLevel: user.settings?.cookingLevel,
          preferences: user.settings?.preferences,
          token,
          loginAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          isTrialUser: false
        };
        await this.saveUserSession(userId, sessionData);
        this.logger.log(`💾 로그인 세션 저장 완료: ${email}`);
      } catch (sessionError: unknown) {
        this.logger.warn('로그인 세션 저장 실패:', sessionError instanceof Error ? sessionError.message : 'Unknown error');
        // 세션 저장 실패해도 로그인은 성공으로 처리
      }

      this.logger.log(`Login successful for ${email}`);
      return {
        success: true,
        message: '로그인 성공',
        token,
        refreshToken, // refreshToken 반환
        user: {
          id: userId,
          email: user.email,
          name: user.name,
          allergies: user.settings?.allergies,
          cookingLevel: user.settings?.cookingLevel,
          preferences: user.settings?.preferences,
          isTrialUser: false
        }
      };
    } catch (error: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Login error for ${email}:`, error instanceof Error ? error.message : 'Unknown error');
      throw new UnauthorizedException('로그인 처리 중 오류가 발생했습니다');
    }
  }

  /**
   * 체험용 셰프 계정 로그인
   */
  async loginAsTrialChef(): Promise<{
    success: boolean;
    message: string;
    token?: string;
    user?: {
      id: string;
      username: string;
      displayName: string;
      isTrialUser: boolean;
      cookingLevel: string;
      preferences: string[];
      allergies: string[];
    };
  }> {
    this.logger.log('체험용 셰프 로그인 시도');

    try {
      // 세션 ID 생성 (임시)
      const sessionId = `trial_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 사용 가능한 체험용 셰프 계정 할당
      const trialChef = await this.trialChefService.assignTrialChef(sessionId);
      
      if (!trialChef) {
        return {
          success: false,
          message: '현재 사용 가능한 체험용 셰프 계정이 없습니다. 잠시 후 다시 시도해주세요.'
        };
      }

      // JWT 토큰 생성 (체험용 계정은 특별한 payload 사용)
      const token = this.jwtService.sign({
        sub: `trial_${trialChef.username}`,
        username: trialChef.username,
        sessionId: sessionId,
        type: 'trial'
      });

      // 체험용 계정 세션 저장
      try {
        const sessionData: UserSessionData = {
          id: `trial_${trialChef.username}`,
          email: `${trialChef.username}@trial.local`,
          name: trialChef.displayName,
          allergies: trialChef.defaultSettings.allergies,
          cookingLevel: trialChef.defaultSettings.cookingLevel,
          preferences: trialChef.defaultSettings.preferences,
          token,
          loginAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          isTrialUser: true,
          trialUsername: trialChef.username
        };
        
        await this.saveUserSession(`trial_${trialChef.username}`, sessionData);
        this.logger.log(`💾 체험용 셰프 세션 저장 완료: ${trialChef.username}`);
      } catch (sessionError: unknown) {
        this.logger.warn('체험용 셰프 세션 저장 실패:', sessionError instanceof Error ? sessionError.message : 'Unknown error');
      }

      this.logger.log(`✅ 체험용 셰프 로그인 성공: ${trialChef.username}`);
      return {
        success: true,
        message: '체험용 셰프 로그인 성공',
        token,
        user: {
          id: `trial_${trialChef.username}`,
          username: trialChef.username,
          displayName: trialChef.displayName,
          isTrialUser: true,
          cookingLevel: trialChef.defaultSettings.cookingLevel,
          preferences: trialChef.defaultSettings.preferences,
          allergies: trialChef.defaultSettings.allergies
        }
      };
    } catch (error: unknown) {
      this.logger.error('체험용 셰프 로그인 실패:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        message: '체험용 셰프 로그인 처리 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 체험용 셰프 계정 사용 가능 개수 조회
   */
  async getAvailableTrialChefCount(): Promise<number> {
    try {
      return await this.trialChefService.getAvailableChefCount();
    } catch (error) {
      this.logger.error('체험용 셰프 계정 개수 조회 실패:', error);
      return 0;
    }
  }

  /**
   * 체험용 셰프 로그아웃
   */
  async logoutTrialChef(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 체험용 계정 ID에서 username 추출
      const username = userId.replace('trial_', '');
      
      // 세션에서 sessionId 조회
      const session = await this.getUserSession(userId);
      let sessionId: string | undefined;
      
      if (session?.trialUsername) {
        // 캐시에서 sessionId 조회
        const cachedSessionId = await this.cacheService.get<string>(`trial_chef_session_reverse:${username}`);
        sessionId = cachedSessionId || undefined;
      }

      // 체험용 셰프 해제
      if (sessionId) {
        await this.trialChefService.releaseTrialChef(sessionId);
      }

      // 일반 로그아웃 처리 (세션 삭제)
      const result = await this.logout(userId);
      
      this.logger.log(`🚪 체험용 셰프 로그아웃 완료: ${username}`);
      return result;
    } catch (error) {
      this.logger.error(`체험용 셰프 로그아웃 실패 for ${userId}:`, error);
      return {
        success: false,
        message: '체험용 셰프 로그아웃 실패'
      };
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // 1. 리프레시 토큰 검증
      const payload = this.jwtService.verify(refreshToken) as { sub: string; email?: string; iat?: number; exp?: number };
      const userId = payload.sub;
      
      // 2. 저장된 리프레시 토큰과 비교
      const storedRefreshToken = await this.cacheService.get(`refresh_token:${userId}`);
      if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
        throw new UnauthorizedException('유효하지 않거나 만료된 리프레시 토큰');
      }

      // 3. 사용자 정보 확인
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다');
      }

      // 4. 새로운 액세스 토큰과 리프레시 토큰 발급
      const newAccessToken = this.jwtService.sign({ 
        sub: userId, 
        email: user.email 
      });
      
      const refreshTokenExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d';
      const newRefreshToken = this.jwtService.sign({ sub: userId }, { expiresIn: refreshTokenExpiry });
      
      // 5. 기존 리프레시 토큰 무효화 및 새 토큰 저장
      const refreshTokenTtl = this.parseExpiryToSeconds(refreshTokenExpiry);
      await this.cacheService.set(`refresh_token:${userId}`, newRefreshToken, refreshTokenTtl);

      // 6. 세션 정보 업데이트 (존재하는 경우)
      const existingSession = await this.getUserSession(userId);
      if (existingSession) {
        existingSession.token = newAccessToken;
        existingSession.refreshToken = newRefreshToken;
        existingSession.lastActivity = new Date().toISOString();
        await this.saveUserSession(userId, existingSession);
      }

      this.logger.log(`🔄 리프레시 토큰 갱신 완료: ${user.email}`);
      
      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error: unknown) {
      this.logger.error('리프레시 토큰 재발급 실패:', error instanceof Error ? error.message : 'Unknown error');
      throw new UnauthorizedException('리프레시 토큰 재발급 실패');
    }
  }

  // ==================== Redis 세션 관리 ====================

  /**
   * 사용자 세션 저장 (Redis)
   */
  async saveUserSession(userId: string, sessionData: UserSessionData): Promise<void> {
    try {
      const sessionKey = `user_session:${userId}`;
      const sessionTtl = 86400 * 7; // 7일
      
      await this.cacheService.set(sessionKey, JSON.stringify(sessionData), sessionTtl);
      this.logger.log(`💾 세션 저장 완료: ${userId}`);
    } catch (error: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
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
   * 로그아웃 (세션 삭제)
   */
  async logout(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const sessionKey = `user_session:${userId}`;
      const refreshTokenKey = `refresh_token:${userId}`;
      
      // 세션과 리프레시 토큰 동시 삭제
      await Promise.all([
        this.cacheService.del(sessionKey),
        this.cacheService.del(refreshTokenKey)
      ]);
      
      // 채팅 히스토리도 선택적으로 삭제 (옵션)
      const chatKey = `chat_history:${userId}`;
      await this.cacheService.del(chatKey);
      
      this.logger.log(`🚪 로그아웃 완료 (세션 및 리프레시 토큰 삭제): ${userId}`);
      
      return {
        success: true,
        message: '로그아웃 성공'
      };
    } catch (error: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
      this.logger.error(`로그아웃 실패 for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        message: '로그아웃 실패'
      };
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
        await this.logout(userId);
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
        refreshToken: session.refreshToken, // Add refreshToken to returned data
        loginAt: session.loginAt, // Add loginAt to returned data
        lastActivity: session.lastActivity // Add lastActivity to returned data
      };
    } catch (error: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
      this.logger.error(`세션 인증 실패 for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * 토큰 기반 인증 (JWT 전략용)
   */
  async authenticateByToken(token: string): Promise<UserSessionData | null> {
    try {
      const payload = this.jwtService.verify(token) as { sub?: string; userId?: string; email?: string; iat?: number; exp?: number };
      const userId = payload.sub || payload.userId;

      let user: UserSessionData | null = null;
      let dbUser;

      // 먼저 세션에서 확인 (빠르게)
      if (typeof userId === "string") {
        user = await this.authenticateBySession(userId);
      }

      if (!user) {
        // 세션에 없으면 DB에서 확인 (느리게)
        if (typeof userId === "string") {
          dbUser = await this.userService.findById(userId);
        }
        
        if (dbUser) {
          // DB에서 찾았으면 세션 재생성
          user = {
            id: String(dbUser._id),
            email: dbUser.email,
            name: dbUser.name,
            cookingLevel: dbUser.settings?.cookingLevel || '초급',
            preferences: dbUser.settings?.preferences || [],
            allergies: dbUser.settings?.allergies || [],
            token,
            loginAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
          };
          if (typeof userId === "string") {
            await this.saveUserSession(userId, user);
          }
          
          this.logger.log(`🔄 세션 재생성: ${user.email}`);
        }
      }
      
      return user;
    } catch (error: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
      this.logger.warn('토큰 인증 실패:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  // JWT 전략에서 사용하는 사용자 검증 (업데이트됨)
  async validateUserById(userId: string): Promise<UserSessionData | null> {
    try {
      // 먼저 세션에서 확인
      let user: UserSessionData | null = await this.authenticateBySession(userId);
      
      if (!user) {
        // 세션에 없으면 DB에서 확인
        const dbUser = await this.userService.validateUserById(userId);
        if (dbUser) {
          user = {
            id: String(dbUser._id),
            email: dbUser.email,
            name: dbUser.name,
            cookingLevel: dbUser.settings?.cookingLevel || '초급',
            preferences: dbUser.settings?.preferences || [],
            allergies: dbUser.settings?.allergies || [], // settings 필드 참조
            token: '', // Token is not available from validateUserById, set as empty or handle appropriately
            refreshToken: '', // Refresh Token is not available from validateUserById
            loginAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
          };
          // Optionally save this session to cache if it's a valid scenario
          await this.saveUserSession(userId, user);
        }
      }
      
      return user;
    } catch (error: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
      this.logger.error(`Validate user error for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * 리프레시 토큰 무효화 (보안용)
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
   * 토큰 블랙리스트 확인
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const payload = this.jwtService.decode(token) as { jti?: string; exp?: number };
      if (!payload?.jti) {
        return false; // JTI가 없으면 블랙리스트 체크 불가
      }

      const blacklistKey = `blacklist_token:${payload.jti}`;
      const isBlacklisted = await this.cacheService.get(blacklistKey);
      
      return !!isBlacklisted;
    } catch (error: unknown) {
      this.logger.error('토큰 블랙리스트 확인 실패:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * 토큰을 블랙리스트에 추가
   */
  async addTokenToBlacklist(token: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(token) as { jti?: string; exp?: number };
      if (!payload?.jti || !payload?.exp) {
        this.logger.warn('토큰에 JTI 또는 만료시간이 없어 블랙리스트에 추가할 수 없습니다');
        return;
      }

      const blacklistKey = `blacklist_token:${payload.jti}`;
      const ttl = payload.exp - Math.floor(Date.now() / 1000); // 토큰 만료까지 남은 시간
      
      if (ttl > 0) {
        await this.cacheService.set(blacklistKey, 'true', ttl);
        this.logger.log(`🚫 토큰 블랙리스트 추가: ${payload.jti}`);
      }
    } catch (error: unknown) {
      this.logger.error('토큰 블랙리스트 추가 실패:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // ==================== 유틸리티 메서드 ====================

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

  // ==================== 세션 통계 및 관리 ====================

  /**
   * 세션 상태 조회 (WebSocket용)
   */
  async getSessionStatus(userId: string): Promise<{
    hasSession: boolean;
    isExpired: boolean;
    lastActivity?: string;
    loginAt?: string;
    user?: {
      id: string;
      email: string;
      name: string;
      cookingLevel?: string;
      allergies?: string[];
      preferences?: string[];
    };
  }> {
    try {
      const sessionKey = `user_session:${userId}`;
      const sessionData = await this.cacheService.get<UserSessionData>(sessionKey);
      
      if (!sessionData) {
        return {
          hasSession: false,
          isExpired: true
        };
      }
      
      // CacheService가 이미 JSON.parse를 해주므로 추가 파싱 불필요
      let session: UserSessionData;
      
      if (typeof sessionData === 'string') {
        session = JSON.parse(sessionData) as UserSessionData;
      } else {
        session = sessionData as UserSessionData;
      }
      
      // 세션 만료 확인 (로그인 후 7일)
      const loginTime = new Date(session.loginAt).getTime();
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      const isExpired = (now - loginTime) > sevenDays;
      
      if (isExpired) {
        // 만료된 세션 삭제
        await this.cacheService.del(sessionKey);
        this.logger.warn(`세션 만료로 삭제: ${userId}`);
        
        return {
          hasSession: false,
          isExpired: true
        };
      }
      
      // 활성 세션인 경우 마지막 활동 시간 업데이트
      session.lastActivity = new Date().toISOString();
      await this.saveUserSession(userId, session);
      
      return {
        hasSession: true,
        isExpired: false,
        lastActivity: session.lastActivity,
        loginAt: session.loginAt,
        user: {
          id: session.id,
          email: session.email,
          name: session.name,
          cookingLevel: session.cookingLevel,
          allergies: session.allergies,
          preferences: session.preferences
        }
      };
      
    } catch (error: unknown) {
      this.logger.error(`세션 상태 조회 실패 for ${userId}:`, error instanceof Error ? error.message : String(error));
      return {
        hasSession: false,
        isExpired: true
      };
    }
  }

  /**
   * 활성 세션 통계
   */
  async getActiveSessionsCount(): Promise<number> {
    try {
      // Redis가 활성화되어 있고 Redis 클라이언트가 사용 가능할 때만 실제 Redis 명령 실행
      if (this.cacheService.isRedisEnabled() && this.cacheService.getRedisClient()) {
        const redisClient = this.cacheService.getRedisClient();
        if (!redisClient) {
          this.logger.warn('Redis 클라이언트를 가져올 수 없습니다.');
          return 0;
        }

        let count = 0;
        let cursor = '0';

        do {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            const reply = await (redisClient as any).scan(cursor, 'MATCH', 'user_session:*', 'COUNT', 100) as [string, string[]];
            cursor = reply[0];
            count += reply[1].length;
          } catch (scanError) {
            this.logger.warn('Redis scan 실패:', scanError instanceof Error ? scanError.message : 'Unknown error');
            break;
          }
        } while (cursor !== '0');

        this.logger.log(`📊 Redis 활성 세션 수: ${count}`);
        return count;
      } else {
        this.logger.warn('Redis가 활성화되지 않아 활성 세션 수를 가져올 수 없습니다.');
        return 0;
      }
    } catch (error: unknown) {
      this.logger.error('활성 세션 수 조회 실패:', error instanceof Error ? error.message : 'Unknown error');
      return 0;
    }
  }

  /**
   * 만료된 세션 정리
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      if (this.cacheService.isRedisEnabled() && this.cacheService.getRedisClient()) {
        const redisClient = this.cacheService.getRedisClient();
        if (!redisClient) {
          this.logger.warn('Redis 클라이언트를 가져올 수 없습니다.');
          return;
        }

        let cursor = '0';
        const sessionKeyPattern = 'user_session:*';

        do {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            const reply = await (redisClient as any).scan(cursor, 'MATCH', sessionKeyPattern, 'COUNT', 100) as [string, string[]];
            cursor = reply[0];
            const keys = reply[1];

            if (keys.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
              await (redisClient as any).del(...keys);
              this.logger.log(`🧹 Redis에서 ${keys.length}개의 만료 세션 키 삭제`);
            }
          } catch (scanError) {
            this.logger.warn('Redis scan/del 실패:', scanError instanceof Error ? scanError.message : 'Unknown error');
            break;
          }
        } while (cursor !== '0');

        this.logger.log('🧹 Redis 만료 세션 정리 완료');
      } else {
        this.logger.warn('Redis가 활성화되지 않아 만료 세션 정리를 수행할 수 없습니다.');
      }
    } catch (error: unknown) {
      this.logger.error('만료 세션 정리 실패:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}