// src/modules/websocket/personal-chat.service.ts (Minimal working version)
import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { UserService } from '../user/user.service';
import { CacheService } from '../cache/cache.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { RAGRecipeRequest } from '../../shared/interfaces/langgraph.interface';
import { EnhancedIntentAnalyzer, EnhancedUserIntent } from './processors/enhanced-intent-analyzer.service';

export interface ChainStatusResponse {
  aiService: {
    isConnected: boolean;
    provider: string;
    model: string;
  };
  chat: {
    messageCount: number;
    hasHistory: boolean;
    lastMessageTime: string | null;
  };
  user: {
    name: string;
    cookingLevel: string;
    allergiesCount: number;
    preferencesCount: number;
  };
  rag: {
    enabled: boolean;
    elasticsearchConnected: boolean;
    recipesIndexed: boolean;
  };
  timestamp: string;
  error?: string;
}

export interface UserChatStatsResponse {
  totalMessages: number;
  userMessages: number;
  aiMessages: number;
  recipeRequests: number;
  detailRequests: number;
  error?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  messageType?: 'general' | 'recipe' | 'detail';
}

@Injectable()
export class PersonalChatService {
  private readonly logger = new Logger(PersonalChatService.name);
  private readonly MAX_HISTORY_SIZE = 20;
  private readonly CACHE_TTL = 86400 * 7; // 7일

  constructor(
    private readonly aiService: AiService,
    private readonly cacheService: CacheService,
    private readonly userService: UserService,
    private readonly langgraphService: LangGraphService,
    private readonly enhancedIntentAnalyzer: EnhancedIntentAnalyzer,
  ) {
    this.logger.log('🚀 PersonalChatService initialized with Enhanced Intent Detection');
  }

  // ==================== Main Chat Processing ====================

  async processPersonalizedChat(userId: string, message: string): Promise<AsyncIterable<string>> {
    this.logger.log(`💬 Processing enhanced context-aware chat for user: ${userId}`);
    
    try {
      // Get user context
      const userProfile = await this.userService.getProfile(userId);
      const conversationHistory = await this.getChatHistory(userId);
      
      // Build enhanced context
      const context = {
        userId,
        userName: userProfile.name,
        cookingLevel: userProfile.cookingLevel,
        allergies: userProfile.allergies,
        preferences: userProfile.preferences,
        conversationHistory: conversationHistory.map((msg: ChatMessage) => ({
          id: `${msg.timestamp}`,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        })),
        currentSession: {
          sessionId: userId,
          startTime: new Date(),
          lastActivity: new Date(),
          messageCount: conversationHistory.length,
          recipeRequests: 0,
        },
      };

      // Perform enhanced intent analysis
      const analysisResult = await this.enhancedIntentAnalyzer.analyzeEnhancedConversationContext(message, context);
      const intent = analysisResult.userIntent as EnhancedUserIntent;
      
      this.logger.log(`🧠 Intent Analysis Result:`, {
        primaryIntent: intent.type,
        confidence: intent.confidence,
        entities: intent.entities?.length || 0,
        sentiment: intent.sentiment,
        urgency: intent.urgency,
      });

      // Route based on intent
      return this.routeBasedOnIntent(userId, message, intent);
      
    } catch (error) {
      this.logger.error('Enhanced intent analysis failed, falling back to simple processing:', error);
      return this.processSimpleChat(userId, message);
    }
  }

  // ==================== Intent-based Routing ====================

  private async routeBasedOnIntent(userId: string, message: string, intent: EnhancedUserIntent): Promise<AsyncIterable<string>> {
    switch (intent.type) {
      case 'recipe_search':
        return this.processRecipeSearch(userId, message, intent);
      
      case 'recipe_detail':
        return this.processRecipeDetail(userId, message, intent);
      
      case 'ingredient_substitute':
        return this.processIngredientSubstitute(userId, message, intent);
      
      case 'nutritional_info':
        return this.processNutritionalInfo(userId, message, intent);
      
      case 'cooking_advice':
        return this.processCookingAdvice(userId, message, intent);
      
      default:
        return this.processSimpleChat(userId, message);
    }
  }

  // ==================== Processing Methods ====================

  private async processRecipeSearch(userId: string, message: string, intent: EnhancedUserIntent): Promise<AsyncIterable<string>> {
    try {
      const userProfile = await this.userService.getProfile(userId);
      const userAllergies = [
        ...(userProfile.allergies || []),
        ...intent.entities?.filter(e => e.type === 'allergen').map(e => e.value) || []
      ];

      return this.transformWebSocketToString(
        this.langgraphService.streamRecipeWorkflowForWebSocket(message, userAllergies, userId)
      );
    } catch (error) {
      this.logger.error('Recipe search processing failed:', error);
      return this.processSimpleChat(userId, message);
    }
  }

