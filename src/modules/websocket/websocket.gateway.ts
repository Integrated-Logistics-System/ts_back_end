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
import { RecipeAgentService } from '../agent/core/main-agent';
import { ChatHistoryService } from '../chat/chat-history.service';

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
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly recipeAgentService: RecipeAgentService,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  afterInit(_server: Server) {
    const websocketPort = process.env.WEBSOCKET_PORT || 8083;
    this.logger.log(`🚀 WebSocket Gateway initialized on port ${websocketPort}`);
  }

  async handleConnection(client: AuthenticatedSocket) {
    const clientId = client.id;
    this.logger.log(`🔌 [${clientId}] New connection attempt.`);

    try {
      const token = this.extractToken(client);
      if (token) {
        this.logger.log(`🔌 [${clientId}] Token found. Attempting authentication.`);
        const user = await this.authenticateUser(token);
        if (user) {
          await this.setupAuthenticatedConnection(client, user);
        } else {
          this.logger.warn(`🔌 [${clientId}] Authentication failed for provided token.`);
        }
      } else {
        this.logger.log(`🔌 [${clientId}] No token found. Anonymous connection.`);
      }

      client.emit('connection-status', {
        authenticated: !!client.user,
        clientId: client.id,
        timestamp: Date.now()
      });

    } catch (error: unknown) {
      this.logger.error(`❌ [${clientId}] Connection error:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const clientId = client.id;
    this.connectedClients.delete(clientId);

    if (client.user) {
      this.logger.log(`🔌 [${clientId}] User disconnected: ${client.user.email}. Total connected: ${this.connectedClients.size}`);
    } else {
      this.logger.log(`🔌 [${clientId}] Anonymous client disconnected. Total connected: ${this.connectedClients.size}`);
    }
    this.logger.log(`[DEBUG] Client ${clientId} disconnected.`);
  }

  

  /**
   * 채팅 히스토리 조회
   */
  @SubscribeMessage('get_chat_history')
  async handleGetChatHistory(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('error', { message: '인증이 필요합니다.', timestamp: Date.now() });
      return;
    }

    try {
      const history = await this.chatHistoryService.getChatHistory(client.user.id, 50);
      client.emit('chat_history', {
        messages: history,
        count: history.length,
        timestamp: Date.now()
      });
    } catch (error: unknown) {
      this.logger.error('Failed to load chat history:', error);
      client.emit('chat_error', {
        message: 'Failed to load chat history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 채팅 히스토리 삭제
   */
  @SubscribeMessage('clear_chat_history')
  async handleClearHistory(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('error', { message: '인증이 필요합니다.', timestamp: Date.now() });
      return;
    }

    try {
      await this.chatHistoryService.clearChatHistory(client.user.id);
      this.logger.log(`🗑️ Chat history cleared for ${client.user.email}`);

      client.emit('history_cleared', {
        success: true,
        timestamp: Date.now()
      });
    } catch (error: unknown) {
      this.logger.error('Failed to clear chat history:', error);
      client.emit('chat_error', {
        message: 'Failed to clear chat history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Ping/Pong
   */
  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', {
      timestamp: Date.now(),
      authenticated: !!client.user,
      clientId: client.id
    });
  }

  /**
   * 일반 대화 메시지 처리 (LangGraph 사용)
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

    this.logger.log(`💬 [${client.user.email}] Conversation message: ${data.message.substring(0, 50)}...`);

    try {
      // 사용자 프로필 정보 조회 (알레르기, 요리 수준 등)
      const userProfile = await this.userService.getProfile(client.user.id);
      
      // 대화 히스토리 조회 (최근 10개)
      const chatHistory = await this.chatHistoryService.getChatHistory(client.user.id, 10);
      const conversationHistory = chatHistory.map(msg => [
        { role: 'user' as const, content: msg.message },
        { role: 'assistant' as const, content: msg.response }
      ]).flat();
      
      // Recipe Agent를 통해 대화 처리 (사용자 컨텍스트 + 대화 히스토리 포함)
      const response = await this.recipeAgentService.processQuery({
        message: data.message,
        userId: client.user.id,
        sessionId: data.sessionId,
        conversationHistory, // 대화 히스토리 추가!
      });

      // 💾 채팅 히스토리 저장
      try {
        const chatType = this.determineChatType(response.metadata.intent || 'general_chat');
        await this.chatHistoryService.saveChatMessage(
          client.user.id,
          data.message,
          response.message,
          chatType,
          {
            intent: response.metadata.intent,
            processingTime: response.metadata.processingTime,
            hasRecipe: response.recipes && response.recipes.length > 0,
            allergies: userProfile?.allergies || [],
            recipeId: response.recipes && response.recipes.length > 0 ? response.recipes[0].id : undefined
          }
        );
        this.logger.log(`💾 [${client.user.email}] Chat message saved to history`);
      } catch (saveError) {
        this.logger.warn(`⚠️ [${client.user.email}] Failed to save chat message:`, saveError);
        // 저장 실패해도 응답은 계속 진행
      }

      // 📊 레시피 데이터 상세 로그
      this.logger.log(`🔍 [${client.user.email}] Agent 응답 분석:`);
      this.logger.log(`  - response.message 길이: ${response.message?.length || 0}`);
      this.logger.log(`  - response.recipes 존재: ${!!response.recipes}`);
      this.logger.log(`  - response.recipes 길이: ${response.recipes?.length || 0}`);
      this.logger.log(`  - response.metadata.intent: ${response.metadata.intent}`);
      
      if (response.recipes && response.recipes.length > 0) {
        this.logger.log(`🍽️ [${client.user.email}] Sending ${response.recipes.length} recipes:`);
        response.recipes.forEach((recipe, index) => {
          this.logger.log(`  ${index + 1}. ${recipe.nameKo || recipe.name || 'Unknown'} (${recipe.minutes || 0}분, ${recipe.difficulty || '보통'})`);
          this.logger.log(`      ID: ${recipe.id}, ingredients: ${recipe.ingredients?.length || 0}개`);
        });
      } else {
        this.logger.warn(`⚠️ [${client.user.email}] No recipes in response!`);
        this.logger.warn(`   Raw response.recipes: ${JSON.stringify(response.recipes)}`);
      }

      // intent에 따른 응답 구조 결정
      const responseData = this.buildResponseData(response, data.sessionId);

      // 응답 전송
      client.emit('conversation_response', responseData);

      this.logger.log(`✅ [${client.user.email}] Response sent (${response.metadata.processingTime}ms) with ${(response.recipes || []).length} recipes`);

    } catch (error) {
      this.logger.error(`❌ [${client.user.email}] Conversation error:`, error);
      client.emit('conversation_error', {
        message: '메시지 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 스트리밍 대화 메시지 처리
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

    this.logger.log(`🌊 [${client.user.email}] Stream message: ${data.message.substring(0, 50)}...`);

    try {
      // 스트리밍 시작 신호
      client.emit('conversation_chunk', {
        type: 'typing',
        sessionId: data.sessionId,
        timestamp: Date.now(),
      });

      // 사용자 프로필 정보 조회 (알레르기, 요리 수준 등)
      const userProfile = await this.userService.getProfile(client.user.id);
      
      // 대화 히스토리 조회 (최근 10개)
      const chatHistory = await this.chatHistoryService.getChatHistory(client.user.id, 10);
      const conversationHistory = chatHistory.map(msg => [
        { role: 'user' as const, content: msg.message },
        { role: 'assistant' as const, content: msg.response }
      ]).flat();

      // Recipe Agent를 통해 대화 처리 (대화 히스토리 포함)
      const response = await this.recipeAgentService.processQuery({
        message: data.message,
        userId: client.user.id,
        sessionId: data.sessionId,
        conversationHistory, // 대화 히스토리 추가!
      });

      // 청크 단위로 응답 전송 시뮬레이션
      const content = response.message;
      const chunkSize = 50;
      
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.substring(i, i + chunkSize);
        
        client.emit('conversation_chunk', {
          type: 'token',
          content: chunk,
          sessionId: data.sessionId,
          timestamp: Date.now(),
        });

        // 자연스러운 스트리밍을 위한 지연
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 💾 스트리밍 채팅 히스토리 저장
      try {
        const chatType = this.determineChatType(response.metadata.intent || 'general_chat');
        await this.chatHistoryService.saveChatMessage(
          client.user.id,
          data.message,
          response.message,
          chatType,
          {
            intent: response.metadata.intent,
            processingTime: response.metadata.processingTime,
            hasRecipe: response.recipes && response.recipes.length > 0,
            allergies: userProfile?.allergies || [],
            recipeId: response.recipes && response.recipes.length > 0 ? response.recipes[0].id : undefined
          }
        );
        this.logger.log(`💾 [${client.user.email}] Stream chat message saved to history`);
      } catch (saveError) {
        this.logger.warn(`⚠️ [${client.user.email}] Failed to save stream chat message:`, saveError);
        // 저장 실패해도 스트리밍은 계속 진행
      }

      // 📊 스트리밍 레시피 데이터 상세 로그
      this.logger.log(`🔍 [${client.user.email}] Streaming Agent 응답 분석:`);
      this.logger.log(`  - response.recipes 존재: ${!!response.recipes}`);
      this.logger.log(`  - response.recipes 길이: ${response.recipes?.length || 0}`);
      
      if (response.recipes && response.recipes.length > 0) {
        this.logger.log(`🍽️ [${client.user.email}] Streaming ${response.recipes.length} recipes:`);
        response.recipes.forEach((recipe, index) => {
          this.logger.log(`  ${index + 1}. ${recipe.nameKo || recipe.name || 'Unknown'} (${recipe.minutes || 0}분, ${recipe.difficulty || '보통'})`);
          this.logger.log(`      ID: ${recipe.id}, ingredients: ${recipe.ingredients?.length || 0}개`);
        });
      } else {
        this.logger.warn(`⚠️ [${client.user.email}] No recipes in streaming response!`);
        this.logger.warn(`   Raw response.recipes: ${JSON.stringify(response.recipes)}`);
      }

      // intent에 따른 스트리밍 완료 응답 구조 결정
      const streamCompleteData = this.buildStreamCompleteData(response, data.sessionId);

      // 🔍 스트리밍 완료 데이터 디버깅
      this.logger.log(`🔍 [${client.user.email}] Stream Complete Data Debug:`);
      this.logger.log(`  - Intent: ${response.metadata.intent}`);
      this.logger.log(`  - Has recipeDetail: ${!!(response as any).recipeDetail}`);
      this.logger.log(`  - Stream complete data keys: ${Object.keys(streamCompleteData).join(', ')}`);
      this.logger.log(`  - Stream complete metadata keys: ${Object.keys(streamCompleteData.metadata || {}).join(', ')}`);
      this.logger.log(`  - recipeData in metadata: ${!!(streamCompleteData.metadata as any)?.recipeData}`);
      this.logger.log(`  - recipeData length: ${(streamCompleteData.metadata as any)?.recipeData?.length || 0}`);
      if ((streamCompleteData.metadata as any)?.recipeData?.[0]) {
        this.logger.log(`  - First recipeData title: ${(streamCompleteData.metadata as any).recipeData[0].title}`);
      }

      // 스트리밍 완료 신호
      client.emit('conversation_chunk', streamCompleteData);

      this.logger.log(`✅ [${client.user.email}] Stream completed (${response.metadata.processingTime}ms) with ${(response.recipes || []).length} recipes`);

    } catch (error) {
      this.logger.error(`❌ [${client.user.email}] Stream error:`, error);
      client.emit('conversation_chunk', {
        type: 'error',
        content: '메시지 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: data.sessionId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 대화 히스토리 요청 처리
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

    try {
      const history = await this.chatHistoryService.getChatHistory(client.user.id, 50);
      
      client.emit('conversation_history', {
        conversations: history.map(msg => ({
          message: msg.message,
          response: msg.response,
          timestamp: msg.timestamp,
          metadata: msg.metadata,
        })),
        timestamp: Date.now(),
      });

      this.logger.log(`📚 [${client.user.email}] Conversation history sent (${history.length} items)`);

    } catch (error) {
      this.logger.error(`❌ [${client.user.email}] History error:`, error);
      client.emit('conversation_error', {
        message: '히스토리 로드 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    }
  }


  // ==================== Private Methods ====================

  private extractToken(client: AuthenticatedSocket): string | null {
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
    } catch (error: unknown) {
      this.logger.warn('Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private async setupAuthenticatedConnection(client: AuthenticatedSocket, user: any) {
    client.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    this.connectedClients.set(client.id, client);

    const roomId = `user:${user.id}`;
    await client.join(roomId);

    this.logger.log(`✅ [${client.id}] Authenticated: ${user.email}`);
  }

  getConnectedUsersCount(): number {
    return Array.from(this.connectedClients.values())
      .filter(client => client.user).length;
  }

  /**
   * intent에 따른 스트리밍 완료 데이터 구조 생성
   */
  private buildStreamCompleteData(response: any, sessionId?: string) {
    const intent = response.metadata.intent;
    const baseData = {
      type: 'content',
      content: '',
      isComplete: true,
      sessionId,
      metadata: {
        confidence: response.metadata.confidence,
        processingTime: response.metadata.processingTime,
        intent: intent,
      },
      timestamp: Date.now(),
    };

    switch (intent) {
      case 'recipe_list':
      case 'RECIPE_LIST':
        return {
          ...baseData,
          metadata: {
            ...baseData.metadata,
            conversationType: 'recipe_list',
            recipes: response.recipes || [],
          },
        };

      case 'recipe_detail':
      case 'RECIPE_DETAIL':
        return {
          ...baseData,
          metadata: {
            ...baseData.metadata,
            conversationType: 'recipe_detail',
            recipeDetail: response.recipeDetail || null,
            recipeData: response.recipeDetail ? [response.recipeDetail] : [], // 프론트엔드가 기대하는 recipeData 배열
            recipes: response.recipes || [],
          },
        };

      case 'alternative_recipe':
      case 'ALTERNATIVE_RECIPE':
        return {
          ...baseData,
          metadata: {
            ...baseData.metadata,
            conversationType: 'alternative_recipe',
            recipes: response.recipes || [],
            alternativeInfo: response.alternativeInfo || null,
          },
        };

      case 'ingredient_substitute':
      case 'INGREDIENT_SUBSTITUTE':
        return {
          ...baseData,
          metadata: {
            ...baseData.metadata,
            conversationType: 'ingredient_substitute',
            targetIngredient: response.metadata?.targetIngredient,
            substitutes: response.metadata?.substitutes || [],
            cookingTips: response.metadata?.cookingTips || [],
          },
        };

      default: // general_chat
        return {
          ...baseData,
          metadata: {
            ...baseData.metadata,
            conversationType: 'general_chat',
          },
        };
    }
  }

  /**
   * intent에 따른 응답 데이터 구조 생성
   */
  private buildResponseData(response: any, sessionId?: string) {
    const intent = response.metadata.intent;
    const baseResponse = {
      content: response.message,
      sessionId,
      metadata: {
        confidence: response.metadata.confidence,
        tone: 'friendly',
        processingTime: response.metadata.processingTime,
        stage: 'completed',
        intent: intent,
      },
      timestamp: Date.now(),
    };

    switch (intent) {
      case 'recipe_list':
      case 'RECIPE_LIST':
        return {
          ...baseResponse,
          metadata: {
            ...baseResponse.metadata,
            conversationType: 'recipe_list',
          },
          suggestedFollowups: response.suggestions || [],
          recipes: response.recipes || [], // RecipeCard 컴포넌트용
        };

      case 'recipe_detail':
      case 'RECIPE_DETAIL':
        return {
          ...baseResponse,
          metadata: {
            ...baseResponse.metadata,
            conversationType: 'recipe_detail',
            recipeDetail: response.recipeDetail || null, // 메타데이터에도 포함
            recipeData: response.recipeDetail ? [response.recipeDetail] : [], // 프론트엔드가 기대하는 recipeData 배열
          },
          suggestedFollowups: response.suggestions || [],
          recipeDetail: response.recipeDetail || null, // RecipeDetailCard 컴포넌트용 (최상위 레벨)
          recipes: response.recipes || [], // 호환성을 위해 유지
        };

      case 'alternative_recipe':
      case 'ALTERNATIVE_RECIPE':
        return {
          ...baseResponse,
          metadata: {
            ...baseResponse.metadata,
            conversationType: 'alternative_recipe',
          },
          suggestedFollowups: response.suggestions || [],
          recipes: response.recipes || [],
          alternativeInfo: response.alternativeInfo || null,
        };

      case 'ingredient_substitute':
      case 'INGREDIENT_SUBSTITUTE':
        return {
          ...baseResponse,
          metadata: {
            ...baseResponse.metadata,
            conversationType: 'ingredient_substitute',
            targetIngredient: response.metadata?.targetIngredient,
            substitutes: response.metadata?.substitutes || [],
            cookingTips: response.metadata?.cookingTips || [],
          },
          suggestedFollowups: response.suggestions || [],
          targetIngredient: response.metadata?.targetIngredient,
          substitutes: response.metadata?.substitutes || [],
          cookingTips: response.metadata?.cookingTips || [],
        };

      default: // general_chat
        return {
          ...baseResponse,
          metadata: {
            ...baseResponse.metadata,
            conversationType: 'general_chat',
          },
          suggestedFollowups: response.suggestions || [],
        };
    }
  }

  /**
   * 대화 유형에 따른 채팅 타입 결정
   */
  private determineChatType(intent: string): 'recipe_query' | 'general_chat' | 'detail_request' {
    this.logger.debug(`🔍 determineChatType 호출됨 - intent: "${intent}"`);
    
    switch (intent) {
      case 'RECIPE_LIST':
      case 'recipe_list':
      case 'RECIPE_REQUEST':        // 하위 호환성
      case 'recipe_request':        // 하위 호환성
      case 'ALTERNATIVE_RECIPE':
      case 'alternative_recipe':
        this.logger.debug(`✅ intent "${intent}"를 recipe_query로 분류`);
        return 'recipe_query';
      case 'INGREDIENT_SUBSTITUTE':
      case 'ingredient_substitute':
        this.logger.debug(`✅ intent "${intent}"를 recipe_query로 분류`);
        return 'recipe_query';
      case 'RECIPE_DETAIL':
      case 'recipe_detail':
        this.logger.debug(`✅ intent "${intent}"를 detail_request로 분류`);
        return 'detail_request';
      case 'GENERAL_CHAT':
      case 'general_chat':
      default:
        this.logger.debug(`✅ intent "${intent}"를 general_chat로 분류 (기본값)`);
        return 'general_chat';
    }
  }
}