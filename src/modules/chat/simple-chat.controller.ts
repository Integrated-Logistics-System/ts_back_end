/**
 * 💬 Simple Chat Controller
 * Agent Service 기반 간단한 채팅 API
 */

import { 
  Controller, 
  Post, 
  Body, 
  Logger, 
  Get, 
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { RecipeAgentService, AgentQuery } from '../agent/core/main-agent';
import { ChatHistoryService } from './chat-history.service';

interface ChatRequest {
  message: string;
  userId?: string;
  sessionId?: string;
}

interface ChatResponse {
  success: boolean;
  message: string;
  recipes?: any[];
  suggestions?: string[];
  metadata: {
    processingTime: number;
    toolsUsed: string[];
    confidence: number;
    timestamp: string;
  };
}

@Controller('chat')
export class SimpleChatController {
  private readonly logger = new Logger(SimpleChatController.name);

  constructor(
    private readonly recipeAgentService: RecipeAgentService,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  /**
   * 💬 메인 채팅 엔드포인트
   */
  @Post()
  async chat(@Body() request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    this.logger.log(`💬 채팅 요청: "${request.message}"`);

    try {
      // 입력 검증
      if (!request.message || request.message.trim().length === 0) {
        throw new HttpException('메시지를 입력해주세요.', HttpStatus.BAD_REQUEST);
      }

      // Agent를 통한 쿼리 처리
      const agentQuery: AgentQuery = {
        message: request.message.trim(),
        userId: request.userId,
        sessionId: request.sessionId || `session_${Date.now()}`
      };

      const agentResponse = await this.recipeAgentService.processQuery(agentQuery);

      // 💾 채팅 히스토리 저장 (userId가 있는 경우만)
      if (request.userId) {
        try {
          const chatType = this.determineChatType(agentResponse.metadata.intent || 'general_chat');
          await this.chatHistoryService.saveChatMessage(
            request.userId,
            request.message,
            agentResponse.message,
            chatType,
            {
              intent: agentResponse.metadata.intent,
              processingTime: agentResponse.metadata.processingTime,
              hasRecipe: agentResponse.recipes && agentResponse.recipes.length > 0,
              recipeId: agentResponse.recipes && agentResponse.recipes.length > 0 ? agentResponse.recipes[0].id : undefined
            }
          );
          this.logger.log(`💾 REST API 채팅 메시지 저장 완료: ${request.userId}`);
        } catch (saveError) {
          this.logger.warn(`⚠️ REST API 채팅 메시지 저장 실패:`, saveError);
          // 저장 실패해도 응답은 계속 진행
        }
      }

      const totalTime = Date.now() - startTime;
      this.logger.log(`✅ 채팅 응답 완료 (${totalTime}ms)`);

      return {
        success: true,
        message: agentResponse.message,
        recipes: agentResponse.recipes,
        suggestions: agentResponse.suggestions,
        metadata: {
          ...agentResponse.metadata,
          processingTime: totalTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error(`❌ 채팅 처러 실패 (${totalTime}ms):`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      return {
        success: false,
        message: '죄송합니다. 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        metadata: {
          processingTime: totalTime,
          toolsUsed: [],
          confidence: 0,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 🔍 직접 검색 (개발/테스트용) - Agent Service 사용
   */
  @Post('search')
  async directSearch(@Body() request: { query: string; maxResults?: number }) {
    const startTime = Date.now();
    this.logger.log(`🔍 직접 검색: "${request.query}"`);

    try {
      // Agent Service를 통한 검색
      const agentQuery: AgentQuery = {
        message: request.query,
        userId: 'search-api-user',
        sessionId: `search_${Date.now()}`
      };

      const agentResponse = await this.recipeAgentService.processQuery(agentQuery);

      const totalTime = Date.now() - startTime;

      return {
        success: true,
        message: agentResponse.message,
        recipes: agentResponse.recipes,
        suggestions: agentResponse.suggestions,
        metadata: {
          ...agentResponse.metadata,
          totalTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error(`❌ 직접 검색 실패 (${totalTime}ms):`, error);

      throw new HttpException(
        '검색 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 📊 시스템 상태 확인
   */
  @Get('status')
  async getStatus() {
    const agentStatus = this.recipeAgentService.getAgentStatus();
    
    return {
      success: true,
      system: {
        agent: agentStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      },
      features: {
        langchain: true,
        elasticsearch: true,
        agent: agentStatus.isReady
      }
    };
  }

  /**
   * 💡 검색 제안 생성 - Agent Service 기반
   */
  @Post('suggestions')
  async getSuggestions(@Body() request: { query: string }) {
    try {
      // Agent Service를 통한 간단한 쿼리 처리
      const agentQuery: AgentQuery = {
        message: request.query,
        userId: 'suggestions-api-user',
        sessionId: `suggestions_${Date.now()}`
      };

      const agentResponse = await this.recipeAgentService.processQuery(agentQuery);

      return {
        success: true,
        originalQuery: request.query,
        suggestions: agentResponse.suggestions || ['간단한 요리', '인기 레시피', '빠른 요리'],
        relatedRecipes: (agentResponse.recipes || []).slice(0, 2).map(recipe => ({
          title: recipe.nameKo || recipe.name,
          cookingTime: recipe.minutes ? `${recipe.minutes}분` : '시간 미정'
        }))
      };

    } catch (error) {
      this.logger.error('제안 생성 실패:', error);
      
      return {
        success: false,
        suggestions: ['간단한 요리', '인기 레시피', '빠른 요리'],
        message: '기본 제안을 표시합니다.'
      };
    }
  }

  /**
   * 🎯 키워드 추출 API - 간단한 구현
   */
  @Post('keywords')
  async extractKeywords(@Body() request: { query: string }) {
    // 간단한 키워드 추출 로직
    const keywords = request.query
      .split(' ')
      .filter(word => word.length > 1)
      .map(word => word.trim())
      .filter(Boolean);
    
    return {
      success: true,
      originalQuery: request.query,
      extractedKeywords: keywords,
      keywordCount: keywords.length
    };
  }

  /**
   * 대화 유형에 따른 채팅 타입 결정
   */
  private determineChatType(intent: string): 'recipe_query' | 'general_chat' | 'detail_request' {
    switch (intent) {
      case 'RECIPE_REQUEST':
      case 'ALTERNATIVE_RECIPE':
      case 'recipe_list':
      case 'recipe_search':
        return 'recipe_query';
      case 'recipe_detail':
        return 'detail_request';
      case 'GENERAL_CHAT':
      case 'general_chat':
      default:
        return 'general_chat';
    }
  }
}