  private async processRecipeDetail(userId: string, message: string, intent: EnhancedUserIntent): Promise<AsyncIterable<string>> {
    const targetRecipe = intent.entities?.find(e => e.type === 'recipe')?.value;
    if (!targetRecipe) {
      return this.processSimpleChat(userId, message);
    }

    try {
      const detailRequest: RAGRecipeRequest = {
        query: `${targetRecipe}의 상세한 만드는 법과 조리 과정을 단계별로 알려주세요. ${message}`,
        userAllergies: intent.entities?.filter(e => e.type === 'ingredient').map(e => e.value) || [],
        preferences: intent.entities?.filter(e => e.type === 'cuisine_type').map(e => e.value) || [],
      };

      return this.transformWebSocketToString(
        this.langgraphService.streamRAGForWebSocket(detailRequest, userId)
      );
    } catch (error) {
      this.logger.error('Recipe detail processing failed:', error);
      return this.processSimpleChat(userId, message);
    }
  }

  private async processIngredientSubstitute(userId: string, message: string, intent: EnhancedUserIntent): Promise<AsyncIterable<string>> {
    try {
      const ragRequest: RAGRecipeRequest = {
        query: `${message} - 재료 대체에 대한 조언을 제공해주세요.`,
        userAllergies: intent.entities?.filter(e => e.type === 'allergen').map(e => e.value) || [],
      };

      return this.transformWebSocketToString(
        this.langgraphService.streamRAGForWebSocket(ragRequest, userId)
      );
    } catch (error) {
      this.logger.error('Ingredient substitute processing failed:', error);
      return this.processSimpleChat(userId, message);
    }
  }

  private async processNutritionalInfo(userId: string, message: string, intent: EnhancedUserIntent): Promise<AsyncIterable<string>> {
    try {
      const ragRequest: RAGRecipeRequest = {
        query: `${message} - 영양 정보와 건강한 요리법에 대해 알려주세요.`,
        userAllergies: intent.entities?.filter(e => e.type === 'allergen').map(e => e.value) || [],
        preferences: ['건강한', '영양가'],
      };

      return this.transformWebSocketToString(
        this.langgraphService.streamRAGForWebSocket(ragRequest, userId)
      );
    } catch (error) {
      this.logger.error('Nutritional info processing failed:', error);
      return this.processSimpleChat(userId, message);
    }
  }

  private async processCookingAdvice(userId: string, message: string, intent: EnhancedUserIntent): Promise<AsyncIterable<string>> {
    try {
      const ragRequest: RAGRecipeRequest = {
        query: `${message} - 요리 팁과 조언을 제공해주세요.`,
        userAllergies: intent.entities?.filter(e => e.type === 'allergen').map(e => e.value) || [],
      };

      return this.transformWebSocketToString(
        this.langgraphService.streamRAGForWebSocket(ragRequest, userId)
      );
    } catch (error) {
      this.logger.error('Cooking advice processing failed:', error);
      return this.processSimpleChat(userId, message);
    }
  }

  private async processSimpleChat(userId: string, message: string): Promise<AsyncIterable<string>> {
    try {
      const userProfile = await this.userService.getProfile(userId);
      const contextPrompt = `사용자 ${userProfile.name}님 (요리실력: ${userProfile.cookingLevel})의 질문: ${message}`;
      
      return this.transformAiStreamToString(this.aiService.streamText(contextPrompt));
    } catch (error) {
      this.logger.error('Simple chat processing failed:', error);
      return this.transformAiStreamToString(this.aiService.streamText(message));
    }
  }

  // ==================== Helper Methods ====================

  private async* transformWebSocketToString(webSocketStream: AsyncIterable<any>): AsyncIterable<string> {
    try {
      for await (const chunk of webSocketStream) {
        if (typeof chunk === 'string') {
          yield chunk;
        } else if (chunk && typeof chunk.content === 'string') {
          yield chunk.content;
        } else if (chunk && chunk.toString) {
          yield chunk.toString();
        }
      }
    } catch (error) {
      this.logger.error('WebSocket stream transformation failed:', error);
      yield `죄송합니다. 응답 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
    }
  }

  private async* transformAiStreamToString(aiStream: AsyncIterable<any>): AsyncIterable<string> {
    try {
      for await (const chunk of aiStream) {
        if (typeof chunk === 'string') {
          yield chunk;
        } else if (chunk && typeof chunk.content === 'string') {
          yield chunk.content;
        } else if (chunk && typeof chunk.text === 'string') {
          yield chunk.text;
        } else if (chunk && chunk.toString) {
          yield chunk.toString();
        }
      }
    } catch (error) {
      this.logger.error('AI stream transformation failed:', error);
      yield `죄송합니다. 응답 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
    }
  }

  // ==================== Data Access Methods ====================

  async getChatHistory(userId: string): Promise<ChatMessage[]> {
    try {
      const cacheKey = `chat_history:${userId}`;
      const cachedHistory = await this.cacheService.get(cacheKey);
      
      if (cachedHistory && typeof cachedHistory === 'string') {
        const history = JSON.parse(cachedHistory) as ChatMessage[];
        return Array.isArray(history) ? history : [];
      }
      
      return [];
    } catch (error) {
      this.logger.error('Failed to get chat history:', error);
      return [];
    }
  }

