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
import { LangGraphService } from '../langgraph/langgraph.service';
import { ChatHistoryService } from '../chat/chat-history.service';
import { AiService } from '../ai/ai.service';

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
    private readonly langGraphService: LangGraphService,
    private readonly chatHistoryService: ChatHistoryService,
    private readonly aiService: AiService,
  ) {}

  afterInit(_server: Server) {
    const websocketPort = process.env.WEBSOCKET_PORT || 8083;
    this.logger.log(`🚀 WebSocket Gateway initialized on port ${websocketPort}`);
  }

  async handleConnection(client: AuthenticatedSocket) {
    const clientId = client.id;
    this.logger.log(`🔌 [${clientId}] New connection`);

    try {
      const token = this.extractToken(client);
      if (token) {
        const user = await this.authenticateUser(token);
        if (user) {
          await this.setupAuthenticatedConnection(client, user);
        }
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
      this.logger.log(`🔌 [${clientId}] User disconnected: ${client.user.email}`);
    } else {
      this.logger.log(`🔌 [${clientId}] Anonymous client disconnected`);
    }
  }

  /**
   * LangGraph 기반 레시피 워크플로우
   */
  @SubscribeMessage('langgraph_recipe')
  async handleLangGraphRecipe(
    @MessageBody() data: { query: string; allergies?: string[] },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) {
      client.emit('error', { message: '인증이 필요합니다.', timestamp: Date.now() });
      return;
    }

    const userId = client.user.id;
    this.logger.log(`🔗 LangGraph recipe workflow: "${data.query}" from ${userId}`);

    try {
      // 사용자 정보 가져오기
      const userProfile = await this.userService.getProfile(userId);
      const userAllergies = [...(data.allergies || []), ...(userProfile.allergies || [])];

      client.emit('langgraph_start', {
        message: '🚀 워크플로우를 시작합니다...',
        query: data.query,
        allergies: userAllergies,
        timestamp: Date.now(),
        userId
      });

      let fullResponse = '';

      // LangGraph 워크플로우 실행
      for await (const chunk of this.langGraphService.streamRecipeWorkflowForWebSocket(
        data.query,
        userAllergies,
        userId
      )) {
        client.emit('langgraph_chunk', chunk);

        if (chunk.content && typeof chunk.content === 'string') {
          fullResponse += chunk.content;
        }

        if (chunk.type === 'error' || chunk.type === 'complete') {
          break;
        }
      }

      // 채팅 히스토리에 저장
      if (fullResponse.trim().length > 0) {
        await this.chatHistoryService.saveChatMessage(
          userId,
          data.query,
          fullResponse,
          'recipe_query'
        );
      }

      client.emit('langgraph_complete', {
        message: '✅ 워크플로우가 완료되었습니다.',
        timestamp: Date.now(),
        userId
      });

    } catch (error: unknown) {
      this.logger.error(`LangGraph workflow failed for ${userId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      client.emit('langgraph_error', {
        message: `워크플로우 오류: ${errorMessage}`,
        error: errorMessage,
        timestamp: Date.now(),
        userId
      });
    }
  }

  /**
   * 기본 채팅 메시지
   */
  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @MessageBody() data: { message: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) {
      client.emit('error', { message: '인증이 필요합니다.', timestamp: Date.now() });
      return;
    }

    const userId = client.user.id;
    const { message } = data;

    this.logger.log(`💬 Chat message from ${client.user.email}: "${message.substring(0, 50)}..."`);

    try {
      client.emit('chat_status', {
        type: 'processing',
        message: 'AI가 응답을 생성하고 있습니다...',
        timestamp: Date.now()
      });

      // AI 응답 생성
      const response = await this.aiService.generateResponse(message, {
        temperature: 0.7,
        maxTokens: 1000
      });

      // 채팅 히스토리에 저장
      await this.chatHistoryService.saveChatMessage(
        userId,
        message,
        response,
        'general_chat'
      );

      client.emit('chat_response', {
        message: response,
        timestamp: Date.now()
      });

      client.emit('chat_status', {
        type: 'complete',
        message: '응답 완료',
        timestamp: Date.now()
      });

    } catch (error: unknown) {
      this.logger.error(`Chat processing error:`, error);
      client.emit('chat_error', {
        message: 'AI 응답 생성 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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
}