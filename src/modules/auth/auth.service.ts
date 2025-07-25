import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';

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
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
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
      const token = this.tokenService.generateAccessToken(userId, savedUser.email);
      const refreshToken = await this.tokenService.generateAndStoreRefreshToken(userId);

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
          refreshToken,
          loginAt: new Date().toISOString()
        };
        await this.sessionService.saveUserSession(userId, sessionData);
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
        refreshToken,
        user: {
          id: userId,
          email: savedUser.email,
          name: savedUser.name,
          cookingLevel: savedUser.settings?.cookingLevel,
          preferences: savedUser.settings?.preferences,
          allergies: savedUser.settings?.allergies
        }
      };
    } catch (error: unknown) {
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
      const existingSession = await this.sessionService.getUserSession(userId);
      if (existingSession) {
        // 기존 세션이 있으면 로그아웃 처리 후 새로 로그인
        await this.logout(userId);
        this.logger.log(`기존 세션 발견하여 로그아웃 처리: ${email}`);
      }

      // JWT 토큰 생성
      const token = this.tokenService.generateAccessToken(userId, user.email);
      const refreshToken = await this.tokenService.generateAndStoreRefreshToken(userId);

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
          refreshToken,
          loginAt: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        };
        await this.sessionService.saveUserSession(userId, sessionData);
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
        refreshToken,
        user: {
          id: userId,
          email: user.email,
          name: user.name,
          allergies: user.settings?.allergies,
          cookingLevel: user.settings?.cookingLevel,
          preferences: user.settings?.preferences
        }
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Login error for ${email}:`, error instanceof Error ? error.message : 'Unknown error');
      throw new UnauthorizedException('로그인 처리 중 오류가 발생했습니다');
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // 1. 리프레시 토큰 검증
      const userId = await this.tokenService.validateRefreshToken(refreshToken);
      if (!userId) {
        throw new UnauthorizedException('유효하지 않거나 만료된 리프레시 토큰');
      }

      // 2. 사용자 정보 확인
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다');
      }

      // 3. 새로운 토큰들 발급
      const newAccessToken = this.tokenService.generateAccessToken(userId, user.email);
      const newRefreshToken = await this.tokenService.generateAndStoreRefreshToken(userId);

      // 4. 세션 정보 업데이트 (존재하는 경우)
      await this.sessionService.updateSession(userId, {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        lastActivity: new Date().toISOString()
      });

      this.logger.log(`🔄 리프레시 토큰 갱신 완료: ${user.email}`);
      
      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error: unknown) {
      this.logger.error('리프레시 토큰 재발급 실패:', error instanceof Error ? error.message : 'Unknown error');
      throw new UnauthorizedException('리프레시 토큰 재발급 실패');
    }
  }

  /**
   * 로그아웃 (세션 삭제)
   */
  async logout(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 세션과 모든 토큰 삭제
      await Promise.all([
        this.sessionService.clearSession(userId),
        this.tokenService.clearAllTokens(userId)
      ]);
      
      this.logger.log(`🚪 로그아웃 완료: ${userId}`);
      
      return {
        success: true,
        message: '로그아웃 성공'
      };
    } catch (error: unknown) {
      this.logger.error(`로그아웃 실패 for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        message: '로그아웃 실패'
      };
    }
  }

  // ==================== 위임된 메서드들 ====================

  async authenticateBySession(userId: string): Promise<UserSessionData | null> {
    return this.sessionService.authenticateBySession(userId);
  }

  async getUserSession(userId: string): Promise<UserSessionData | null> {
    return this.sessionService.getUserSession(userId);
  }

  async authenticateByToken(token: string): Promise<UserSessionData | null> {
    try {
      const userId = this.tokenService.extractUserIdFromToken(token);
      if (!userId) return null;

      let user = await this.sessionService.authenticateBySession(userId);

      if (!user) {
        // 세션에 없으면 DB에서 확인 후 세션 재생성
        const dbUser = await this.userService.findById(userId);
        
        if (dbUser) {
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
          await this.sessionService.saveUserSession(userId, user);
          this.logger.log(`🔄 세션 재생성: ${user.email}`);
        }
      }
      
      return user;
    } catch (error: unknown) {
      this.logger.warn('토큰 인증 실패:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  async validateUserById(userId: string): Promise<UserSessionData | null> {
    try {
      let user = await this.sessionService.authenticateBySession(userId);
      
      if (!user) {
        const dbUser = await this.userService.validateUserById(userId);
        if (dbUser) {
          user = {
            id: String(dbUser._id),
            email: dbUser.email,
            name: dbUser.name,
            cookingLevel: dbUser.settings?.cookingLevel || '초급',
            preferences: dbUser.settings?.preferences || [],
            allergies: dbUser.settings?.allergies || [],
            token: '',
            refreshToken: '',
            loginAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
          };
          await this.sessionService.saveUserSession(userId, user);
        }
      }
      
      return user;
    } catch (error: unknown) {
      this.logger.error(`Validate user error for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  async revokeRefreshToken(userId: string) {
    return this.tokenService.revokeRefreshToken(userId);
  }
}