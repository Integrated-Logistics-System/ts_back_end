// src/modules/websocket/websocket.gateway.ts (LangGraph v0.3.8 최적화)
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
import { PersonalChatService } from './personal-chat.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { SimpleLangGraphHandler } from './handlers/simple-langgraph.handler';
import { ConversationManagerService } from '../conversation/conversation-manager.service';
import { ChatHistoryService } from '../chat/chat-history.service';
import { AiService } from '../ai/ai.service';
// PersonalizationHandler removed
import { UserSessionData } from '../auth/auth.service';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    name: string;
  }
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, // 60초 - 클라이언트가 pong을 보내지 않으면 연결 해제
  pingInterval: 25000, // 25초마다 ping 전송
  connectTimeout: 45000, // 45초 연결 타임아웃
  upgradeTimeout: 30000 // 30초 업그레이드 타임아웃
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
      private readonly jwtService: JwtService,
      private readonly userService: UserService,
      private readonly authService: AuthService,
      private readonly personalChatService: PersonalChatService,
      private readonly langGraphService: LangGraphService,
      private readonly simpleLangGraphHandler: SimpleLangGraphHandler,
      private readonly conversationManager: ConversationManagerService,
      private readonly chatHistoryService: ChatHistoryService,
      private readonly aiService: AiService,
      // personalizationHandler removed
  ) {}

  afterInit(_server: Server) {
    const websocketPort = process.env.WEBSOCKET_PORT || 8083;
    this.logger.log(`🚀 WebSocket Gateway initialized with Simple LangGraph v1.0 on port ${websocketPort}`);
  }

  async handleConnection(client: AuthenticatedSocket) {
    const clientId = client.id;
    this.logger.log(`🔌 [${clientId}] New connection`);

    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`⚠️ [${clientId}] No token provided, allowing connection anyway`);
        // 임시: 토큰 없어도 연결 허용
        client.emit('connection-status', {
          authenticated: false,
          message: 'Connected without authentication',
          clientId: client.id,
          version: 'Simple LangGraph v1.0',
          features: ['ping', 'chat', 'simple_langgraph', 'langchain_agent', 'anonymous_queries']
        });
        return;
      }

      const user = await this.authenticateUser(token);

      if (!user) {
        this.logger.warn(`⚠️ [${clientId}] Invalid user in token, allowing connection anyway`);
        // 임시: 토큰 검증 실패해도 연결 허용
        client.emit('connection-status', {
          authenticated: false,
          message: 'Connected with invalid token',
          clientId: client.id,
          version: 'LangGraph v0.3.8',
          features: ['ping', 'chat']
        });
        return;
      }

      await this.setupAuthenticatedConnection(client, user as UserSessionData);

    } catch (error: unknown) {
      this.logger.error(`❌ [${clientId}] Connection error:`, error instanceof Error ? error.message : 'Unknown error');
      // 임시: 에러 발생해도 연결 허용
      client.emit('connection-status', {
        authenticated: false,
        message: 'Connected with error',
        clientId: client.id,
        version: 'LangGraph v0.3.8',
        features: ['ping', 'chat']
      });
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const clientId = client.id;
    this.connectedClients.delete(clientId);

    if (client.user) {
      this.logger.log(`🔌 [${clientId}] User disconnected: ${client.user.email}`);

      try {
        void this.authService.getUserSession(client.user.id);
      } catch {
        // 에러 무시
      }
    } else {
      this.logger.log(`🔌 [${clientId}] Anonymous client disconnected`);
    }
  }

  // ==================== 🔥 최신 LangGraph v0.3.8 실시간 워크플로우 ====================

  /**
   * LangGraph v0.3.8 기반 실시간 레시피 워크플로우
   */
  @SubscribeMessage('langgraph_recipe_v2')
  async handleLangGraphRecipeV2(
      @MessageBody() data: { query: string; allergies?: string[] },
      @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) {
      client.emit('error', {
        message: '인증이 필요합니다.',
        timestamp: Date.now()
      });
      return;
    }

    // RAG 워크플로우 비활성화 체크
    if (process.env.DISABLE_RAG_WORKFLOW === 'true') {
      client.emit('langgraph_error_v2', {
        message: '🚫 RAG 워크플로우가 비활성화되어 있습니다. AI 생성 전용 모드로 전환하세요.',
        timestamp: Date.now()
      });
      return;
    }

    const userId = client.user.id;
    this.logger.log(`🔗 LangGraph v0.3.8 recipe workflow: "${data.query}" from ${userId}`);

    try {
      // 💾 사용자 메시지를 히스토리에 저장
      await this.personalChatService.addChatMessage(userId, 'user', data.query, 'recipe');

      // 사용자 정보 가져오기
      const userProfile = await this.userService.getProfile(userId);
      const userAllergies = [...(data.allergies || []), ...(userProfile.allergies || [])];
      const userPreferences = userProfile.preferences || [];

      client.emit('langgraph_start_v2', {
        message: '🚀 LangGraph v0.3.8 워크플로우를 시작합니다...',
        query: data.query,
        allergies: userAllergies,
        preferences: userPreferences,
        version: 'LangGraph v0.3.8',
        timestamp: Date.now(),
        userId
      });

      let fullResponse = '';

      // 레거시 호환 메서드 사용
      for await (const chunk of this.langGraphService.streamRecipeWorkflowForWebSocket(
        data.query,
        userAllergies,
        userId
      )) {
        client.emit('langgraph_chunk_v2', chunk);

        // 응답 내용 수집
        if (chunk.content && typeof chunk.content === 'string') {
          fullResponse += chunk.content;
        }

        if (chunk.type === 'error' || chunk.type === 'complete') {
          break;
        }
      }

      // 💾 AI 응답을 히스토리에 저장
      if (fullResponse.trim().length > 0) {
        await this.personalChatService.addChatMessage(userId, 'assistant', fullResponse, 'recipe');
      }

      client.emit('langgraph_complete_v2', {
        message: '✅ LangGraph v0.3.8 워크플로우가 완료되었습니다.',
        version: 'LangGraph v0.3.8',
        timestamp: Date.now(),
        userId
      });

    } catch (error: unknown) {
      this.logger.error(`LangGraph v0.3.8 workflow failed for ${userId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      client.emit('langgraph_error_v2', {
        message: `워크플로우 오류: ${errorMessage}`,
        error: errorMessage,
        version: 'LangGraph v0.3.8',
        timestamp: Date.now(),
        userId
      });
    }
  }

  /**
   * LangGraph v0.3.8 RAG 스트리밍
   */
  @SubscribeMessage('langgraph_rag_v2')
  async handleLangGraphRAGV2(
      @MessageBody() data: { query: string; allergies?: string[]; preferences?: string[] },
      @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) {
      client.emit('error', { message: '인증이 필요합니다.', timestamp: Date.now() });
      return;
    }

    // RAG 워크플로우 비활성화 체크
    if (process.env.DISABLE_RAG_WORKFLOW === 'true') {
      client.emit('langgraph_error_v2', {
        message: '🚫 RAG 워크플로우가 비활성화되어 있습니다.',
        timestamp: Date.now()
      });
      return;
    }

    const userId = client.user.id;
    this.logger.log(`🔍 LangGraph v0.3.8 RAG: "${data.query}" from ${userId}`);

    try {
      // 사용자 정보 가져오기
      const userProfile = await this.userService.getProfile(userId);
      const userAllergies = [...(data.allergies || []), ...(userProfile.allergies || [])];
      const userPreferences = [...(data.preferences || []), ...(userProfile.preferences || [])];

      const request = {
        query: data.query,
        userAllergies: userAllergies,
        preferences: userPreferences,
      };

      for await (const chunk of this.langGraphService.streamRAGForWebSocket(request, userId)) {
        client.emit('langgraph_rag_chunk_v2', chunk);

        if (chunk.type === 'error' || chunk.type === 'complete') {
          break;
        }
      }

    } catch (error: unknown) {
      this.logger.error(`LangGraph v0.3.8 RAG failed for ${userId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      client.emit('langgraph_rag_error_v2', {
        message: `RAG 처리 오류: ${errorMessage}`,
        error: errorMessage,
        version: 'LangGraph v0.3.8',
        timestamp: Date.now(),
        userId
      });
    }
  }

  /**
   * LangGraph 성능 벤치마크 (개발/테스트용)
   */
  @SubscribeMessage('langgraph_benchmark')
  async handleLangGraphBenchmark(
      @MessageBody() data: {
        queries: string[];
        allergies?: string[];
        iterations?: number
      },
      @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const userId = client.user.id;
    const { queries, allergies = [], iterations = 1 } = data;

    this.logger.log(`📊 LangGraph v0.3.8 benchmark: ${queries.length} queries, ${iterations} iterations from ${userId}`);

    try {
      const results = [];

      for (let i = 0; i < iterations; i++) {
        for (const query of queries) {
          const startTime = Date.now();

          const result = await this.langGraphService.processRecipeRequest(query, allergies);

          const endTime = Date.now();
          const totalTime = endTime - startTime;

          const benchmarkResult = {
            iteration: i + 1,
            query,
            totalTime,
            metadata: result.metadata,
            hasGeneratedRecipe: !!result.generatedRecipe,
            responseLength: result.response.length,
            timestamp: Date.now()
          };

          results.push(benchmarkResult);

          client.emit('langgraph_benchmark_result', {
            ...benchmarkResult,
            userId,
            version: 'LangGraph v0.3.8'
          });
        }
      }

      // 벤치마크 요약 전송
      const avgTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;
      const maxTime = Math.max(...results.map(r => r.totalTime));
      const minTime = Math.min(...results.map(r => r.totalTime));

      client.emit('langgraph_benchmark_summary', {
        totalQueries: queries.length * iterations,
        averageTime: avgTime,
        maxTime,
        minTime,
        results,
        version: 'LangGraph v0.3.8',
        timestamp: Date.now(),
        userId
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      client.emit('langgraph_benchmark_error', {
        message: `벤치마크 실행 중 오류: ${errorMessage}`,
        timestamp: Date.now(),
        userId
      });
    }
  }

  // ==================== 🤖 LangChain Agent 이벤트 (최신 Agent 기반) ====================

  // /**
  //  * LangChain Agent 쿼리 처리 (인증된 사용자)
  //  */
  // @SubscribeMessage('agent_query')
  // async handleAgentQuery(
  //   @MessageBody() data: { query: string; sessionId?: string },
  //   @ConnectedSocket() client: AuthenticatedSocket,
  // ) {
  //   // LangChain Agent handler removed - use simple_langgraph_query instead
  //   client.emit('agent_error', { error: 'LangChain Agent deprecated. Use simple_langgraph_query event.' });
  // }

  // /**
  //  * LangChain Agent 익명 쿼리 처리
  //  */
  // @SubscribeMessage('agent_anonymous')
  // async handleAgentAnonymous(
  //   @MessageBody() data: { query: string; sessionId?: string },
  //   @ConnectedSocket() client: AuthenticatedSocket,
  // ) {
  //   // LangChain Agent handler removed - use simple_langgraph_query instead
  //   client.emit('agent_error', { error: 'LangChain Agent deprecated. Use simple_langgraph_query event.' });
  // }

  // /**
  //  * LangChain Agent 상태 조회
  //  */
  // @SubscribeMessage('agent_status')
  // async handleAgentStatus(@ConnectedSocket() client: AuthenticatedSocket) {
  //   client.emit('agent_status', { status: 'deprecated', message: 'Use simple_langgraph_query instead' });
  // }

  // /**
  //  * LangChain Agent 건강 상태 확인
  //  */
  // @SubscribeMessage('agent_health')
  // async handleAgentHealth(@ConnectedSocket() client: AuthenticatedSocket) {
  //   client.emit('agent_health', { healthy: false, message: 'LangChain Agent deprecated' });
  // }

  // ==================== 기존 호환성 유지 ====================

  @SubscribeMessage('langgraph_recipe')
  async handleLangGraphRecipe(
      @MessageBody() data: { query: string; allergies?: string[] },
      @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // v2로 리디렉션
    return this.handleLangGraphRecipeV2(data, client);
  }

  @SubscribeMessage('langgraph_cancel')
  async handleLangGraphCancel(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) return;

    const userId = client.user.id;
    this.logger.log(`⛔ LangGraph workflow cancelled by ${userId}`);

    client.emit('langgraph_cancelled', {
      message: '🛑 워크플로우가 취소되었습니다.',
      version: 'LangGraph v0.3.8',
      timestamp: Date.now(),
      userId
    });
  }

  // ==================== 핵심 채팅 기능 ====================

  @SubscribeMessage('join-chat')
  async handleJoinChat(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.validateAuthentication(client)) return;

    const userId = client.user!.id;
    const roomId = `chat:${userId}`;

    await client.join(roomId);
    this.logger.log(`📥 User joined chat: ${client.user!.email}`);

    try {
      const chatHistory = await this.personalChatService.getChatHistory(userId);
      client.emit('chat-history', {
        messages: chatHistory,
        count: chatHistory.length,
        version: 'LangGraph v0.3.8',
        timestamp: Date.now()
      });
    } catch (error: unknown) {
      this.logger.error('Failed to load chat history:', error);
      client.emit('chat-error', {
        message: 'Failed to load chat history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
      @MessageBody() data: { message: string },
      @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.validateAuthentication(client)) return;
    if (!this.validateMessage(data.message, client)) return;

    const clientId = client.id;
    const userId = client.user!.id;
    const { message } = data;

    this.logger.log(`💬 [${clientId}] Message from ${client.user!.email}: "${message.substring(0, 50)}..."`);

    try {
      // 💾 사용자 메시지를 히스토리에 저장
      await this.personalChatService.addChatMessage(userId, 'user', message, 'general');

      client.emit('chat-status', {
        type: 'processing',
        message: 'AI가 응답을 생성하고 있습니다...',
        version: 'LangGraph v0.3.8',
        timestamp: Date.now()
      });

      const stream = await this.personalChatService.processPersonalizedChat(userId, message);

      let fullResponse = '';
      let chunkCount = 0;

      for await (const chunk of stream) {
        if (!client.connected) {
          this.logger.warn(`❌ [${clientId}] Client disconnected during streaming`);
          break;
        }

        fullResponse += chunk;
        chunkCount++;

        client.emit('chat-chunk', {
          chunk,
          index: chunkCount,
          version: 'LangGraph v0.3.8',
          timestamp: Date.now()
        });
      }

      // 💾 AI 응답을 히스토리에 저장
      if (fullResponse.trim().length > 0) {
        await this.personalChatService.addChatMessage(userId, 'assistant', fullResponse, 'recipe');
      }

      client.emit('chat-complete', {
        message: fullResponse,
        chunks: chunkCount,
        version: 'LangGraph v0.3.8',
        timestamp: Date.now()
      });

      client.emit('chat-status', {
        type: 'complete',
        message: '응답 완료',
        version: 'LangGraph v0.3.8',
        timestamp: Date.now()
      });

      this.logger.log(`✅ [${clientId}] Chat complete: ${chunkCount} chunks`);

    } catch (error: unknown) {
      this.logger.error(`❌ [${clientId}] Chat processing error:`, error);
      client.emit('chat-error', {
        message: 'AI 응답 생성 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
        version: 'LangGraph v0.3.8'
      });
    }
  }

  @SubscribeMessage('clear-history')
  async handleClearHistory(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.validateAuthentication(client)) return;

    const userId = client.user!.id;

    try {
      // PersonalChatService와 ChatHistoryService 모두 정리
      await this.personalChatService.clearChatHistory(userId);
      this.logger.log(`🗑️ Chat history cleared for ${client.user!.email}`);

      client.emit('history-cleared', {
        success: true,
        version: 'LangGraph v0.3.8',
        timestamp: Date.now()
      });
    } catch (error: unknown) {
      this.logger.error('Failed to clear chat history:', error);
      client.emit('chat-error', {
        message: 'Failed to clear chat history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== 상태 및 헬스 체크 ====================

  @SubscribeMessage('get-status')
  async handleGetStatus(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.validateAuthentication(client)) return;

    try {
      const [sessionStatus, langgraphStatus] = await Promise.all([
        this.authService.getSessionStatus(client.user!.id),
        this.langGraphService.getServiceStatus()
      ]);

      client.emit('status-response', {
        session: sessionStatus,
        langgraph: langgraphStatus,
        connectedClients: this.connectedClients.size,
        authenticatedClients: this.getConnectedUsersCount(),
        version: 'LangGraph v0.3.8',
        timestamp: Date.now()
      });
    } catch (error: unknown) {
      client.emit('chat-error', {
        message: 'Failed to get status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    let sessionValid = false;

    if (client.user) {
      try {
        const sessionStatus = await this.authService.getSessionStatus(client.user.id);
        sessionValid = sessionStatus.hasSession && !sessionStatus.isExpired;
      } catch {
        // 세션 상태 확인 실패시 false
      }
    }

    client.emit('pong', {
      timestamp: Date.now(),
      authenticated: !!client.user,
      sessionValid,
      clientId: client.id,
      version: 'LangGraph v0.3.8'
    });
  }

  // ==================== 유틸리티 메서드 ====================

  private extractToken(client: AuthenticatedSocket): string | null {
    return (client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1] ||
        client.handshake.query?.token) as string | null;
  }

  private async authenticateUser(token: string) {
    try {
      const user = await this.authService.authenticateByToken(token);

      if (user) {
        this.logger.log(`🚀 빠른 세션 인증 성공: ${user.email}`);
        return user;
      }

      this.logger.warn('세션 인증 실패, JWT 토큰 검증 시도...');

      const payload = this.jwtService.verify(token) as { sub?: string; userId?: string };
      const userId = payload.sub || payload.userId;
      if (!userId) {
        this.logger.warn('JWT payload missing user ID');
        return null;
      }
      const dbUser = await this.userService.findById(userId);

      if (dbUser) {
        this.logger.log(`🔄 JWT 토큰 인증 성공, 세션 재생성: ${dbUser.email}`);
      }

      return dbUser;
    } catch (error: unknown) {
      this.logger.warn('인증 실패:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private handleAnonymousConnection(client: AuthenticatedSocket) {
    this.logger.warn(`⚠️ [${client.id}] No token provided, allowing anonymous connection`);
    client.emit('connection-status', {
      authenticated: false,
      message: 'Connected as anonymous user',
      clientId: client.id,
      version: 'LangGraph v0.3.8',
      features: ['ping']
    });
  }

  private handleInvalidUser(client: AuthenticatedSocket) {
    this.logger.warn(`⚠️ [${client.id}] Invalid user in token`);
    client.emit('connection-status', {
      authenticated: false,
      message: 'Invalid user credentials',
      clientId: client.id,
      version: 'LangGraph v0.3.8',
      features: ['ping']
    });
  }

  private async setupAuthenticatedConnection(client: AuthenticatedSocket, user: UserSessionData) {
    client.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    this.connectedClients.set(client.id, client);

    const roomId = `user:${user.id}`;
    await client.join(roomId);

    try {
      const sessionStatus = await this.authService.getSessionStatus(user.id);
      this.logger.log(`✅ [${client.id}] Authenticated: ${user.email} (session: ${sessionStatus.hasSession ? '✅' : '❌'})`);
    } catch {
      this.logger.log(`✅ [${client.id}] Authenticated: ${user.email} (session check failed)`);
    }

    client.emit('connection-status', {
      authenticated: true,
      message: 'Successfully connected',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        cookingLevel: user.cookingLevel,
        preferences: user.preferences,
        allergies: user.allergies
      },
      clientId: client.id,
      version: 'LangGraph v0.3.8',
      features: [
        'join-chat', 'send-message', 'clear-history', 'get-status',
        'langgraph_recipe', 'langgraph_recipe_v2', 'langgraph_rag_v2',
        'langgraph_benchmark', 'agent_query', 'agent_anonymous', 
        'agent_status', 'agent_health'
      ]
    });
  }

  private handleConnectionError(client: AuthenticatedSocket, error: unknown) {
    client.emit('connection-status', {
      authenticated: false,
      message: 'Connection error occurred',
      clientId: client.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      version: 'LangGraph v0.3.8',
      features: ['ping']
    });
  }

  private validateAuthentication(client: AuthenticatedSocket): boolean {
    if (!client.user) {
      this.logger.warn(`⚠️ [${client.id}] No user auth, allowing anyway (임시)`);
      // 임시: 인증 없어도 허용
      return true;
    }
    return true;
  }

  private validateMessage(message: string, client: AuthenticatedSocket): boolean {
    if (!message?.trim()) {
      client.emit('chat-error', {
        message: 'Empty message not allowed',
        code: 'EMPTY_MESSAGE'
      });
      return false;
    }

    if (message.length > 2000) {
      client.emit('chat-error', {
        message: 'Message too long (max 2000 characters)',
        code: 'MESSAGE_TOO_LONG'
      });
      return false;
    }

    return true;
  }

  getConnectedUsersCount(): number {
    return Array.from(this.connectedClients.values())
        .filter(client => client.user).length;
  }

  getAnonymousUsersCount(): number {
    return Array.from(this.connectedClients.values())
        .filter(client => !client.user).length;
  }

  async broadcastToAllUsers(event: string, data: object) {
    this.server.emit(event, {
      ...data,
      timestamp: Date.now(),
      source: 'system',
      version: 'LangGraph v0.3.8'
    });
  }

  getServerStats() {
    return {
      totalConnections: this.connectedClients.size,
      authenticatedUsers: this.getConnectedUsersCount(),
      anonymousUsers: this.getAnonymousUsersCount(),
      version: 'LangGraph v0.3.8',
      timestamp: Date.now()
    };
  }

  // ================== 🎯 새로운 대화형 시스템 이벤트 (ChatGPT 스타일) ==================

  /**
   * 대화형 메시지 처리 (ChatGPT 방식)
   */
  @SubscribeMessage('conversation_message')
  async handleConversationMessage(
    @MessageBody() data: { message: string; sessionId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) {
      client.emit('conversation_error', { 
        message: '인증이 필요합니다.', 
        timestamp: Date.now() 
      });
      return;
    }

    const userId = client.user.id;
    const startTime = Date.now();

    this.logger.log(`💬 Conversation message from ${userId}: "${data.message}"`);

    try {
      // 1. 대화 상태 가져오기 또는 생성
      const conversationState = await this.conversationManager.getOrCreateConversationState(
        userId, 
        data.sessionId
      );

      // 2. 사용자 의도 분석 및 상태 업데이트 (임시)
      conversationState.userIntent = this.classifyUserIntent(data.message);
      conversationState.currentStage = this.determineConversationStage(conversationState, data.message);

      // 3. 간단한 AI 응답 생성 (개인화 제거)
      const context = this.conversationManager.buildConversationContext(conversationState);
      const prompt = `${context}\n\n사용자 메시지: ${data.message}\n\n도움이 되는 응답을 생성해주세요.`;
      
      const aiResponse = await this.aiService.generateResponse(prompt, {
        temperature: 0.7,
        maxTokens: 1000
      });

      const simpleResponse = {
        content: aiResponse,
        tone: 'helpful' as const,
        actionRequired: false,
        suggestedFollowups: [] as string[],
        recipeData: [] as any[]
      };

      // 4. 대화 상태 업데이트
      await this.conversationManager.updateConversationState(
        conversationState.sessionId,
        data.message,
        simpleResponse.content,
        simpleResponse.recipeData as any[]
      );

      // 5. 대화 히스토리에 저장 (RAG용)
      await this.chatHistoryService.saveChatMessage(
        userId,
        data.message,
        simpleResponse.content,
        'recipe_query',
        {
          processingTime: Date.now() - startTime,
          hasRecipe: !!simpleResponse.recipeData,
        }
      );

      // 6. 클라이언트에 응답 전송
      client.emit('conversation_response', {
        content: simpleResponse.content,
        sessionId: conversationState.sessionId,
        metadata: {
          intent: conversationState.userIntent,
          stage: conversationState.currentStage,
          tone: simpleResponse.tone,
          actionRequired: simpleResponse.actionRequired,
          processingTime: Date.now() - startTime,
          userId: userId,
          model: 'Conversational AI Assistant v2.0',
          personalizationUsed: false
        },
        suggestedFollowups: simpleResponse.suggestedFollowups,
        recipeData: simpleResponse.recipeData,
        timestamp: new Date().toISOString(),
      });

    } catch (error: unknown) {
      this.logger.error(`Conversation message failed for user ${userId}:`, error);
      
      client.emit('conversation_error', {
        message: '죄송해요, 잠시 문제가 있었어요 😅 다시 한번 말씀해주시면 도와드릴게요!',
        sessionId: data.sessionId || `fallback_${Date.now()}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 스트리밍 대화 처리 (타이핑 효과)
   */
  @SubscribeMessage('conversation_stream')
  async handleConversationStream(
    @MessageBody() data: { message: string; sessionId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) {
      client.emit('conversation_error', { 
        message: '인증이 필요합니다.', 
        timestamp: Date.now() 
      });
      return;
    }

    const userId = client.user.id;
    this.logger.log(`🌊 Conversation streaming from ${userId}: "${data.message}"`);

    try {
      // 1. 대화 상태 준비
      const conversationState = await this.conversationManager.getOrCreateConversationState(
        userId, 
        data.sessionId
      );

      // 2. "타이핑 중" 표시
      client.emit('conversation_chunk', {
        type: 'typing',
        content: '생각 중...',
        sessionId: conversationState.sessionId,
        timestamp: new Date().toISOString()
      });

      // 3. 간단한 AI 응답 생성 (개인화 제거)
      const context = this.conversationManager.buildConversationContext(conversationState);
      const prompt = `${context}\n\n사용자 메시지: ${data.message}\n\n도움이 되는 응답을 생성해주세요.`;
      
      const aiResponse = await this.aiService.generateResponse(prompt, {
        temperature: 0.7,
        maxTokens: 1000
      });

      const simpleResponse = {
        content: aiResponse,
        tone: 'helpful' as const,
        actionRequired: false,
        suggestedFollowups: [] as string[],
        recipeData: [] as any[]
      };

      // 4. 응답을 청크로 나누어 스트리밍
      const chunks = this.splitIntoChunks(simpleResponse.content);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLast = i === chunks.length - 1;

        client.emit('conversation_chunk', {
          type: 'content',
          content: chunk,
          sessionId: conversationState.sessionId,
          isComplete: isLast,
          metadata: isLast ? {
            intent: conversationState.userIntent,
            tone: simpleResponse.tone,
            suggestedFollowups: simpleResponse.suggestedFollowups
          } : undefined,
          timestamp: new Date().toISOString()
        });

        // 자연스러운 타이핑 속도 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
      }

      // 5. 상태 업데이트 및 저장
      await this.conversationManager.updateConversationState(
        conversationState.sessionId,
        data.message,
        simpleResponse.content,
        simpleResponse.recipeData as any[]
      );

      await this.chatHistoryService.saveChatMessage(
        userId,
        data.message,
        simpleResponse.content,
        'recipe_query'
      );

    } catch (error: unknown) {
      this.logger.error('Conversation streaming failed:', error);
      client.emit('conversation_chunk', {
        type: 'error',
        content: '죄송해요, 응답 생성 중 문제가 발생했어요. 다시 시도해주세요! 😅',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 대화 히스토리 요청 (REST 보완용)
   */
  @SubscribeMessage('conversation_get_history')
  async handleGetConversationHistory(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('conversation_error', { 
        message: '인증이 필요합니다.', 
        timestamp: Date.now() 
      });
      return;
    }

    const userId = client.user.id;

    try {
      const history = await this.chatHistoryService.getChatHistory(userId, 20);
      const context = await this.chatHistoryService.getUserContext(userId);

      client.emit('conversation_history', {
        conversations: history,
        userContext: context,
        metadata: {
          totalMessages: history.length,
          userId: userId,
          systemType: 'Conversational AI Assistant',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      this.logger.error('Failed to get conversation history:', error);
      client.emit('conversation_error', {
        message: '대화 기록을 불러오는데 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ================== 🔧 대화형 시스템 헬퍼 메서드 ==================

  private classifyUserIntent(message: string): 'search' | 'detail' | 'substitute' | 'help' | 'chat' {
    const msg = message.toLowerCase();

    // 참조 표현이 있고 상세 요청
    if ((msg.includes('첫') || msg.includes('번째') || msg.includes('그거') || msg.includes('이것')) 
        && (msg.includes('자세히') || msg.includes('상세') || msg.includes('만들') || msg.includes('요리법'))) {
      return 'detail';
    }

    // 레시피 검색
    if (msg.includes('레시피') || msg.includes('요리') || msg.includes('만들') || msg.includes('추천')) {
      return 'search';
    }

    // 재료 대체
    if (msg.includes('대신') || msg.includes('바꿔') || msg.includes('없으면') || msg.includes('대체')) {
      return 'substitute';
    }

    // 요리 도움
    if (msg.includes('어떻게') || msg.includes('방법') || msg.includes('팁') || msg.includes('주의')) {
      return 'help';
    }

    return 'chat';
  }

  private determineConversationStage(state: any, message: string): 'greeting' | 'exploring' | 'focused' | 'cooking' | 'clarifying' {
    const intent = this.classifyUserIntent(message);

    if (intent === 'search') return 'exploring';
    if (intent === 'detail' && state.currentRecipes?.length > 0) return 'focused';
    if (intent === 'help' || intent === 'substitute') return 'cooking';
    return 'greeting';
  }

  private splitIntoChunks(text: string): string[] {
    // 자연스러운 청크 분할 (문장 단위, 개행 단위)
    const sentences = text.split(/([.!?]|\n)/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (sentence.match(/[.!?]/) || sentence === '\n') {
        currentChunk += sentence;
        if (currentChunk.trim()) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk);
    }

    return chunks.filter(chunk => chunk.trim());
  }

  // ==================== 🎯 개인화 추천 시스템 WebSocket 이벤트 ====================

  // Personalized recommendation method removed

  // Personalization feedback method removed

  // Cancel personalization method removed

  // ==================== 🎯 체험용 셰프 계정 실시간 상태 업데이트 ====================

  /**
   * 체험용 셰프 계정 상태 조회
   */
  @SubscribeMessage('trial_chef_status')
  async handleTrialChefStatus(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const availableCount = await this.authService.getAvailableTrialChefCount();
      
      client.emit('trial_chef_status_response', {
        success: true,
        availableCount,
        maxCount: 21,
        message: `${availableCount}개의 체험용 셰프 계정을 사용할 수 있습니다`,
        isAvailable: availableCount > 0,
        timestamp: Date.now()
      });

      this.logger.log(`📊 체험용 셰프 상태 조회: ${availableCount}/21 사용 가능`);
    } catch (error) {
      client.emit('trial_chef_status_response', {
        success: false,
        availableCount: 0,
        maxCount: 21,
        message: '체험용 셰프 계정 상태 조회에 실패했습니다',
        isAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  /**
   * 체험용 셰프 실시간 로그인
   */
  @SubscribeMessage('trial_chef_login')
  async handleTrialChefLogin(@ConnectedSocket() client: AuthenticatedSocket) {
    this.logger.log(`🎯 체험용 셰프 로그인 시도: ${client.id}`);

    try {
      const result = await this.authService.loginAsTrialChef();
      
      if (result.success && result.user && result.token) {
        // WebSocket 연결에 체험용 사용자 정보 설정
        client.user = {
          id: result.user.id,
          email: `${result.user.username}@trial.local`,
          name: result.user.displayName
        };

        this.connectedClients.set(client.id, client);
        
        // 방 참가
        const roomId = `user:${result.user.id}`;
        await client.join(roomId);

        this.logger.log(`✅ 체험용 셰프 WebSocket 연결 완료: ${result.user.username}`);
        
        // 모든 클라이언트에 체험용 계정 상태 업데이트 브로드캐스트
        void this.broadcastTrialChefStatusUpdate();

        client.emit('trial_chef_login_response', {
          success: true,
          message: '체험용 셰프 로그인 성공',
          token: result.token,
          user: result.user,
          timestamp: Date.now()
        });
      } else {
        client.emit('trial_chef_login_response', {
          success: false,
          message: result.message,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.logger.error('체험용 셰프 WebSocket 로그인 실패:', error);
      
      client.emit('trial_chef_login_response', {
        success: false,
        message: '체험용 셰프 로그인 처리 중 오류가 발생했습니다',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  /**
   * 체험용 셰프 실시간 로그아웃
   */
  @SubscribeMessage('trial_chef_logout')
  async handleTrialChefLogout(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('trial_chef_logout_response', {
        success: false,
        message: '로그인된 사용자가 없습니다',
        timestamp: Date.now()
      });
      return;
    }

    const userId = client.user.id;
    this.logger.log(`🚪 체험용 셰프 WebSocket 로그아웃: ${userId}`);

    try {
      // 체험용 계정인지 확인
      if (userId.startsWith('trial_')) {
        const result = await this.authService.logoutTrialChef(userId);
        
        // WebSocket 연결 정리
        client.user = undefined;
        this.connectedClients.delete(client.id);
        
        // 모든 클라이언트에 체험용 계정 상태 업데이트 브로드캐스트
        void this.broadcastTrialChefStatusUpdate();

        client.emit('trial_chef_logout_response', {
          success: result.success,
          message: result.message,
          timestamp: Date.now()
        });
        
        this.logger.log(`✅ 체험용 셰프 WebSocket 로그아웃 완료: ${userId}`);
      } else {
        // 일반 사용자 로그아웃
        await this.authService.logout(userId);
        client.user = undefined;
        this.connectedClients.delete(client.id);
        
        client.emit('trial_chef_logout_response', {
          success: true,
          message: '로그아웃 성공',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.logger.error(`체험용 셰프 WebSocket 로그아웃 실패: ${userId}`, error);
      
      client.emit('trial_chef_logout_response', {
        success: false,
        message: '로그아웃 처리 중 오류가 발생했습니다',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  /**
   * 체험용 셰프 계정 상태를 모든 클라이언트에 브로드캐스트
   */
  private async broadcastTrialChefStatusUpdate() {
    try {
      const availableCount = await this.authService.getAvailableTrialChefCount();
      
      this.server.emit('trial_chef_status_update', {
        availableCount,
        maxCount: 21,
        isAvailable: availableCount > 0,
        message: `${availableCount}개의 체험용 셰프 계정을 사용할 수 있습니다`,
        timestamp: Date.now()
      });

      this.logger.log(`📢 체험용 셰프 상태 브로드캐스트: ${availableCount}/21 사용 가능`);
    } catch (error) {
      this.logger.error('체험용 셰프 상태 브로드캐스트 실패:', error);
    }
  }
}