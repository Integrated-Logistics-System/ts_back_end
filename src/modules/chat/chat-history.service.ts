import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

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

  constructor(private readonly redisService: RedisService) {}

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

      const key = `${this.CHAT_HISTORY_KEY}${userId}`;
      
      // Redis에 대화 저장 (리스트로 관리)
      await this.redisService.lpush(key, JSON.stringify(chatMessage));
      
      // 최대 길이 유지
      await this.redisService.ltrim(key, 0, this.MAX_HISTORY_LENGTH - 1);
      
      // TTL 설정
      await this.redisService.expire(key, this.CONTEXT_TTL);

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
      const key = `${this.CHAT_HISTORY_KEY}${userId}`;
      const messages = await this.redisService.lrange(key, 0, limit - 1);
      
      return messages
        .map(msg => {
          try {
            return JSON.parse(msg) as ChatMessage;
          } catch {
            return null;
          }
        })
        .filter((msg): msg is ChatMessage => msg !== null)
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      this.logger.error('Failed to get chat history:', error);
      return [];
    }
  }

  async getRecentRecipeQueries(userId: string, limit: number = 5): Promise<ChatMessage[]> {
    try {
      const history = await this.getChatHistory(userId, 20);
      return history
        .filter(msg => msg.type === 'recipe_query' && msg.metadata?.hasRecipe)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get recent recipe queries:', error);
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

      await this.redisService.set(
        contextKey,
        JSON.stringify(existingContext),
        this.CONTEXT_TTL
      );

    } catch (error) {
      this.logger.error('Failed to update user context:', error);
    }
  }

  async getUserContext(userId: string): Promise<ConversationContext> {
    try {
      const contextKey = `${this.USER_CONTEXT_KEY}${userId}`;
      const contextData = await this.redisService.get(contextKey);
      
      if (contextData) {
        return JSON.parse(contextData) as ConversationContext;
      }
      
      // 기본 컨텍스트 반환
      return this.getDefaultContext();
    } catch (error) {
      this.logger.error('Failed to get user context:', error);
      return this.getDefaultContext();
    }
  }

  // ================== RAG 컨텍스트 생성 ==================

  async buildRAGContext(userId: string, currentQuery: string): Promise<string> {
    try {
      const context = await this.getUserContext(userId);
      const recentQueries = await this.getRecentRecipeQueries(userId, 3);
      
      let ragContext = '';

      // 사용자 선호도 추가
      if (context.userPreferences.allergies.length) {
        ragContext += `사용자 알레르기: ${context.userPreferences.allergies.join(', ')}\n`;
      }

      // 최근 레시피 대화 추가
      if (recentQueries.length) {
        ragContext += '\n최근 레시피 대화:\n';
        recentQueries.forEach((query, index) => {
          ragContext += `${index + 1}. 질문: "${query.message}"\n`;
          ragContext += `   답변: "${query.response.substring(0, 100)}..."\n`;
        });
      }

      // 대화 패턴 분석
      const conversationPattern = this.analyzeConversationPattern(context.recentMessages);
      if (conversationPattern) {
        ragContext += `\n대화 패턴: ${conversationPattern}\n`;
      }

      ragContext += `\n현재 질문: "${currentQuery}"\n`;
      ragContext += '위 정보를 바탕으로 개인화된 레시피 답변을 제공해주세요.';

      return ragContext;
    } catch (error) {
      this.logger.error('Failed to build RAG context:', error);
      return currentQuery;
    }
  }

  // ================== 분석 도구 ==================

  private analyzeConversationPattern(recentMessages: ChatMessage[]): string {
    if (recentMessages.length < 2) return '';

    const recipeQueries = recentMessages.filter(msg => msg.type === 'recipe_query');
    
    if (recipeQueries.length >= 2) {
      const keywords = recipeQueries.flatMap(msg => 
        this.extractKeywords(msg.message)
      );
      
      const frequentKeywords = this.getFrequentItems(keywords, 2);
      
      if (frequentKeywords.length) {
        return `자주 물어보는 요리: ${frequentKeywords.join(', ')}`;
      }
    }

    return '';
  }

  private extractKeywords(message: string): string[] {
    const recipeKeywords = [
      '김치찌개', '된장찌개', '비빔밥', '볶음밥', '파스타', '스테이크',
      '치킨', '돼지고기', '소고기', '생선', '야채', '샐러드',
      '국', '탕', '찌개', '볶음', '구이', '무침'
    ];
    
    return recipeKeywords.filter(keyword => 
      message.includes(keyword)
    );
  }

  private getFrequentItems(items: string[], minCount: number): string[] {
    const counts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .filter(([, count]) => count >= minCount)
      .map(([item]) => item);
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
      await this.redisService.del(`${this.CHAT_HISTORY_KEY}${userId}`);
      await this.redisService.del(`${this.USER_CONTEXT_KEY}${userId}`);
      this.logger.log(`🗑️ Chat history cleared for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to clear chat history:', error);
    }
  }

  async getChatStats(userId: string): Promise<{
    totalMessages: number;
    recipeQueries: number;
    avgResponseTime: number;
    mostAskedTopics: string[];
  }> {
    try {
      const history = await this.getChatHistory(userId, 50);
      
      const recipeQueries = history.filter(msg => msg.type === 'recipe_query');
      const avgResponseTime = history
        .filter(msg => msg.metadata?.processingTime)
        .reduce((acc, msg) => acc + (msg.metadata?.processingTime || 0), 0) / history.length;

      const topics = history.flatMap(msg => this.extractKeywords(msg.message));
      const mostAskedTopics = this.getFrequentItems(topics, 1).slice(0, 5);

      return {
        totalMessages: history.length,
        recipeQueries: recipeQueries.length,
        avgResponseTime: Math.round(avgResponseTime),
        mostAskedTopics,
      };
    } catch (error) {
      this.logger.error('Failed to get chat stats:', error);
      return {
        totalMessages: 0,
        recipeQueries: 0,
        avgResponseTime: 0,
        mostAskedTopics: [],
      };
    }
  }
}