import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from '../../langgraph/langgraph.service';
import {
  AuthenticatedSocket,
  LangGraphEventData,
  BenchmarkResult,
  StreamingResponse,
  WebSocketError,
} from '../interfaces/websocket.interface';
import {
  WEBSOCKET_EVENTS,
  SYSTEM_INFO,
  ERROR_CODES,
  ERROR_MESSAGES,
  WEBSOCKET_CONFIG,
} from '../constants/websocket.constants';

@Injectable()
export class LangGraphHandler {
  private readonly logger = new Logger(LangGraphHandler.name);

  constructor(private readonly langGraphService: LangGraphService) {}

  /**
   * LangGraph 레시피 생성 처리 (v2)
   */
  async handleRecipeRequest(
    socket: AuthenticatedSocket,
    data: LangGraphEventData
  ): Promise<void> {
    const startTime = Date.now();
    let hasError = false;

    try {
      this.logger.log(`Processing LangGraph recipe request for user: ${socket.user?.id}`);

      // 요청 검증
      this.validateRecipeRequest(data);

      // 초기 응답
      socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_RESPONSE, this.createStartResponse());

      // LangGraph 요청 생성
      const langGraphRequest = this.buildLangGraphRequest(data, socket);

      // 스트리밍 처리
      await this.processLangGraphStream(
        socket,
        langGraphRequest,
        WEBSOCKET_EVENTS.LANGGRAPH_RESPONSE
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`LangGraph recipe request completed in ${processingTime}ms`);

    } catch (error) {
      hasError = true;
      this.logger.error('LangGraph recipe request failed:', error);
      
      const errorResponse = this.createErrorResponse(error, startTime);
      socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_ERROR, errorResponse);
    }
  }

  /**
   * LangGraph RAG 검색 처리 (v2)
   */
  async handleRAGRequest(
    socket: AuthenticatedSocket,
    data: LangGraphEventData
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(`Processing LangGraph RAG request for user: ${socket.user?.id}`);

      // 요청 검증
      this.validateRAGRequest(data);

      // 초기 응답
      socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_RESPONSE, 
        this.createRAGStartResponse()
      );

      // RAG 요청 생성
      const ragRequest = this.buildRAGRequest(data, socket);

      // 스트리밍 처리
      await this.processLangGraphStream(
        socket,
        ragRequest,
        WEBSOCKET_EVENTS.LANGGRAPH_RESPONSE
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`LangGraph RAG request completed in ${processingTime}ms`);

    } catch (error) {
      this.logger.error('LangGraph RAG request failed:', error);
      
      const errorResponse = this.createErrorResponse(error, startTime);
      socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_ERROR, errorResponse);
    }
  }

  /**
   * LangGraph 벤치마크 처리
   */
  async handleBenchmarkRequest(
    socket: AuthenticatedSocket,
    data: LangGraphEventData
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(`Processing LangGraph benchmark for user: ${socket.user?.id}`);

      // 벤치마크 요청 검증
      this.validateBenchmarkRequest(data);

      const { iterations = 1, queries = [] } = data;
      const results: BenchmarkResult[] = [];

      // 벤치마크 시작 알림
      socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_RESPONSE, {
        message: `벤치마크 시작: ${iterations}번 반복, ${queries.length}개 쿼리`,
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          totalIterations: iterations,
          totalQueries: queries.length,
        },
      });

      // 각 반복 실행
      for (let i = 0; i < iterations; i++) {
        for (let j = 0; j < queries.length; j++) {
          const query = queries[j];
          if (!query || typeof query !== 'string') {
            continue; // Skip invalid queries
          }
          const iterationStart = Date.now();

          try {
            // 진행 상황 알림
            socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_RESPONSE, {
              message: `반복 ${i + 1}/${iterations}, 쿼리 ${j + 1}/${queries.length}: "${query}"`,
              timestamp: Date.now(),
              version: SYSTEM_INFO.VERSION,
            });

            // LangGraph 요청 실행
            const request = this.buildBenchmarkRequest(query, socket);
            const response = await this.executeBenchmarkQuery(request);

            const iterationTime = Date.now() - iterationStart;

            // 결과 저장
            const result: BenchmarkResult = {
              iteration: i + 1,
              query,
              totalTime: iterationTime,
              metadata: response.metadata || {},
              hasGeneratedRecipe: !!response.response,
              responseLength: response.response?.length || 0,
              timestamp: Date.now(),
              userId: socket.user?.id || 'unknown',
              success: true,
            };

            results.push(result);

            // 중간 결과 전송
            socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_RESPONSE, {
              message: `완료: ${iterationTime}ms`,
              timestamp: Date.now(),
              version: SYSTEM_INFO.VERSION,
              metadata: result,
            });

          } catch (error) {
            const iterationTime = Date.now() - iterationStart;
            
            const errorResult: BenchmarkResult = {
              iteration: i + 1,
              query,
              totalTime: iterationTime,
              metadata: {},
              hasGeneratedRecipe: false,
              responseLength: 0,
              timestamp: Date.now(),
              userId: socket.user?.id || 'unknown',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };

            results.push(errorResult);

            socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_RESPONSE, {
              message: `오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: Date.now(),
              version: SYSTEM_INFO.VERSION,
              error: true,
            });
          }
        }
      }

      // 최종 결과 전송
      const totalTime = Date.now() - startTime;
      const successRate = results.filter(r => r.success).length / results.length;
      const avgTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;

      socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_RESPONSE, {
        message: `벤치마크 완료! 총 시간: ${totalTime}ms, 성공률: ${(successRate * 100).toFixed(1)}%, 평균 응답시간: ${avgTime.toFixed(0)}ms`,
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          totalTime,
          successRate,
          averageTime: avgTime,
          results,
          completed: true,
        },
      });

      this.logger.log(`Benchmark completed: ${results.length} tests, ${(successRate * 100).toFixed(1)}% success rate`);

    } catch (error) {
      this.logger.error('LangGraph benchmark failed:', error);
      
      const errorResponse = this.createErrorResponse(error, startTime);
      socket.emit(WEBSOCKET_EVENTS.LANGGRAPH_ERROR, errorResponse);
    }
  }

  // ==================== Private Helper Methods ====================

  private validateRecipeRequest(data: LangGraphEventData): void {
    if (!data.query || data.query.trim().length === 0) {
      throw this.createValidationError('query', 'Query is required');
    }

    if (data.query.length > WEBSOCKET_CONFIG.MAX_QUERY_LENGTH) {
      throw this.createValidationError('query', 'Query too long');
    }
  }

  private validateRAGRequest(data: LangGraphEventData): void {
    if (!data.query || data.query.trim().length === 0) {
      throw this.createValidationError('query', 'Query is required');
    }

    if (data.query.length > WEBSOCKET_CONFIG.MAX_QUERY_LENGTH) {
      throw this.createValidationError('query', 'Query too long');
    }
  }

  private validateBenchmarkRequest(data: LangGraphEventData): void {
    if (!data.queries || !Array.isArray(data.queries)) {
      throw this.createValidationError('queries', 'Queries array is required');
    }

    if (data.queries.length === 0) {
      throw this.createValidationError('queries', 'At least one query is required');
    }

    if (data.queries.length > 10) {
      throw this.createValidationError('queries', 'Maximum 10 queries allowed');
    }

    const iterations = data.iterations || 1;
    if (iterations < 1 || iterations > 10) {
      throw this.createValidationError('iterations', 'Iterations must be between 1 and 10');
    }
  }

  private buildLangGraphRequest(data: LangGraphEventData, socket: AuthenticatedSocket): any {
    return {
      query: data.query,
      userId: socket.user?.id,
      conversationContext: {
        allergies: data.allergies || [],
        preferences: data.preferences || [],
        userLevel: 'intermediate', // 기본값
      },
      options: {
        streaming: true,
        maxResults: 3,
      },
    };
  }

  private buildRAGRequest(data: LangGraphEventData, socket: AuthenticatedSocket): any {
    return {
      query: data.query,
      userId: socket.user?.id,
      conversationContext: {
        allergies: data.allergies || [],
        preferences: data.preferences || [],
      },
      options: {
        streaming: true,
        ragOnly: true,
      },
    };
  }

  private buildBenchmarkRequest(query: string, socket: AuthenticatedSocket): any {
    return {
      query,
      userId: socket.user?.id,
      conversationContext: {
        allergies: [],
        preferences: [],
      },
      options: {
        streaming: false,
        benchmark: true,
      },
    };
  }

  private async processLangGraphStream(
    socket: AuthenticatedSocket,
    request: any,
    responseEvent: string
  ): Promise<void> {
    try {
      const langGraphStream = this.langGraphService.processRAGRequestStream(request);

      for await (const chunk of langGraphStream) {
        if (chunk.content?.trim()) {
          const response: StreamingResponse = {
            id: `stream_${Date.now()}`,
            type: 'chunk',
            content: chunk.content,
            metadata: chunk.metadata,
          };

          socket.emit(responseEvent, {
            message: chunk.content,
            timestamp: Date.now(),
            version: SYSTEM_INFO.VERSION,
            metadata: chunk.metadata,
            streaming: true,
          });
        }
      }

      // 스트림 완료
      socket.emit(responseEvent, {
        message: '',
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        completed: true,
      });

    } catch (error) {
      this.logger.error('LangGraph stream processing failed:', error);
      throw error;
    }
  }

  private async executeBenchmarkQuery(request: any): Promise<any> {
    return await this.langGraphService.processRAGRequest(request);
  }

  private createStartResponse(): any {
    return {
      message: '레시피 검색을 시작합니다... 🍳',
      timestamp: Date.now(),
      version: SYSTEM_INFO.VERSION,
    };
  }

  private createRAGStartResponse(): any {
    return {
      message: 'RAG 검색을 시작합니다... 🔍',
      timestamp: Date.now(),
      version: SYSTEM_INFO.VERSION,
    };
  }

  private createErrorResponse(error: any, startTime: number): any {
    const processingTime = Date.now() - startTime;
    
    return {
      message: error instanceof Error ? error.message : 'LangGraph 처리 중 오류가 발생했습니다.',
      timestamp: Date.now(),
      version: SYSTEM_INFO.VERSION,
      error: true,
      processingTime,
      details: error instanceof Error ? error.stack : undefined,
    };
  }

  private createValidationError(field: string, message: string): WebSocketError {
    return {
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
      message: `${field}: ${message}`,
      details: { field, validation: message },
      timestamp: Date.now(),
    };
  }
}