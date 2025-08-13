import { Injectable, Logger } from '@nestjs/common';
import { IntentAnalysisService } from './services/intent-analysis.service';
import { StreamingService } from './services/streaming.service';
import { RecipeSearchService } from './services/recipe-search.service';
import { DataTransformService } from './services/data-transform.service';
import { 
  StreamingChunk, 
  ConversationContext,
  RecipeSearchResult,
  RecipeDetailResult
} from './types/langchain.types';
import { ElasticsearchRecipe } from '../elasticsearch/elasticsearch.service';

/**
 * 🎯 리팩토링된 LangChain 서비스
 * 이제 순수하게 오케스트레이터 역할만 수행
 */
@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);

  constructor(
    private readonly intentAnalysisService: IntentAnalysisService,
    private readonly streamingService: StreamingService,
    private readonly recipeSearchService: RecipeSearchService,
    private readonly dataTransformService: DataTransformService,
  ) {
    this.logger.log('🎯 LangChain Orchestrator Service initialized');
  }

  /**
   * 🌊 통합된 스트리밍 처리 서비스 (메인 진입점)
   * WebSocket Gateway에서 호출하는 메인 메소드
   */
  async *processConversationStream(
    message: string,
    sessionId: string,
    context?: ConversationContext
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    const startTime = Date.now();
    this.logger.log(`🌊 [${sessionId}] Starting conversation orchestration`);

    try {
      // 1. 타이핑 시작 신호 전송
      yield {
        type: 'typing',
        sessionId,
        timestamp: Date.now()
      };

      // 2. 의도 분석
      const intentAnalysis = await this.intentAnalysisService.analyzeIntent(message, context);
      this.logger.log(`🎯 [${sessionId}] Intent: ${intentAnalysis.intent} (${intentAnalysis.confidence.toFixed(2)})`);

      // 3. AI 스트리밍 응답 생성 및 전달
      let streamedContent = '';
      const streamGenerator = this.streamingService.generateStreamingResponse(message, intentAnalysis, context);

      for await (const chunk of streamGenerator) {
        if (chunk.type === 'token' && chunk.content) {
          streamedContent += chunk.content;
          yield {
            type: 'token',
            content: chunk.content,
            sessionId,
            timestamp: Date.now()
          };
        } else if (chunk.type === 'complete') {
          // 4. 스트리밍 완료 후 레시피 검색 수행
          const searchResult = await this.performPostStreamingSearch(
            message, 
            intentAnalysis.intent, 
            context
          );
          
          // 5. 최종 메타데이터 구성
          const finalMetadata = this.dataTransformService.buildStreamingMetadata({
            intent: intentAnalysis.intent,
            confidence: intentAnalysis.confidence,
            processingTime: Date.now() - startTime,
            searchResults: searchResult.recipes.length,
            recipes: searchResult.recipes,
            recipeDetail: searchResult.recipeDetail
          });

          // 6. 최종 완료 신호 전송
          yield {
            type: 'content',
            content: streamedContent,
            isComplete: true,
            metadata: finalMetadata,
            sessionId,
            timestamp: Date.now()
          };

          this.logger.log(`✅ [${sessionId}] Conversation completed - Content: ${streamedContent.length} chars, Recipes: ${searchResult.recipes.length}`);
          return;
        }
      }
    } catch (error) {
      this.logger.error(`❌ [${sessionId}] Conversation stream error:`, error);
      yield {
        type: 'error',
        content: '죄송합니다. 일시적인 오류가 발생했습니다.',
        sessionId,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 📚 레시피 검색 및 처리 (비스트리밍)
   * WebSocket Gateway에서 일반 메시지용으로 호출
   */
  async searchAndProcessRecipes(
    message: string,
    context?: ConversationContext,
    limit?: number
  ): Promise<RecipeSearchResult> {
    this.logger.log(`📚 Processing non-streaming recipe search: ${message.substring(0, 30)}...`);
    
    // 레시피 검색 서비스에 위임
    return await this.recipeSearchService.searchAndProcessRecipes(message, context, limit);
  }

  /**
   * 📖 특정 레시피 상세 정보 조회
   */
  async getRecipeDetailWithLLM(
    recipeId: string,
    context?: ConversationContext
  ): Promise<RecipeDetailResult> {
    this.logger.log(`📖 Getting recipe detail for: ${recipeId}`);
    
    // 레시피 검색 서비스에 위임
    return await this.recipeSearchService.getRecipeDetailWithLLM(recipeId, context);
  }

  /**
   * 🔍 스트리밍 후 레시피 검색 수행
   */
  private async performPostStreamingSearch(
    message: string,
    intent: string,
    context?: ConversationContext
  ): Promise<{recipes: ElasticsearchRecipe[], recipeDetail: ElasticsearchRecipe | null}> {
    let recipes: ElasticsearchRecipe[] = [];
    let recipeDetail: ElasticsearchRecipe | null = null;

    try {
      // 특정 레시피 ID 요청 확인
      const recipeIdMatch = message.match(/레시피\s*([a-zA-Z0-9_-]+)/);
      
      if (recipeIdMatch && recipeIdMatch[1]) {
        // 특정 레시피 상세 조회
        const detailResponse = await this.recipeSearchService.getRecipeDetailWithLLM(recipeIdMatch[1], context);
        recipeDetail = detailResponse.recipe;
      } else if (intent === 'recipe_list' || intent === 'recipe_detail') {
        // 레시피 검색 수행
        const searchResponse = await this.recipeSearchService.searchAndProcessRecipes(message, context, 5);
        recipes = searchResponse.recipes;
      }
    } catch (error) {
      this.logger.warn(`⚠️ Post-streaming search failed:`, error);
    }

    return { recipes, recipeDetail };
  }

  /**
   * 🔧 레거시 메소드들 (하위 호환성을 위해 유지)
   * TODO: 점진적으로 제거 예정
   */

  /**
   * @deprecated 새로운 processConversationStream 사용 권장
   */
  async *processRecipeQueryStream(message: string, context?: any) {
    this.logger.warn('⚠️ Using deprecated processRecipeQueryStream. Use processConversationStream instead.');
    
    // 기존 호환성을 위해 새로운 메소드로 위임
    const sessionId = `legacy_${Date.now()}`;
    for await (const chunk of this.processConversationStream(message, sessionId, context)) {
      // 기존 형식으로 변환
      if (chunk.type === 'token') {
        yield { type: 'token', content: chunk.content };
      } else if (chunk.type === 'content' && chunk.isComplete) {
        yield { type: 'complete', metadata: chunk.metadata };
      }
    }
  }
}

// 타입 재수출 (하위 호환성)
export { StreamingChunk, StreamingMetadata } from './types/langchain.types';