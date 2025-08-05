import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  timestamp: number;
  type: 'recipe_query' | 'general_chat' | 'detail_request';
  metadata?: {
    allergies?: string[];
    recipeId?: string;
    hasRecipe?: boolean;
    processingTime?: number;
    intent?: string; // Add intent property
  };
}

export interface ConversationContext {
  recentMessages: ChatMessage[];
  userPreferences: {
    allergies: string[];
    favoriteIngredients: string[];
    cookingStyle: string[];
  };
  recipeHistory: {
    requested: string[];
    generated: string[];
    bookmarked: string[];
  };
}

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);
  private readonly CHAT_HISTORY_KEY = 'chat:history:';
  private readonly USER_CONTEXT_KEY = 'chat:context:';
  private readonly MAX_HISTORY_LENGTH = 50;
  private readonly CONTEXT_TTL = 7 * 24 * 60 * 60; // 7일

  constructor(private readonly cacheService: CacheService) {}

  // ================== 대화 저장 ==================

  async saveChatMessage(
    userId: string,
    userMessage: string,
    aiResponse: string,
    type: ChatMessage['type'] = 'general_chat',
    metadata?: ChatMessage['metadata']
  ): Promise<void> {
    try {
      const chatMessage: ChatMessage = {
        id: this.generateMessageId(),
        userId,
        message: userMessage,
        response: aiResponse,
        timestamp: Date.now(),
        type,
        metadata,
      };

      // CacheService의 addChatMessage 메서드 사용
      await this.cacheService.addChatMessage(userId, JSON.stringify(chatMessage));

      this.logger.log(`💬 Chat message saved for user ${userId}: ${type}`);
      
      // 사용자 컨텍스트 업데이트
      await this.updateUserContext(userId, chatMessage);
      
    } catch (error) {
      this.logger.error('Failed to save chat message:', error);
    }
  }

  // ================== 대화 조회 (RAG용) ==================

  async getChatHistory(userId: string, limit: number = 10): Promise<ChatMessage[]> {
    try {
      // CacheService의 getChatHistory 메서드 사용
      const messages = await this.cacheService.getChatHistory(userId, limit);
      
      return messages
        .map(msg => JSON.parse(msg) as ChatMessage)
        .filter(msg => msg !== null)
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      this.logger.error('Failed to get chat history:', error);
      return [];
    }
  }


  // ================== 사용자 컨텍스트 관리 ==================

  async updateUserContext(userId: string, chatMessage: ChatMessage): Promise<void> {
    try {
      const contextKey = `${this.USER_CONTEXT_KEY}${userId}`;
      const existingContext = await this.getUserContext(userId);
      
      // 알레르기 정보 추출 및 업데이트
      if (chatMessage.metadata?.allergies?.length) {
        existingContext.userPreferences.allergies = [
          ...new Set([
            ...existingContext.userPreferences.allergies,
            ...chatMessage.metadata.allergies
          ])
        ];
      }

      // 레시피 히스토리 업데이트
      if (chatMessage.type === 'recipe_query') {
        existingContext.recipeHistory.requested.push(chatMessage.message);
        
        if (chatMessage.metadata?.recipeId) {
          existingContext.recipeHistory.generated.push(chatMessage.metadata.recipeId);
        }
      }

      // 최근 메시지 업데이트
      existingContext.recentMessages = [
        chatMessage,
        ...existingContext.recentMessages.slice(0, 9)
      ];

      await this.cacheService.set(
        contextKey,
        existingContext,
        this.CONTEXT_TTL
      );

    } catch (error) {
      this.logger.error('Failed to update user context:', error);
    }
  }

  async getUserContext(userId: string): Promise<ConversationContext> {
    try {
      const contextKey = `${this.USER_CONTEXT_KEY}${userId}`;
      const contextData = await this.cacheService.get<ConversationContext>(contextKey);
      
      if (contextData) {
        return contextData;
      }
      
      // 기본 컨텍스트 반환
      return this.getDefaultContext();
    } catch (error) {
      this.logger.error('Failed to get user context:', error);
      return this.getDefaultContext();
    }
  }



  private getDefaultContext(): ConversationContext {
    return {
      recentMessages: [],
      userPreferences: {
        allergies: [],
        favoriteIngredients: [],
        cookingStyle: [],
      },
      recipeHistory: {
        requested: [],
        generated: [],
        bookmarked: [],
      },
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ================== 관리 기능 ==================

  async clearChatHistory(userId: string): Promise<void> {
    try {
      // CacheService의 clearChatHistory 메서드 사용
      await this.cacheService.clearChatHistory(userId);
      await this.cacheService.delete(`${this.USER_CONTEXT_KEY}${userId}`);
      this.logger.log(`🗑️ Chat history cleared for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to clear chat history:', error);
    }
  }

}