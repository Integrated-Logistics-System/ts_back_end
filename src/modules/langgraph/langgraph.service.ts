import { Injectable, Logger } from '@nestjs/common';
import { Runnable } from '@langchain/core/runnables';
// import { UserStatusService } from '../user/user-status.service'; // Removed
import { CacheService } from '../cache/cache.service';
import { WorkflowBuilder, GraphState } from './workflow/workflow.builder';

export interface LangGraphRequest {
  query: string;
  userId?: string;
  sessionId?: string;
}

export interface LangGraphResponse {
  success: boolean;
  response: string;
  metadata: {
    intent: GraphState['intent'];
    confidence: number;
    processingTime: number;
    timestamp: string;
  };
  error?: string;
}

@Injectable()
export class LangGraphService {
  private readonly logger = new Logger(LangGraphService.name);
  private workflow!: Runnable<GraphState, GraphState>;

  constructor(
    // private readonly userStatusService: UserStatusService, // Removed
    private readonly cacheService: CacheService,
    private readonly workflowBuilder: WorkflowBuilder,
  ) {
    this.initializeWorkflow();
    this.logger.log('🚀 LangGraph Service initialized successfully');
  }

  /**
   * 워크플로우 초기화
   */
  private initializeWorkflow(): void {
    try {
      this.workflow = this.workflowBuilder.buildWorkflow();
      this.logger.log('✅ Workflow compiled and ready');
    } catch (error) {
      this.logger.error('❌ Failed to initialize workflow:', error);
      throw new Error('Workflow initialization failed');
    }
  }