  // ==================== Status Methods ====================

  async getChainStatus(userId: string): Promise<ChainStatusResponse> {
    try {
      const userProfile = await this.userService.getProfile(userId);
      const conversationHistory = await this.getChatHistory(userId);

      return {
        aiService: {
          isConnected: true,
          provider: 'openai',
          model: 'gpt-4',
        },
        chat: {
          messageCount: conversationHistory.length,
          hasHistory: conversationHistory.length > 0,
          lastMessageTime: conversationHistory.length > 0 
            ? new Date(conversationHistory[conversationHistory.length - 1]?.timestamp || 0).toISOString()
            : null,
        },
        user: {
          name: userProfile.name,
          cookingLevel: userProfile.cookingLevel,
          allergiesCount: userProfile.allergies?.length || 0,
          preferencesCount: userProfile.preferences?.length || 0,
        },
        rag: {
          enabled: true,
          elasticsearchConnected: true,
          recipesIndexed: true,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get chain status:', error);
      return {
        aiService: { isConnected: false, provider: 'unknown', model: 'unknown' },
        chat: { messageCount: 0, hasHistory: false, lastMessageTime: null },
        user: { name: 'Unknown', cookingLevel: 'unknown', allergiesCount: 0, preferencesCount: 0 },
        rag: { enabled: false, elasticsearchConnected: false, recipesIndexed: false },
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  async getUserChatStats(userId: string): Promise<UserChatStatsResponse> {
    try {
      const conversationHistory = await this.getChatHistory(userId);
      
      const userMessages = conversationHistory.filter(msg => msg.role === 'user');
      const aiMessages = conversationHistory.filter(msg => msg.role === 'assistant');
      const recipeRequests = conversationHistory.filter(msg => msg.messageType === 'recipe');
      const detailRequests = conversationHistory.filter(msg => msg.messageType === 'detail');

      return {
        totalMessages: conversationHistory.length,
        userMessages: userMessages.length,
        aiMessages: aiMessages.length,
        recipeRequests: recipeRequests.length,
        detailRequests: detailRequests.length,
      };
    } catch (error) {
      this.logger.error('Failed to get user chat stats:', error);
      return {
        totalMessages: 0,
        userMessages: 0,
        aiMessages: 0,
        recipeRequests: 0,
        detailRequests: 0,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  async addChatMessage(userId: string, role: 'user' | 'assistant', content: string, messageType: 'recipe' | 'detail' | 'general' = 'general'): Promise<void> {
    try {
      const cacheKey = `chat_history:${userId}`;
      const currentHistory = await this.getChatHistory(userId);
      
      const newMessage: ChatMessage = {
        role,
        content,
        messageType,
        timestamp: Date.now(),
      };
      
      // 새 메시지를 히스토리에 추가
      const updatedHistory = [...currentHistory, newMessage];
      
      // 최대 50개 메시지로 제한
      const trimmedHistory = updatedHistory.slice(-50);
      
      // 캐시에 저장 (24시간)
      await this.cacheService.set(cacheKey, JSON.stringify(trimmedHistory), 86400);
      
      this.logger.debug(`💾 Chat message saved for user: ${userId}, role: ${role}, type: ${messageType}`);
    } catch (error) {
      this.logger.error(`Add chat message failed for user ${userId}:`, error);
      // 메시지 저장 실패해도 채팅은 계속 진행
    }
  }

  async clearChatHistory(userId: string): Promise<void> {
    try {
      // 1. PersonalChatService 캐시 삭제
      const cacheKey = `chat_history:${userId}`;
      await this.cacheService.del(cacheKey);
      
      // 2. 기타 관련 캐시 키들도 삭제
      const contextKey = `user_context:${userId}`;
      await this.cacheService.del(contextKey);
      
      // 3. 사용자별 통계 캐시 삭제
      const statsKey = `user_stats:${userId}`;
      await this.cacheService.del(statsKey);
      
      this.logger.log(`💥 All chat history and caches cleared for user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to clear chat history:', error);
      throw error;
    }
  }

  // ==================== Private Helper Methods ====================

  private shouldUseRAG(message: string): boolean {
    const ragKeywords = [
      '레시피', '요리', '음식', '만드는', '조리법', '재료', '만들어',
      '추천', '알려줘', '가르쳐', '도움', '방법', '과정'
    ];
    
    const messageToCheck = message.toLowerCase();
    return ragKeywords.some(keyword => messageToCheck.includes(keyword));
  }

  private shouldUseRAGEnhanced(message: string, intent: EnhancedUserIntent): boolean {
    // Enhanced RAG decision based on intent analysis
    if (['recipe_search', 'recipe_detail', 'ingredient_substitute', 'nutritional_info'].includes(intent.type)) {
      return true;
    }
    
    if (intent.confidence > 0.7 && intent.entities && intent.entities.length > 0) {
      return true;
    }
    
    return this.shouldUseRAG(message);
  }
}