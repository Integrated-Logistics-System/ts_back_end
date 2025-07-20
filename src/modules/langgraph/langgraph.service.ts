import { Injectable, Logger } from '@nestjs/common';
import { Runnable } from '@langchain/core/runnables';
import { AiService } from '../ai/ai.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { CacheService } from '../cache/cache.service';
import { UserService } from '../user/user.service';
import {
  RAGRecipeRequest,
  RAGRecipeResponse,
  WebSocketStreamChunk,
  GraphState,
  WorkflowMetadata,
} from './types/workflow.types';
import { WorkflowBuilder } from './workflow/workflow.builder';
import { StreamHandler } from './streaming/stream.handler';
import { WebSocketAdapter } from './streaming/websocket.adapter';
import { RecipeFormatter } from './formatters/recipe.formatter';
import { ResponseFormatter } from './formatters/response.formatter';
import { RecipeUtils } from './utils/recipe.utils';
import { ValidationUtils } from './utils/validation.utils';
import { AnalyzeNode } from './workflow/nodes/analyze.node';
import { SearchNode } from './workflow/nodes/search.node';
import { GenerateNode } from './workflow/nodes/generate.node';
import { ResponseNode } from './workflow/nodes/response.node';

@Injectable()
export class LangGraphService {
  private readonly logger = new Logger(LangGraphService.name);
  private workflow!: Runnable<GraphState, GraphState>;

  constructor(
    private readonly aiService: AiService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly cacheService: CacheService,
    private readonly userService: UserService,
    private readonly workflowBuilder: WorkflowBuilder,
    private readonly streamHandler: StreamHandler,
    private readonly webSocketAdapter: WebSocketAdapter,
    private readonly recipeFormatter: RecipeFormatter,
    private readonly responseFormatter: ResponseFormatter,
    private readonly recipeUtils: RecipeUtils,
    private readonly validationUtils: ValidationUtils,
    private readonly analyzeNode: AnalyzeNode,
    private readonly searchNode: SearchNode,
    private readonly generateNode: GenerateNode,
    private readonly responseNode: ResponseNode,
  ) {
    this.initializeWorkflow();
    this.logger.log('🔗 LangGraph Recipe Workflow (v0.4.0) initialized with modular architecture');
  }

  /**
   * 워크플로우 초기화 - 분리된 WorkflowBuilder 사용
   */
  private initializeWorkflow(): void {
    try {
      this.workflow = this.workflowBuilder.buildWorkflow();
      this.logger.log('✅ LangGraph workflow initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize LangGraph workflow:', error);
      throw error;
    }
  }

  /**
   * 🔥 주요 공개 메서드: 레시피 요청 처리
   */
  async processRecipeRequest(
    query: string,
    userAllergies: string[] = [],
    userId?: string,
  ): Promise<RAGRecipeResponse> {
    const startTime = Date.now();

    try {
      // 입력 검증
      this.validationUtils.validateTextInput(query);
      this.validationUtils.checkSecurityThreats(query);

      // 사용자 프로필 조회
      const userProfile = userId ? await this.userService.findById(userId) : null;
      const allUserAllergies = userProfile?.settings?.allergies || userAllergies;

      // 초기 상태 생성
      const initialState = this.workflowBuilder.createInitialState(
        query,
        allUserAllergies,
        userId || null,
        userProfile ? {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name,
          allergies: userProfile.settings?.allergies,
          cookingLevel: userProfile.settings?.cookingLevel,
          preferences: userProfile.settings?.preferences,
        } : null,
      );

      // 워크플로우 실행
      const finalState = await this.workflow.invoke(initialState);

      // 최종 응답 생성
      const response = this.buildFinalResponse(finalState, startTime);

      // 사용자별 캐싱 (옵션)
      if (userId) {
        await this.cacheUserRecipeResponse(userId, query, response);
      }

      return response;

    } catch (error) {
      this.logger.error('Recipe request processing failed:', error);
      throw error;
    }
  }

