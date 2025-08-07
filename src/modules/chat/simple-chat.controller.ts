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
   * 🍖 대체 재료 추천 API - 대화형 응답
   */
  @Post('substitute')
  async getSubstitute(@Body() request: { ingredient: string }) {
    const startTime = Date.now();
    this.logger.log(`🍖 대체 재료 요청: "${request.ingredient}"`);

    try {
      // 입력 검증
      if (!request.ingredient || request.ingredient.trim().length === 0) {
        throw new HttpException('재료명을 입력해주세요.', HttpStatus.BAD_REQUEST);
      }

      const ingredient = request.ingredient.trim();
      
      // 간단한 대체 재료 매핑 (실제로는 AI 서비스나 DB를 사용할 수 있음)
      const substitutes = this.getSubstituteMapping(ingredient);
      
      const processingTime = Date.now() - startTime;
      
      if (substitutes.length === 0) {
        return {
          success: true,
          message: `${ingredient}에 대한 대체 재료를 찾지 못했어요. 다른 재료를 시도해보세요!`,
          ingredient: ingredient,
          substitutes: [],
          metadata: {
            processingTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      // 추천된 대체 재료 중 첫 번째를 메인 추천으로
      const primarySubstitute = substitutes[0]!;
      const additionalSubstitutes = substitutes.slice(1);

      let message = `${ingredient}이 없으시네요! ${primarySubstitute.name}을(를) 추천드려요.`;
      
      if (primarySubstitute.reason) {
        message += ` ${primarySubstitute.reason}`;
      }

      if (additionalSubstitutes.length > 0) {
        const alternatives = additionalSubstitutes.map(sub => sub.name).join(', ');
        message += ` 다른 대안으로는 ${alternatives}도 좋습니다.`;
      }

      return {
        success: true,
        message: message,
        ingredient: ingredient,
        substitutes: substitutes,
        metadata: {
          processingTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`❌ 대체 재료 추천 실패 (${processingTime}ms):`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      return {
        success: false,
        message: '대체 재료를 찾는 중 오류가 발생했습니다. 다시 시도해주세요.',
        ingredient: request.ingredient,
        substitutes: [],
        metadata: {
          processingTime,
          timestamp: new Date().toISOString()
        }
      };
    }
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

  /**
   * 대체 재료 매핑 로직
   */
  private getSubstituteMapping(ingredient: string): Array<{name: string, reason?: string}> {
    const ingredientLower = ingredient.toLowerCase().replace(/\s+/g, '');
    
    // 육류 대체
    if (ingredientLower.includes('닭가슴살') || ingredientLower.includes('치킨') || ingredientLower.includes('닭고기')) {
      return [
        { name: '돼지 앞다리살', reason: '단백질 함량이 비슷하고 부드러운 식감이에요.' },
        { name: '소고기 안심', reason: '고단백 저지방으로 헬시한 선택입니다.' },
        { name: '두부', reason: '식물성 단백질로 건강한 대안이에요.' }
      ];
    }
    
    if (ingredientLower.includes('돼지고기') || ingredientLower.includes('삼겹살')) {
      return [
        { name: '닭다리살', reason: '육즙이 풍부하고 감칠맛이 좋아요.' },
        { name: '소고기', reason: '단백질이 풍부하고 맛이 진합니다.' },
        { name: '연어', reason: '오메가3가 풍부한 건강한 선택입니다.' }
      ];
    }

    if (ingredientLower.includes('소고기') || ingredientLower.includes('스테이크')) {
      return [
        { name: '돼지 목살', reason: '부드럽고 육즙이 풍부해요.' },
        { name: '닭가슴살', reason: '저칼로리 고단백 식품입니다.' },
        { name: '버섯', reason: '감칠맛이 좋은 식물성 대안이에요.' }
      ];
    }

    // 해산물 대체
    if (ingredientLower.includes('새우') || ingredientLower.includes('쉬림프')) {
      return [
        { name: '오징어', reason: '쫄깃한 식감이 비슷해요.' },
        { name: '관자', reason: '단맛이 나고 부드러운 식감입니다.' },
        { name: '닭가슴살', reason: '담백하고 단백질이 풍부해요.' }
      ];
    }

    if (ingredientLower.includes('연어') || ingredientLower.includes('참치')) {
      return [
        { name: '고등어', reason: '오메가3가 풍부하고 가격이 저렴해요.' },
        { name: '닭가슴살', reason: '고단백 저지방 식품입니다.' },
        { name: '두부', reason: '식물성 단백질로 건강해요.' }
      ];
    }

    // 채소 대체
    if (ingredientLower.includes('양파')) {
      return [
        { name: '대파', reason: '단맛과 향이 비슷해요.' },
        { name: '마늘', reason: '깊은 맛을 더해줍니다.' },
        { name: '샬롯', reason: '부드러운 양파 맛이 납니다.' }
      ];
    }

    if (ingredientLower.includes('당근')) {
      return [
        { name: '단호박', reason: '단맛과 색깔이 비슷해요.' },
        { name: '파프리카', reason: '아삭한 식감과 단맛이 좋습니다.' },
        { name: '고구마', reason: '달콤하고 부드러운 식감이에요.' }
      ];
    }

    if (ingredientLower.includes('브로콜리')) {
      return [
        { name: '콜리플라워', reason: '식감과 모양이 비슷해요.' },
        { name: '아스파라거스', reason: '아삭한 식감이 좋습니다.' },
        { name: '시금치', reason: '영양가가 높은 녹색 채소예요.' }
      ];
    }

    // 곡물/탄수화물 대체
    if (ingredientLower.includes('쌀') || ingredientLower.includes('밥')) {
      return [
        { name: '퀴노아', reason: '고단백이고 건강한 곡물이에요.' },
        { name: '현미', reason: '식이섬유가 풍부합니다.' },
        { name: '양배추', reason: '저탄수화물 대안으로 좋아요.' }
      ];
    }

    if (ingredientLower.includes('밀가루')) {
      return [
        { name: '아몬드가루', reason: '글루텐 프리이고 고단백이에요.' },
        { name: '귀리가루', reason: '식이섬유가 풍부합니다.' },
        { name: '현미가루', reason: '영양가가 높은 대안입니다.' }
      ];
    }

    // 유제품 대체
    if (ingredientLower.includes('우유') || ingredientLower.includes('밀크')) {
      return [
        { name: '아몬드 우유', reason: '칼로리가 낮고 고소해요.' },
        { name: '두유', reason: '단백질이 풍부한 식물성 우유입니다.' },
        { name: '귀리 우유', reason: '크리미하고 환경친화적이에요.' }
      ];
    }

    if (ingredientLower.includes('버터')) {
      return [
        { name: '올리브오일', reason: '건강한 지방으로 풍미가 좋아요.' },
        { name: '아보카도', reason: '크리미한 식감과 좋은 지방이 있어요.' },
        { name: '코코넛오일', reason: '고온 조리에 적합합니다.' }
      ];
    }

    // 조미료 대체
    if (ingredientLower.includes('설탕') || ingredientLower.includes('백설탕')) {
      return [
        { name: '꿀', reason: '천연 감미료로 풍미가 좋아요.' },
        { name: '스테비아', reason: '칼로리가 거의 없는 천연 감미료입니다.' },
        { name: '메이플 시럽', reason: '깊은 단맛과 향이 있어요.' }
      ];
    }

    if (ingredientLower.includes('간장')) {
      return [
        { name: '코코넛 아미노', reason: '글루텐 프리이고 비슷한 맛이에요.' },
        { name: '타마리', reason: '진한 맛의 간장 대안입니다.' },
        { name: '미소', reason: '감칠맛이 풍부해요.' }
      ];
    }

    // 기본값 - 매칭되지 않는 경우
    return [];
  }
}