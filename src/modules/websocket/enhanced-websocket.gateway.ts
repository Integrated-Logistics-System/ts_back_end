// 향상된 WebSocket 게이트웨이 - 스트리밍 최적화 적용
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { AuthService } from '../auth/auth.service';
import { StreamingOptimizationService } from './streaming-optimization.service';
import { AdvancedRAGService } from '../rag/advanced-rag.service';
import { KoreanRAGService } from '../rag/korean-rag.service';
import { UserPersonalizationService } from '../user/user-personalization.service';
import { LangGraphService } from '../langgraph/langgraph.service';

interface EnhancedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  streamingSession?: {
    sessionId: string;
    quality: 'excellent' | 'good' | 'poor' | 'critical';
    config: any;
  };
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8, // 100MB
  allowEIO3: true
})
export class EnhancedWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(EnhancedWebSocketGateway.name);
  private readonly connectedClients = new Map<string, EnhancedSocket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly streamingOptimization: StreamingOptimizationService,
    private readonly advancedRAGService: AdvancedRAGService,
    private readonly koreanRAGService: KoreanRAGService,
    private readonly personalizationService: UserPersonalizationService,
    private readonly langGraphService: LangGraphService,
  ) {}

  afterInit(server: Server) {
    const websocketPort = process.env.WEBSOCKET_PORT || 8083;
    this.logger.log(`🚀 Enhanced WebSocket Gateway initialized with streaming optimization on port ${websocketPort}`);
    
    // 서버 레벨 최적화 설정
    server.engine.on('connection_error', (err) => {
      this.logger.error('WebSocket connection error:', err);
    });
  }

  async handleConnection(client: EnhancedSocket) {
    const clientId = client.id;
    this.logger.log(`🔌 [${clientId}] Enhanced connection established`);

    try {
      const token = this.extractToken(client);
      
      if (token) {
        const user = await this.authenticateUser(token);
        if (user) {
          await this.setupAuthenticatedConnection(client, user);
        } else {
          await this.setupAnonymousConnection(client);
        }
      } else {
        await this.setupAnonymousConnection(client);
      }

      // 스트리밍 최적화 초기화
      await this.initializeStreamingOptimization(client);

    } catch (error) {
      this.logger.error(`❌ [${clientId}] Connection setup error:`, error);
      this.handleConnectionError(client, error);
    }
  }

  handleDisconnect(client: EnhancedSocket) {
    const clientId = client.id;
    
    // 스트리밍 세션 정리
    if (client.streamingSession) {
      this.streamingOptimization.endOptimizedStream(client.streamingSession.sessionId);
    }

    this.connectedClients.delete(clientId);

    if (client.user) {
      this.logger.log(`🔌 [${clientId}] Enhanced user disconnected: ${client.user.email}`);
    } else {
      this.logger.log(`🔌 [${clientId}] Enhanced anonymous client disconnected`);
    }
  }

  /**
   * LangGraph 기반 스마트 레시피 대화 (상태 기반 워크플로우)
   */
  @SubscribeMessage('smartRecipeChat')
  async handleSmartRecipeChat(
    @ConnectedSocket() client: EnhancedSocket,
    @MessageBody() data: { 
      message: string; 
      conversationHistory?: Array<{role: string, content: string}>; 
      sessionId?: string;
      userId?: string;
      userStatus?: string; // 사용자 개인 상태 정보
      streamingEnabled?: boolean;
    }
  ): Promise<void> {
    const userId = data.userId || client.user?.id;
    if (!userId) {
      client.emit('error', { message: '인증이 필요합니다.' });
      return;
    }

    const sessionId = data.sessionId || `smart_recipe_chat_${Date.now()}_${userId}`;
    
    this.logger.log(`🤖 LangGraph 스마트 레시피 대화 시작: ${data.message.substring(0, 50)}...`);

    try {
      // 스트리밍 최적화 시작
      await this.streamingOptimization.startOptimizedStream(sessionId, userId, client, {
        targetLatency: 200,
        compressionLevel: 'adaptive',
        bufferSize: 8,
        adaptationSpeed: 'medium',
      });

      const startTime = Date.now();

      // 초기 상태 전송
      await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
        type: 'json',
        data: {
          type: 'workflow_started',
          message: '🧠 AI가 의도를 분석하고 있습니다...',
          timestamp: Date.now(),
        },
        priority: 'high',
      });

      // LangGraph 워크플로우 실행
      const workflowResult = await this.langGraphService.executeStreamingWorkflow({
        query: data.message,
        userId,
        userStatus: data.userStatus,
        conversationHistory: data.conversationHistory || [],
        streamingCallback: async (chunk: any) => {
          // 워크플로우 중간 결과를 실시간으로 스트리밍
          await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
            type: 'json',
            data: {
              type: 'workflow_progress',
              stage: chunk.stage,
              message: chunk.message,
              data: chunk.data,
              timestamp: Date.now(),
            },
            priority: 'high',
          });
        }
      });

      // 최종 응답을 청크로 나누어 스트리밍
      const responseChunks = this.splitResponseIntoChunks(workflowResult.response);
      
      for (let i = 0; i < responseChunks.length; i++) {
        const chunk = responseChunks[i];
        const isLast = i === responseChunks.length - 1;

        await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
          type: 'text',
          data: {
            type: 'final_response',
            content: chunk,
            isComplete: isLast,
            chunkIndex: i,
            totalChunks: responseChunks.length,
            // 마지막 청크에만 메타데이터 포함
            ...(isLast && {
              intent: workflowResult.intent,
              confidence: workflowResult.confidence,
              metadata: workflowResult.metadata,
              totalTime: Date.now() - startTime,
            }),
          },
          priority: 'high',
          metadata: {
            sessionId,
            userId,
            query: data.message,
            timestamp: Date.now(),
          },
        });

        // 자연스러운 타이핑 효과
        if (!isLast) {
          await new Promise(resolve => setTimeout(resolve, 60));
        }
      }

      // 완료 상태 전송
      await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
        type: 'json',
        data: {
          type: 'workflow_completed',
          message: '✅ 워크플로우가 완료되었습니다.',
          timestamp: Date.now(),
          totalTime: Date.now() - startTime,
          nodeExecutionOrder: workflowResult.metadata.nodeExecutionOrder,
        },
        priority: 'low',
      });

      this.logger.log(`🤖 LangGraph 워크플로우 완료: ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error('LangGraph 워크플로우 처리 실패:', error);
      
      await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
        type: 'json',
        data: {
          type: 'workflow_error',
          message: '죄송합니다. 요청을 처리하는 중 오류가 발생했습니다.',
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          timestamp: Date.now(),
        },
        priority: 'high',
      });
    }
  }

  /**
   * 한글 대화형 벡터 검색 (Vector-based RAG Chat)
   */
  @SubscribeMessage('koreanVectorChat')
  async handleKoreanVectorChat(
    @ConnectedSocket() client: EnhancedSocket,
    @MessageBody() data: { 
      message: string; 
      conversationHistory?: Array<{role: string, content: string}>; 
      sessionId?: string;
      userId?: string;
      useVectorSearch?: boolean;
      searchParams?: {
        k?: number;
        minScore?: number;
        allergies?: string[];
        preferences?: string[];
      };
    }
  ): Promise<void> {
    const userId = data.userId || client.user?.id;
    if (!userId) {
      client.emit('error', { message: '인증이 필요합니다.' });
      return;
    }

    const sessionId = data.sessionId || `korean_vector_chat_${Date.now()}_${userId}`;
    
    this.logger.log(`🇰🇷 한글 벡터 검색 대화 시작: ${data.message.substring(0, 50)}...`);

    try {
      // 스트리밍 최적화 시작
      await this.streamingOptimization.startOptimizedStream(sessionId, userId, client, {
        targetLatency: 150,
        compressionLevel: 'adaptive',
        bufferSize: 6,
        adaptationSpeed: 'medium',
      });

      const startTime = Date.now();

      // 1. 의도 분석 및 벡터 검색 수행
      const vectorSearchEnabled = data.useVectorSearch !== false;
      let searchResults: any[] = [];
      
      if (vectorSearchEnabled) {
        // 메시지 전송: 검색 중
        await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
          type: 'json',
          data: {
            type: 'status',
            status: 'searching',
            message: '🔍 레시피를 검색하고 있습니다...',
            timestamp: Date.now(),
          },
          priority: 'high',
        });

        // 벡터 검색 실행
        const vectorSearchResults = await this.performKoreanVectorSearch(data.message, {
          k: data.searchParams?.k || 8,
          minScore: data.searchParams?.minScore || 0.3,
          allergies: data.searchParams?.allergies || [],
          preferences: data.searchParams?.preferences || [],
          userId,
        });

        searchResults = vectorSearchResults.results || [];

        // 검색 결과 스트리밍
        if (searchResults.length > 0) {
          await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
            type: 'json',
            data: {
              type: 'search_results',
              status: 'found',
              count: searchResults.length,
              results: searchResults.slice(0, 3), // 상위 3개만 먼저 전송
              searchTime: vectorSearchResults.searchTime,
            },
            priority: 'high',
          });
        }
      }

      // 2. RAG 컨텍스트 구성
      const ragContext = {
        query: data.message,
        userId,
        conversationHistory: data.conversationHistory || [],
        contextType: 'recipe_search' as const,
        maxResults: 8,
        includeNutrition: true,
        includeAlternatives: true,
        searchResults, // 벡터 검색 결과 포함
      };

      // 메시지 전송: AI 응답 생성 중
      await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
        type: 'json',
        data: {
          type: 'status',
          status: 'generating',
          message: '🤖 AI가 답변을 생성하고 있습니다...',
          timestamp: Date.now(),
        },
        priority: 'high',
      });

      // 3. 한국어 RAG 처리
      const ragResult = await this.koreanRAGService.processKoreanRAG(ragContext);

      // 4. 응답을 청크로 나누어 스트리밍 전송
      const responseChunks = this.splitResponseIntoChunks(ragResult.response);
      
      for (let i = 0; i < responseChunks.length; i++) {
        const chunk = responseChunks[i];
        const isLast = i === responseChunks.length - 1;

        await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
          type: 'text',
          data: {
            type: 'chat_response',
            content: chunk,
            isComplete: isLast,
            chunkIndex: i,
            totalChunks: responseChunks.length,
            // 마지막 청크에만 메타데이터 포함
            ...(isLast && {
              sources: ragResult.sources,
              confidence: ragResult.confidence,
              reasoning: ragResult.reasoning,
              suggestions: ragResult.suggestions,
              searchResultsUsed: searchResults.length,
              totalTime: Date.now() - startTime,
            }),
          },
          priority: 'high',
          metadata: {
            sessionId,
            userId,
            query: data.message,
            timestamp: Date.now(),
          },
        });

        // 자연스러운 타이핑 효과를 위한 지연
        if (!isLast) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // 완료 상태 전송
      await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
        type: 'json',
        data: {
          type: 'status',
          status: 'completed',
          message: '✅ 응답이 완료되었습니다.',
          timestamp: Date.now(),
          totalTime: Date.now() - startTime,
        },
        priority: 'low',
      });

      this.logger.log(`🇰🇷 한글 벡터 검색 대화 완료: ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error('한글 벡터 검색 대화 처리 실패:', error);
      
      await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
        type: 'json',
        data: {
          type: 'error',
          message: '죄송합니다. 요청을 처리하는 중 오류가 발생했습니다.',
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          timestamp: Date.now(),
        },
        priority: 'high',
      });
    }
  }

  /**
   * 최적화된 RAG 스트리밍
   */
  @SubscribeMessage('optimized_rag_stream')
  async handleOptimizedRAGStream(
    @MessageBody() data: {
      query: string;
      contextType?: 'recipe_search' | 'cooking_help' | 'nutrition_advice' | 'general_chat';
      maxResults?: number;
      sessionId?: string;
    },
    @ConnectedSocket() client: EnhancedSocket,
  ) {
    if (!client.user) {
      client.emit('error', { message: '인증이 필요합니다.', timestamp: Date.now() });
      return;
    }

    const userId = client.user.id;
    const sessionId = data.sessionId || `rag_${Date.now()}_${userId}`;

    this.logger.log(`🌊 최적화된 RAG 스트리밍 시작: ${data.query} (사용자: ${userId})`);

    try {
      // 스트리밍 최적화 세션 시작
      await this.streamingOptimization.startOptimizedStream(sessionId, userId, client, {
        targetLatency: 50, // RAG는 낮은 지연시간 필요
        compressionLevel: 'high',
        bufferSize: 5,
      });

      // 사용자 행동 기록
      await this.personalizationService.recordUserBehavior({
        userId,
        actionType: 'search',
        targetId: data.query,
        targetType: 'search',
        context: {
          timeOfDay: this.getCurrentTimeOfDay(),
          deviceType: 'desktop', // TODO: 실제 디바이스 타입 감지
        },
      });

      // RAG 컨텍스트 구성
      const ragContext = {
        query: data.query,
        userId,
        contextType: data.contextType || 'recipe_search',
        maxResults: data.maxResults || 10,
        includeNutrition: true,
        includeAlternatives: true,
      };

      // 고급 RAG 처리
      const ragResult = await this.advancedRAGService.processAdvancedRAG(ragContext);

      // 응답을 청크로 나누어 최적화된 스트리밍 전송
      const responseChunks = this.splitResponseIntoChunks(ragResult.response);
      
      for (let i = 0; i < responseChunks.length; i++) {
        const chunk = responseChunks[i];
        const isLast = i === responseChunks.length - 1;

        await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
          type: 'text',
          data: {
            content: chunk,
            isComplete: isLast,
            chunkIndex: i,
            totalChunks: responseChunks.length,
            sources: isLast ? ragResult.sources : undefined,
            confidence: isLast ? ragResult.confidence : undefined,
            reasoning: isLast ? ragResult.reasoning : undefined,
            suggestions: isLast ? ragResult.suggestions : undefined,
          },
          priority: 'high',
          metadata: {
            sessionId,
            userId,
            query: data.query,
            timestamp: Date.now(),
          },
        });

        // 자연스러운 스트리밍을 위한 지연
        if (!isLast) {
          await this.delay(30 + Math.random() * 20);
        }
      }

      // 스트리밍 완료
      client.emit('optimized_rag_complete', {
        sessionId,
        totalChunks: responseChunks.length,
        metadata: ragResult.metadata,
        timestamp: Date.now(),
      });

      // 스트리밍 세션 종료
      await this.streamingOptimization.endOptimizedStream(sessionId);

    } catch (error) {
      this.logger.error(`최적화된 RAG 스트리밍 실패: ${userId}`, error);
      
      client.emit('optimized_rag_error', {
        sessionId,
        message: '응답 생성 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 적응형 개인화 추천 스트리밍
   */
  @SubscribeMessage('adaptive_personalization_stream')
  async handleAdaptivePersonalizationStream(
    @MessageBody() data: {
      preferences?: string[];
      context?: string;
      realtime?: boolean;
      sessionId?: string;
    },
    @ConnectedSocket() client: EnhancedSocket,
  ) {
    if (!client.user) {
      client.emit('error', { message: '인증이 필요합니다.', timestamp: Date.now() });
      return;
    }

    const userId = client.user.id;
    const sessionId = data.sessionId || `personalization_${Date.now()}_${userId}`;

    this.logger.log(`🎯 적응형 개인화 추천 스트리밍: ${userId}`);

    try {
      // 개인화 설정에 맞는 스트리밍 최적화
      await this.streamingOptimization.startOptimizedStream(sessionId, userId, client, {
        targetLatency: 100,
        compressionLevel: 'adaptive',
        bufferSize: 8,
        adaptationSpeed: 'fast',
      });

      // 개인화 프로필 생성/업데이트
      const profile = await this.personalizationService.generatePersonalizationProfile(userId);
      
      // 실시간 개인화 추천 생성
      const recommendations = await this.generatePersonalizedRecommendations(profile, data);
      
      // 추천을 우선순위별로 스트리밍
      for (const [index, recommendation] of recommendations.entries()) {
        const priority = index < 3 ? 'high' : index < 8 ? 'medium' : 'low';
        
        await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
          type: 'json',
          data: {
            recommendation,
            index,
            totalRecommendations: recommendations.length,
            personalizedScore: recommendation.personalizedScore,
            reasoning: recommendation.reasoning,
          },
          priority,
          metadata: {
            profileStrength: profile.metadata.profileStrength,
            confidenceScore: profile.metadata.confidenceScore,
          },
        });

        // 실시간 모드에서는 더 빠른 전송
        if (data.realtime) {
          await this.delay(50);
        } else {
          await this.delay(100 + Math.random() * 50);
        }
      }

      // 개인화 완료 알림
      client.emit('adaptive_personalization_complete', {
        sessionId,
        totalRecommendations: recommendations.length,
        profileMetadata: profile.metadata,
        timestamp: Date.now(),
      });

      await this.streamingOptimization.endOptimizedStream(sessionId);

    } catch (error) {
      this.logger.error(`적응형 개인화 스트리밍 실패: ${userId}`, error);
      
      client.emit('adaptive_personalization_error', {
        sessionId,
        message: '개인화 추천 생성 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 스트리밍 품질 모니터링
   */
  @SubscribeMessage('streaming_quality_monitor')
  async handleStreamingQualityMonitor(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: EnhancedSocket,
  ) {
    try {
      const qualityInfo = await this.streamingOptimization.monitorStreamingQuality(data.sessionId);
      
      client.emit('streaming_quality_report', {
        sessionId: data.sessionId,
        quality: qualityInfo.quality,
        metrics: qualityInfo.metrics,
        recommendations: qualityInfo.recommendations,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`스트리밍 품질 모니터링 실패: ${data.sessionId}`, error);
    }
  }

  /**
   * 동적 대역폭 조정
   */
  @SubscribeMessage('adjust_bandwidth')
  async handleAdjustBandwidth(
    @MessageBody() data: { sessionId: string; targetBandwidth: number },
    @ConnectedSocket() client: EnhancedSocket,
  ) {
    try {
      await this.streamingOptimization.adjustBandwidth(data.sessionId, data.targetBandwidth);
      
      client.emit('bandwidth_adjustment_complete', {
        sessionId: data.sessionId,
        targetBandwidth: data.targetBandwidth,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`대역폭 조정 실패: ${data.sessionId}`, error);
    }
  }

  /**
   * 시스템 스트리밍 메트릭 조회
   */
  @SubscribeMessage('get_streaming_metrics')
  async handleGetStreamingMetrics(@ConnectedSocket() client: EnhancedSocket) {
    if (!client.user) {
      client.emit('error', { message: '인증이 필요합니다.', timestamp: Date.now() });
      return;
    }

    try {
      const metrics = this.streamingOptimization.getSystemStreamingMetrics();
      
      client.emit('streaming_metrics_response', {
        metrics,
        serverStats: {
          totalConnections: this.connectedClients.size,
          authenticatedUsers: this.getAuthenticatedUsersCount(),
          anonymousUsers: this.getAnonymousUsersCount(),
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error('스트리밍 메트릭 조회 실패:', error);
      client.emit('error', { 
        message: '메트릭 조회 실패', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now() 
      });
    }
  }

  /**
   * 캐시된 스트리밍 응답
   */
  @SubscribeMessage('cached_stream_request')
  async handleCachedStreamRequest(
    @MessageBody() data: { cacheKey: string; query?: string },
    @ConnectedSocket() client: EnhancedSocket,
  ) {
    if (!client.user) {
      client.emit('error', { message: '인증이 필요합니다.', timestamp: Date.now() });
      return;
    }

    const userId = client.user.id;
    const sessionId = `cached_${Date.now()}_${userId}`;

    try {
      await this.streamingOptimization.startOptimizedStream(sessionId, userId, client);

      const cachedStream = await this.streamingOptimization.getCachedStream(
        data.cacheKey,
        (async function* (self: any) {
          // 실제 스트림 생성 로직 (예: RAG)
          if (data.query) {
            const ragContext = {
              query: data.query,
              userId,
              contextType: 'recipe_search' as const,
            };
            const result = await self.advancedRAGService.processAdvancedRAG(ragContext);
            const chunks = self.splitResponseIntoChunks(result.response);
            for (const chunk of chunks) {
              yield { content: chunk, timestamp: Date.now() };
            }
          }
        }).bind(null, this)
      );

      for await (const chunk of cachedStream) {
        await this.streamingOptimization.sendAdaptiveChunk(sessionId, {
          type: 'text',
          data: chunk,
          priority: 'medium',
        });
        await this.delay(50);
      }

      client.emit('cached_stream_complete', {
        sessionId,
        cacheKey: data.cacheKey,
        timestamp: Date.now(),
      });

      await this.streamingOptimization.endOptimizedStream(sessionId);

    } catch (error) {
      this.logger.error(`캐시된 스트림 요청 실패: ${data.cacheKey}`, error);
      client.emit('cached_stream_error', {
        sessionId,
        cacheKey: data.cacheKey,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    }
  }

  // ==================== Korean Vector Search Helper ====================

  /**
   * 한글 벡터 검색 실행
   */
  private async performKoreanVectorSearch(query: string, options: {
    k: number;
    minScore: number;
    allergies: string[];
    preferences: string[];
    userId: string;
  }): Promise<{ results: any[]; searchTime: number; }> {
    try {
      const startTime = Date.now();
      
      // RecipeSearchService의 vectorSearch 메소드 사용
      const vectorSearchResult = await this.advancedRAGService.performVectorSearch({
        query,
        k: options.k,
        vectorWeight: 0.7,
        textWeight: 0.3,
        useHybridSearch: true,
        minScore: options.minScore,
        allergies: options.allergies,
        preferences: options.preferences,
      });

      const searchTime = Date.now() - startTime;
      
      this.logger.log(`🔍 벡터 검색 완료: ${vectorSearchResult.results?.length || 0}개 결과, ${searchTime}ms`);
      
      return {
        results: vectorSearchResult.results || [],
        searchTime,
      };
      
    } catch (error) {
      this.logger.error('벡터 검색 실패:', error);
      return { results: [], searchTime: 0 };
    }
  }

  // Private helper methods
  private async initializeStreamingOptimization(client: EnhancedSocket): Promise<void> {
    // 클라이언트별 스트리밍 최적화 설정
    const clientCapabilities = this.detectClientCapabilities(client);
    
    client.emit('streaming_optimization_ready', {
      capabilities: clientCapabilities,
      optimizations: {
        adaptiveBitrate: true,
        compressionSupport: true,
        priorityQueuing: true,
        bandwidthDetection: true,
      },
      timestamp: Date.now(),
    });
  }

  private detectClientCapabilities(client: EnhancedSocket): any {
    // 클라이언트 성능 감지 로직
    const userAgent = client.handshake.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    
    return {
      deviceType: isMobile ? 'mobile' : 'desktop',
      compressionSupport: true,
      maxBandwidth: isMobile ? 512000 : 2048000, // bytes/s
      preferredLatency: isMobile ? 200 : 100, // ms
    };
  }

  private splitResponseIntoChunks(response: string): string[] {
    // 자연스러운 청크 분할
    const sentences = response.split(/([.!?]\s+)/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > 200) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        }
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  private async generatePersonalizedRecommendations(profile: any, data: any): Promise<any[]> {
    // 개인화 추천 생성 로직
    // 실제로는 ElasticSearch + AI를 통한 복잡한 추천 알고리즘
    const mockRecommendations = [];
    
    for (let i = 0; i < 10; i++) {
      mockRecommendations.push({
        id: `rec_${i}`,
        title: `개인화 추천 레시피 ${i + 1}`,
        description: `사용자 선호도를 반영한 맞춤 레시피`,
        personalizedScore: Math.random() * 0.3 + 0.7, // 0.7-1.0
        reasoning: `프로필 기반 ${Math.round(profile.metadata.profileStrength)}% 일치`,
        tags: ['개인화', '추천'],
        difficulty: 'medium',
        cookingTime: 30,
      });
    }

    return mockRecommendations;
  }

  private getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private extractToken(client: EnhancedSocket): string | null {
    return (client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1] ||
        client.handshake.query?.token) as string | null;
  }

  private async authenticateUser(token: string) {
    try {
      const user = await this.authService.authenticateByToken(token);
      if (user) {
        return user;
      }

      const payload = this.jwtService.verify(token) as { sub?: string; userId?: string };
      const userId = payload.sub || payload.userId;
      if (!userId) return null;

      return await this.userService.findById(userId);
    } catch (error) {
      this.logger.warn('인증 실패:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private async setupAuthenticatedConnection(client: EnhancedSocket, user: any): Promise<void> {
    client.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    this.connectedClients.set(client.id, client);

    const roomId = `user:${user.id}`;
    await client.join(roomId);

    this.logger.log(`✅ [${client.id}] Enhanced authenticated connection: ${user.email}`);

    client.emit('enhanced_connection_status', {
      authenticated: true,
      message: 'Enhanced WebSocket connection established',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      clientId: client.id,
      features: [
        'optimized_rag_stream',
        'adaptive_personalization_stream',
        'streaming_quality_monitor',
        'adjust_bandwidth',
        'cached_stream_request',
      ],
      optimizations: {
        enabled: true,
        adaptiveBitrate: true,
        compression: true,
        priorityQueue: true,
      },
      timestamp: Date.now(),
    });
  }

  private async setupAnonymousConnection(client: EnhancedSocket): Promise<void> {
    this.connectedClients.set(client.id, client);

    client.emit('enhanced_connection_status', {
      authenticated: false,
      message: 'Enhanced anonymous connection established',
      clientId: client.id,
      features: ['basic_streaming', 'public_recommendations'],
      optimizations: {
        enabled: true,
        adaptiveBitrate: false,
        compression: true,
        priorityQueue: false,
      },
      timestamp: Date.now(),
    });
  }

  private handleConnectionError(client: EnhancedSocket, error: unknown): void {
    client.emit('enhanced_connection_error', {
      message: 'Enhanced connection setup failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: client.id,
      timestamp: Date.now(),
    });
  }

  private getAuthenticatedUsersCount(): number {
    return Array.from(this.connectedClients.values()).filter(client => client.user).length;
  }

  private getAnonymousUsersCount(): number {
    return Array.from(this.connectedClients.values()).filter(client => !client.user).length;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}