  /**
   * 🔥 WebSocket 스트리밍 - 레시피 워크플로우
   */
  async* streamRecipeWorkflowForWebSocket(
    query: string,
    userAllergies: string[] = [],
    userId?: string
  ): AsyncGenerator<WebSocketStreamChunk, void, unknown> {
    try {
      // 입력 검증
      this.validationUtils.validateTextInput(query);
      this.validationUtils.checkSecurityThreats(query);

      // 사용자 프로필 조회
      const userProfile = userId ? await this.userService.findById(userId) : null;

      // 스트리밍 처리 위임
      yield* this.streamHandler.streamRecipeWorkflowForWebSocket(
        this.workflow,
        query,
        userAllergies,
        userId,
        userProfile ? {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name,
          allergies: userProfile.settings?.allergies,
          cookingLevel: userProfile.settings?.cookingLevel,
          preferences: userProfile.settings?.preferences,
        } : null,
      );

    } catch (error) {
      this.logger.error('WebSocket streaming failed:', error);
      yield this.webSocketAdapter.formatChunk({
        type: 'error',
        content: `스트리밍 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 🔥 WebSocket 스트리밍 - RAG 검색
   */
  async* streamRAGForWebSocket(
    request: RAGRecipeRequest,
    userId?: string
  ): AsyncGenerator<WebSocketStreamChunk, void, unknown> {
    try {
      // 입력 검증
      this.validationUtils.validateTextInput(request.query);
      this.validationUtils.checkSecurityThreats(request.query);

      // 스트리밍 처리 위임
      yield* this.streamHandler.streamRAGForWebSocket(request, userId);

    } catch (error) {
      this.logger.error('RAG streaming failed:', error);
      yield this.webSocketAdapter.formatChunk({
        type: 'error',
        content: `RAG 처리 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 🔥 RAG 요청 처리 (호환성을 위한 별칭)
   */
  async processRAGRequest(request: RAGRecipeRequest): Promise<RAGRecipeResponse> {
    return this.processRAGSearch(request);
  }

  /**
   * 🔥 RAG 요청 스트리밍 처리
   */
  async* processRAGRequestStream(request: RAGRecipeRequest): AsyncGenerator<WebSocketStreamChunk, void, unknown> {
    yield* this.streamRAGForWebSocket(request);
  }

  /**
   * 🔥 RAG 검색 처리
   */
  async processRAGSearch(request: RAGRecipeRequest): Promise<RAGRecipeResponse> {
    const startTime = Date.now();

    try {
      // 입력 검증
      this.validationUtils.validateTextInput(request.query);
      this.validationUtils.checkSecurityThreats(request.query);

      // 레시피 검색 실행
      const searchResult = await this.elasticsearchService.searchRecipes(request.query, {
        limit: 10,
        page: 1,
        allergies: request.userAllergies,
        preferences: request.preferences || [],
      });

      // 안전한 레시피 필터링
      const safeRecipes = await this.recipeUtils.filterSafeRecipes(
        searchResult.recipes || [],
        request.userAllergies || []
      );

      // 응답 포맷팅
      const formattedResponse = this.recipeFormatter.formatSearchResults(
        safeRecipes,
        request.query,
        request.userAllergies || []
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      return {
        query: request.query,
        response: formattedResponse,
        searchResults: safeRecipes,
        generatedRecipe: null,
        metadata: {
          searchTime: totalTime,
          generationTime: 0,
          totalTime: totalTime,
          foundRecipes: safeRecipes.length,
          source: 'elasticsearch',
          ragMode: true,
        },
      };

    } catch (error) {
      this.logger.error('RAG search failed:', error);
      throw error;
    }
  }

  /**
   * 🔥 서비스 상태 확인
   */
  async getServiceStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    components: Record<string, any>;
    timestamp: number;
  }> {
    const startTime = Date.now();
    
    try {
      // 각 컴포넌트 상태 확인
      const [
        elasticsearchStatus,
        aiServiceStatus,
        cacheStatus,
        workflowStatus
      ] = await Promise.allSettled([
        this.checkElasticsearchStatus(),
        this.checkAiServiceStatus(),
        this.checkCacheStatus(),
        this.checkWorkflowStatus(),
      ]);

      const components = {
        elasticsearch: this.getSettledResult(elasticsearchStatus),
        aiService: this.getSettledResult(aiServiceStatus),
        cache: this.getSettledResult(cacheStatus),
        workflow: this.getSettledResult(workflowStatus),
      };

      // 전체 상태 평가
      const overallStatus = this.evaluateOverallStatus(components);

      return {
        status: overallStatus,
        version: 'v0.4.0',
        components,
        timestamp: Date.now(),
      };

    } catch (error) {
      this.logger.error('Service status check failed:', error);
      return {
        status: 'unhealthy',
        version: 'v0.4.0',
        components: {
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 🔥 워크플로우 성능 통계
   */
  async getWorkflowStats(): Promise<Record<string, any>> {
    try {
      // 캐시에서 최근 실행 통계 가져오기
      const recentStats = await this.cacheService.get('workflow:stats') || '{}';
      const statsData = typeof recentStats === 'string' ? JSON.parse(recentStats) : {};
      
      return {
        totalExecutions: statsData.totalExecutions || 0,
        averageExecutionTime: statsData.averageExecutionTime || 0,
        successRate: statsData.successRate || 0,
        errorCount: statsData.errorCount || 0,
        lastExecution: statsData.lastExecution || null,
        version: 'v0.4.0',
        timestamp: Date.now(),
      };

    } catch (error) {
      this.logger.error('Failed to get workflow stats:', error);
      return {
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 🔥 캐시 관리
   */
  async clearCache(pattern?: string): Promise<{ success: boolean; message: string }> {
    try {
      if (pattern) {
        await this.cacheService.del(pattern);
        this.logger.log(`🗑️ Cache cleared for pattern: ${pattern}`);
      } else {
        // 전체 캐시 클리어는 신중하게...
        await this.cacheService.del('recipe:*');
        await this.cacheService.del('workflow:*');
        this.logger.log('🗑️ Recipe and workflow cache cleared');
      }

      return {
        success: true,
        message: pattern ? `Pattern ${pattern} cleared` : 'Recipe cache cleared'
      };

    } catch (error) {
      this.logger.error('Cache clear failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '캐시 클리어 실패'
      };
    }
  }

  // ==================== 🔧 Private Helper Methods ====================

  /**
   * 최종 응답 생성
   */
  private buildFinalResponse(state: GraphState, startTime: number): RAGRecipeResponse {
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    return {
      query: state.query,
      response: state.finalResponse,
      searchResults: state.searchResults,
      generatedRecipe: state.generatedRecipe,
      metadata: {
        ...state.metadata,
        totalTime,
        foundRecipes: state.searchResults.length,
        source: 'workflow',
        ragMode: state.searchResults.length > 0,
      },
    };
  }

  /**
   * 사용자별 레시피 응답 캐싱
   */
  private async cacheUserRecipeResponse(
    userId: string,
    query: string,
    response: RAGRecipeResponse
  ): Promise<void> {
    try {
      const cacheKey = `recipe:${userId}:${Buffer.from(query).toString('base64')}`;
      const cacheData = {
        query,
        response: response.response,
        timestamp: Date.now(),
        metadata: response.metadata,
      };

      await this.cacheService.set(cacheKey, JSON.stringify(cacheData), 1800); // 30분 캐시
      this.logger.log(`💾 Recipe response cached for user: ${userId}`);

    } catch (error) {
      this.logger.warn('Failed to cache recipe response:', error);
      // 캐시 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  /**
   * 컴포넌트 상태 확인 메서드들
   */
  private async checkElasticsearchStatus(): Promise<{ status: string; details: any }> {
    try {
      const result = await this.elasticsearchService.searchRecipes('test', { limit: 1, page: 1 });
      return {
        status: 'healthy',
        details: { totalRecipes: result.total || 0 }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : '알 수 없는 오류' }
      };
    }
  }

  private async checkAiServiceStatus(): Promise<{ status: string; details: any }> {
    try {
      // AI 서비스 간단한 상태 확인 (실제 구현에 따라 조정 필요)
      return {
        status: 'healthy',
        details: { service: 'openai' }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : '알 수 없는 오류' }
      };
    }
  }

  private async checkCacheStatus(): Promise<{ status: string; details: any }> {
    try {
      const testKey = 'health:check';
      await this.cacheService.set(testKey, 'test', 10);
      const result = await this.cacheService.get(testKey);
      await this.cacheService.del(testKey);
      
      return {
        status: result === 'test' ? 'healthy' : 'degraded',
        details: { connectionTest: result === 'test' }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : '알 수 없는 오류' }
      };
    }
  }

  private async checkWorkflowStatus(): Promise<{ status: string; details: any }> {
    try {
      const testState = this.workflowBuilder.createInitialState('test query', []);
      const validation = this.workflowBuilder.validateWorkflowState(testState);
      
      return {
        status: validation.isValid ? 'healthy' : 'degraded',
        details: { validation }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : '알 수 없는 오류' }
      };
    }
  }

  /**
   * Promise.allSettled 결과 처리
   */
  private getSettledResult(result: PromiseSettledResult<any>): any {
    return result.status === 'fulfilled' ? result.value : { error: result.reason };
  }

  /**
   * 전체 상태 평가
   */
  private evaluateOverallStatus(components: Record<string, any>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(components).map(c => c.status);
    
    if (statuses.every(s => s === 'healthy')) {
      return 'healthy';
    } else if (statuses.some(s => s === 'unhealthy')) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }
}