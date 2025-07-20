import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { CacheService } from '../../cache/cache.service';
import {
  PersonalizedContext,
  SessionContext,
  UserPreferences,
  TimeContext,
  ChatMessage,
} from '../interfaces/chat.interface';

@Injectable()
export class ContextManager {
  private readonly logger = new Logger(ContextManager.name);
  private readonly contextTtl = 24 * 60 * 60; // 24시간

  constructor(
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 사용자 컨텍스트 로드
   */
  async loadUserContext(userId: string): Promise<PersonalizedContext> {
    try {
      // 캐시에서 기존 컨텍스트 확인
      const cachedContext = await this.getCachedContext(userId);
      if (cachedContext) {
        return this.refreshContext(cachedContext);
      }

      // 새 컨텍스트 생성
      return await this.createNewContext(userId);
    } catch (error) {
      this.logger.error('Failed to load user context:', error);
      return this.getDefaultContext(userId);
    }
  }

  /**
   * 컨텍스트 업데이트
   */
  async updateContext(
    userId: string, 
    updates: Partial<PersonalizedContext>
  ): Promise<PersonalizedContext> {
    try {
      const currentContext = await this.loadUserContext(userId);
      const updatedContext = { ...currentContext, ...updates };
      
      await this.saveContext(updatedContext);
      
      this.logger.debug(`Context updated for user: ${userId}`);
      return updatedContext;
    } catch (error) {
      this.logger.error('Failed to update context:', error);
      throw error;
    }
  }

  /**
   * 세션 컨텍스트 초기화
   */
  async initializeSession(userId: string): Promise<SessionContext> {
    try {
      const sessionContext: SessionContext = {
        sessionId: this.generateSessionId(),
        startTime: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        recipeRequests: 0,
      };

      await this.updateContext(userId, { currentSession: sessionContext });
      
      this.logger.log(`New session initialized for user: ${userId}`);
      return sessionContext;
    } catch (error) {
      this.logger.error('Failed to initialize session:', error);
      throw error;
    }
  }

  /**
   * 세션 활동 업데이트
   */
  async updateSessionActivity(
    userId: string,
    messageType?: 'general' | 'recipe_request' | 'detail_request'
  ): Promise<void> {
    try {
      const context = await this.loadUserContext(userId);
      
      if (context.currentSession) {
        const updatedSession: SessionContext = {
          ...context.currentSession,
          lastActivity: new Date(),
          messageCount: context.currentSession.messageCount + 1,
          recipeRequests: messageType === 'recipe_request' 
            ? context.currentSession.recipeRequests + 1 
            : context.currentSession.recipeRequests,
        };

        await this.updateContext(userId, { currentSession: updatedSession });
      }
    } catch (error) {
      this.logger.error('Failed to update session activity:', error);
    }
  }

  /**
   * 대화 기록 컨텍스트 추가
   */
  async addMessageToContext(
    userId: string, 
    message: ChatMessage,
    maxHistorySize: number = 50
  ): Promise<void> {
    try {
      const context = await this.loadUserContext(userId);
      
      const conversationHistory = context.conversationHistory || [];
      conversationHistory.push(message);
      
      // 최대 기록 수 제한
      if (conversationHistory.length > maxHistorySize) {
        conversationHistory.splice(0, conversationHistory.length - maxHistorySize);
      }

      await this.updateContext(userId, { conversationHistory });
    } catch (error) {
      this.logger.error('Failed to add message to context:', error);
    }
  }

  /**
   * 사용자 선호도 업데이트
   */
  async updateUserPreferences(
    userId: string, 
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    try {
      const context = await this.loadUserContext(userId);
      
      // 기존 선호도와 병합
      const updatedPreferences = {
        ...context.preferences,
        ...preferences,
      };

      await this.updateContext(userId, { preferences: updatedPreferences });
      
      // 사용자 서비스에도 업데이트 (영구 저장)
      if (this.userService.updateUserPreferences && preferences.preferredCuisines) {
        await this.userService.updateUserPreferences(userId, preferences.preferredCuisines);
      }
      
      this.logger.debug(`User preferences updated: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  /**
   * 컨텍스트 정리 (세션 종료)
   */
  async cleanupContext(userId: string): Promise<void> {
    try {
      const context = await this.loadUserContext(userId);
      
      // 세션 정보만 제거하고 사용자 정보는 유지
      const cleanedContext: PersonalizedContext = {
        ...context,
        currentSession: undefined,
        conversationHistory: [], // 대화 기록은 별도 저장소로 이관
      };

      await this.saveContext(cleanedContext);
      
      this.logger.log(`Context cleaned up for user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to cleanup context:', error);
    }
  }

  /**
   * 시간 기반 컨텍스트 생성
   */
  createTimeContext(): TimeContext {
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth();
    const dayOfWeek = now.getDay();

    const timeOfDay = 
      hour < 6 ? 'night' :
      hour < 12 ? 'morning' :
      hour < 18 ? 'afternoon' : 'evening';

    const mealTime = 
      hour >= 6 && hour < 10 ? 'breakfast' :
      hour >= 11 && hour < 15 ? 'lunch' :
      hour >= 17 && hour < 21 ? 'dinner' :
      undefined;

    const season = 
      month >= 2 && month <= 4 ? 'spring' :
      month >= 5 && month <= 7 ? 'summer' :
      month >= 8 && month <= 10 ? 'fall' : 'winter';

    return {
      currentTime: now,
      timeOfDay,
      mealTime,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      season,
    };
  }

  /**
   * RAG 사용 여부 결정
   */
  shouldUseRAG(message: string, context: PersonalizedContext): boolean {
    try {
      // 레시피 관련 키워드 체크
      const recipeKeywords = [
        '요리', '레시피', '만들기', '조리법', '재료', '음식',
        'recipe', 'cook', 'food', 'ingredient', 'dish'
      ];

      const hasRecipeKeyword = recipeKeywords.some(keyword =>
        message.toLowerCase().includes(keyword.toLowerCase())
      );

      // 요청 길이 체크 (너무 짧으면 RAG 사용 안함)
      const isComplexQuery = message.length > 10;

      // 사용자 컨텍스트 체크
      const hasUserContext = context.allergies.length > 0 || 
                            context.preferences.length > 0;

      // 최근 대화에서 레시피 언급 체크
      const hasRecentRecipeContext = this.hasRecentRecipeContext(context);

      return (hasRecipeKeyword && isComplexQuery) || 
             (hasUserContext && hasRecipeKeyword) ||
             hasRecentRecipeContext;
    } catch (error) {
      this.logger.error('Failed to determine RAG usage:', error);
      return false;
    }
  }

  // ==================== Private Helper Methods ====================

  private async getCachedContext(userId: string): Promise<PersonalizedContext | null> {
    try {
      const key = this.getContextKey(userId);
      return await this.cacheService.get<PersonalizedContext>(key);
    } catch (error) {
      this.logger.error('Failed to get cached context:', error);
      return null;
    }
  }

  private async saveContext(context: PersonalizedContext): Promise<void> {
    try {
      const key = this.getContextKey(context.userId);
      await this.cacheService.set(key, context, this.contextTtl);
    } catch (error) {
      this.logger.error('Failed to save context:', error);
      throw error;
    }
  }

  private async createNewContext(userId: string): Promise<PersonalizedContext> {
    try {
      // 사용자 정보 조회
      const userInfo = await this.userService.findById(userId);
      
      if (!userInfo) {
        this.logger.warn(`User not found: ${userId}`);
        return this.getDefaultContext(userId);
      }

      const context: PersonalizedContext = {
        userId,
        userName: userInfo.name || userInfo.email || 'User',
        cookingLevel: userInfo.settings?.cookingLevel || 'intermediate',
        allergies: userInfo.settings?.allergies || [],
        preferences: userInfo.settings?.preferences || [],
        conversationHistory: [],
        currentSession: await this.initializeSession(userId),
      };

      await this.saveContext(context);
      
      this.logger.log(`New context created for user: ${userId}`);
      return context;
    } catch (error) {
      this.logger.error('Failed to create new context:', error);
      return this.getDefaultContext(userId);
    }
  }

  private refreshContext(context: PersonalizedContext): PersonalizedContext {
    // 세션 정보 갱신
    if (context.currentSession) {
      context.currentSession.lastActivity = new Date();
    }

    return context;
  }

  private getDefaultContext(userId: string): PersonalizedContext {
    return {
      userId,
      userName: 'User',
      cookingLevel: 'intermediate',
      allergies: [],
      preferences: [],
      conversationHistory: [],
    };
  }

  private hasRecentRecipeContext(context: PersonalizedContext): boolean {
    if (!context.conversationHistory?.length) return false;

    const recentMessages = context.conversationHistory.slice(-5);
    return recentMessages.some(msg => 
      msg.metadata?.messageType === 'recipe_request' ||
      msg.metadata?.messageType === 'detail_request' ||
      msg.metadata?.recipeId
    );
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getContextKey(userId: string): string {
    return `user_context:${userId}`;
  }
}