  /**
   * 간단한 레시피 AI 처리
   * 복잡한 RAG 없이 기본적인 의도 분석과 응답 생성
   */
  async processQuery(request: LangGraphRequest): Promise<LangGraphResponse> {
    const startTime = Date.now();
    this.logger.log(`🔍 Processing simple query: "${request.query}"`);

    try {
      // 입력 검증
      if (!request.query || request.query.trim().length === 0) {
        throw new Error('Query is required');
      }

      // 캐시 확인
      const cacheKey = this.generateCacheKey(request);
      const cached = await this.getCachedResponse(cacheKey);
      if (cached) {
        this.logger.log('📦 Returning cached response');
        return cached;
      }

      // 초기 상태 생성
      const initialState = this.workflowBuilder.createInitialState(
        request.query,
        request.userId
      );

      // 상태 검증
      const validation = this.workflowBuilder.validateWorkflowState(initialState);
      if (!validation.isValid) {
        throw new Error(`Invalid workflow state: ${validation.errors.join(', ')}`);
      }

      // 워크플로우 실행
      this.logger.log('🔄 Executing simple workflow...');
      const result = await this.workflow.invoke(initialState);

      // 응답 포맷팅
      const response: LangGraphResponse = {
        success: true,
        response: result.response,
        metadata: {
          intent: result.intent,
          confidence: result.confidence,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };

      // 응답 캐싱 (성공한 경우만)
      await this.setCachedResponse(cacheKey, response);

      this.logger.log(`✅ Simple query processed in ${response.metadata.processingTime}ms`);
      return response;

    } catch (error) {
      this.logger.error('❌ Simple query processing failed:', error);
      
      return {
        success: false,
        response: this.getErrorResponse(error),
        metadata: {
          intent: 'unknown',
          confidence: 0,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * 스트리밍 응답 처리 (간단 버전)
   */
  async processQueryStream(
    request: LangGraphRequest,
    onChunk: (chunk: { type: 'token' | 'metadata', content: string, metadata?: any }) => void
  ): Promise<LangGraphResponse> {
    const startTime = Date.now();
    this.logger.log(`🌊 Processing simple query with streaming: "${request.query}"`);

    try {
      // 즉시 시작 메타데이터 전송
      onChunk({
        type: 'metadata',
        content: 'analysis_started',
        metadata: { step: 'intent_analysis', timestamp: new Date().toISOString() }
      });

      // 초기 상태 생성
      const initialState = this.workflowBuilder.createInitialState(
        request.query,
        request.userId
      );

      // 워크플로우 실행 (스트리밍)
      onChunk({
        type: 'metadata',
        content: 'processing_started',
        metadata: { step: 'workflow_execution', timestamp: new Date().toISOString() }
      });

      const result = await this.workflow.invoke(initialState);

      // 응답을 토큰 단위로 스트리밍
      const tokens = this.tokenizeResponse(result.response);
      for (let i = 0; i < tokens.length; i++) {
        onChunk({
          type: 'token',
          content: tokens[i] || '',
          metadata: { 
            position: i, 
            total: tokens.length,
            isLast: i === tokens.length - 1
          }
        });
        
        // 자연스러운 스트리밍을 위한 지연
        await this.sleep(30);
      }

      // 최종 메타데이터 전송
      const finalResponse: LangGraphResponse = {
        success: true,
        response: result.response,
        metadata: {
          intent: result.intent,
          confidence: result.confidence,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };

      onChunk({
        type: 'metadata',
        content: 'completed',
        metadata: finalResponse.metadata
      });

      this.logger.log(`✅ Simple streaming completed in ${finalResponse.metadata.processingTime}ms`);
      return finalResponse;

    } catch (error) {
      this.logger.error('❌ Simple streaming failed:', error);
      
      // 에러도 스트리밍으로 전송
      const errorResponse = this.getErrorResponse(error);
      const errorTokens = this.tokenizeResponse(errorResponse);
      
      for (const token of errorTokens) {
        onChunk({ type: 'token', content: token });
        await this.sleep(30);
      }

      onChunk({
        type: 'metadata',
        content: 'error',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return {
        success: false,
        response: errorResponse,
        metadata: {
          intent: 'unknown',
          confidence: 0,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * 건강 상태 확인
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    workflow: 'ready' | 'not_ready';
    dependencies: {
      userStatusService: boolean;
      cacheService: boolean;
    };
    uptime: number;
    timestamp: string;
  }> {
    try {
      const dependencyStatus = {
        userStatusService: false, // Removed service
        cacheService: !!this.cacheService,
      };

      const allDependenciesHealthy = Object.values(dependencyStatus).every(status => status);
      const workflowReady = !!this.workflow;

      return {
        status: (allDependenciesHealthy && workflowReady) ? 'healthy' : 'unhealthy',
        workflow: workflowReady ? 'ready' : 'not_ready',
        dependencies: dependencyStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        workflow: 'not_ready',
        dependencies: {
          userStatusService: false,
          cacheService: false,
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(request: LangGraphRequest): string {
    const baseKey = `simple_langgraph_${request.query.toLowerCase().replace(/\s+/g, '_')}`;
    
    if (request.userId) {
      return `${baseKey}_user_${request.userId}`;
    }
    
    return baseKey;
  }

  // 호환성을 위한 레거시 메서드들
  async processRAGRequest(request: any): Promise<any> {
    this.logger.warn('Legacy processRAGRequest called, redirecting to processQuery');
    return this.processQuery({
      query: request.query,
      userId: request.userId,
    });
  }

  async *processRAGRequestStream(request: any): AsyncIterable<any> {
    this.logger.warn('Legacy processRAGRequestStream called, redirecting to processQueryStream');
    let result = '';
    await this.processQueryStream({
      query: request.query,
      userId: request.userId,
    }, (chunk) => {
      result += chunk.content || '';
    });
    yield { content: result, type: 'completed' };
  }

  async *streamRecipeWorkflowForWebSocket(query: string, allergies: string[], userId: string): AsyncIterable<any> {
    this.logger.warn('Legacy streamRecipeWorkflowForWebSocket called, redirecting to processQueryStream');
    let result = '';
    await this.processQueryStream({
      query: `${query} (알레르기: ${allergies.join(', ')})`,
      userId,
    }, (chunk) => {
      result += chunk.content || '';
    });
    yield { content: result, type: 'completed' };
  }

  async *streamRAGForWebSocket(request: any, userId: string): AsyncIterable<any> {
    this.logger.warn('Legacy streamRAGForWebSocket called, redirecting to processQueryStream');
    let result = '';
    await this.processQueryStream({
      query: request.query,
      userId,
    }, (chunk) => {
      result += chunk.content || '';
    });
    yield { content: result, type: 'completed' };
  }

  async processRecipeRequest(query: string, allergies: string[]): Promise<any> {
    this.logger.warn('Legacy processRecipeRequest called, redirecting to processQuery');
    const result = await this.processQuery({
      query: `${query} (알레르기: ${allergies.join(', ')})`,
    });
    
    return {
      ...result,
      generatedRecipe: result.response,
    };
  }

  getServiceStatus(): any {
    return {
      status: 'active',
      version: '1.0.0',
      timestamp: Date.now(),
    };
  }

  /**
   * 캐시된 응답 조회
   */
  private async getCachedResponse(cacheKey: string): Promise<LangGraphResponse | null> {
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as LangGraphResponse;
      }
    } catch (error) {
      this.logger.warn('Cache retrieval failed:', error);
    }
    return null;
  }

  /**
   * 응답 캐싱
   */
  private async setCachedResponse(cacheKey: string, response: LangGraphResponse): Promise<void> {
    try {
      // 5분간 캐싱
      await this.cacheService.set(cacheKey, JSON.stringify(response), 300);
    } catch (error) {
      this.logger.warn('Cache storage failed:', error);
    }
  }

  /**
   * 에러 응답 생성
   */
  private getErrorResponse(error: unknown): string {
    if (error instanceof Error) {
      // 사용자 친화적인 에러 메시지
      if (error.message.includes('Query is required')) {
        return '질문을 입력해주세요.';
      }
      if (error.message.includes('workflow')) {
        return '시스템 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }
    }
    
    return '죄송합니다. 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
  }

  /**
   * 응답을 토큰 단위로 분할 (스트리밍용)
   */
  private tokenizeResponse(response: string): string[] {
    // 자연스러운 스트리밍을 위해 문장 단위로 분할
    const sentences = response.split(/([.!?])\s*/);
    const tokens: string[] = [];
    
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i];
      const punctuation = sentences[i + 1] || '';
      
      if (sentence && sentence.trim()) {
        // 문장을 단어 단위로 추가 분할
        const words = (sentence + punctuation).split(' ');
        tokens.push(...words.map(word => word + ' '));
      }
    }
    
    return tokens;
  }

  /**
   * 지연 함수 (스트리밍 지연용)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 스트리밍 워크플로우 실행 (웹소켓용)
   */
  async executeStreamingWorkflow(options: {
    query: string;
    userId?: string;
    userStatus?: string;
    conversationHistory?: Array<{role: string, content: string}>;
    streamingCallback?: (chunk: any) => Promise<void>;
  }): Promise<{
    response: string;
    intent: GraphState['intent'];
    confidence: number;
    metadata: any;
  }> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🤖 스트리밍 워크플로우 시작: ${options.query}`);
      
      // 초기 상태 구성
      const initialState: GraphState = {
        query: options.query,
        userId: options.userId,
        userStatus: options.userStatus,
        intent: 'unknown',
        confidence: 0,
        response: '',
        metadata: {
          processingTime: 0,
          intentAnalysisTime: 0,
          responseGenerationTime: 0,
          timestamp: new Date().toISOString(),
          conversationHistory: options.conversationHistory || [],
          nodeExecutionOrder: [],
        },
      };

      // 스트리밍 콜백 설정
      const currentStage = 'intent_analysis';
      const streamingCallback = options.streamingCallback || (() => Promise.resolve());

      // 1. 의도 분석 단계
      await streamingCallback({
        stage: 'intent_analysis',
        message: '🧠 사용자 의도를 분석하고 있습니다...',
        data: { query: options.query }
      });

      // 워크플로우 실행 (스트리밍 버전)
      const finalState = await this.executeWorkflowWithStreaming(
        initialState, 
        streamingCallback
      );

      const totalTime = Date.now() - startTime;
      
      return {
        response: finalState.response,
        intent: finalState.intent,
        confidence: finalState.confidence,
        metadata: {
          ...finalState.metadata,
          processingTime: totalTime,
          nodeExecutionOrder: finalState.metadata.nodeExecutionOrder,
        },
      };
      
    } catch (error) {
      this.logger.error('스트리밍 워크플로우 실행 실패:', error);
      
      return {
        response: '죄송합니다. 요청을 처리하는 중 오류가 발생했습니다.',
        intent: 'unknown',
        confidence: 0,
        metadata: {
          processingTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
          nodeExecutionOrder: [],
        },
      };
    }
  }

  /**
   * 스트리밍과 함께 워크플로우 실행
   */
  private async executeWorkflowWithStreaming(
    initialState: GraphState,
    streamingCallback: (chunk: any) => Promise<void>
  ): Promise<GraphState> {
    const currentState = { ...initialState };
    
    try {
      // 의도 분석
      await streamingCallback({
        stage: 'intent_analysis',
        message: '🎯 의도 분석 중...',
        data: {}
      });
      
      // 실제 워크플로우 실행 (기존 메소드 활용)
      const result = await this.workflow.invoke(currentState);
      
      // 각 단계별 스트리밍 알림
      const intent = result.intent;
      
      if (intent === 'recipe_search') {
        await streamingCallback({
          stage: 'recipe_search',
          message: '🔍 레시피를 검색하고 있습니다...',
          data: { intent }
        });
      } else if (intent === 'cooking_help') {
        await streamingCallback({
          stage: 'cooking_help',
          message: '👩‍🍳 요리 도움말을 준비하고 있습니다...',
          data: { intent }
        });
      } else if (intent === 'general_chat') {
        await streamingCallback({
          stage: 'general_chat',
          message: '💬 일반 대화를 처리하고 있습니다...',
          data: { intent }
        });
      }
      
      // 응답 생성
      await streamingCallback({
        stage: 'response_generation',
        message: '✨ 최종 응답을 생성하고 있습니다...',
        data: { intent, confidence: result.confidence }
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('워크플로우 실행 중 오류:', error);
      
      currentState.response = '처리 중 오류가 발생했습니다.';
      currentState.intent = 'unknown';
      currentState.confidence = 0;
      
      return currentState;
    }
  }

  /**
   * 워크플로우 재시작
   */
  async restartWorkflow(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('🔄 Restarting simple workflow...');
      this.initializeWorkflow();
      
      return {
        success: true,
        message: 'Simple workflow restarted successfully'
      };
    } catch (error) {
      this.logger.error('Failed to restart workflow:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error during restart'
      };
    }
  }

  /**
   * 워크플로우 통계 조회
   */
  async getWorkflowStats(): Promise<{
    totalQueries: number;
    avgProcessingTime: number;
    intentDistribution: Record<string, number>;
    cacheHitRate: number;
    uptime: number;
  }> {
    // 실제 환경에서는 메트릭 수집 시스템과 연동
    return {
      totalQueries: 0, // 임시값
      avgProcessingTime: 0, // 임시값
      intentDistribution: {
        recipe_search: 0,
        cooking_help: 0,
        general_chat: 0,
        unknown: 0,
      },
      cacheHitRate: 0, // 임시값
      uptime: process.uptime(),
    };
  }
}