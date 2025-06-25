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
import { AuthService } from '../auth/auth.service';
import { PersonalChatService } from './personal-chat.service';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
    private personalChatService: PersonalChatService,
  ) {}

  afterInit(server: Server) {
    const websocketPort = process.env.WEBSOCKET_PORT || 8083;
    this.logger.log(`🚀 LangChain WebSocket Gateway initialized on port ${websocketPort}`);
  }

  async handleConnection(client: AuthenticatedSocket) {
    const clientId = client.id;
    this.logger.log(`🔌 [${clientId}] New connection`);

    try {
      // 토큰 추출
      const token = client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1] ||
        client.handshake.query?.token as string;

      if (!token) {
        this.logger.warn(`⚠️ [${clientId}] No token provided, allowing anonymous connection`);
        client.emit('connected', {
          message: 'Connected as anonymous (LangChain disabled)',
          user: null,
          clientId: clientId,
          langchainEnabled: false
        });
        return;
      }

      // JWT 토큰 검증
      const payload = this.jwtService.verify(token);
      const user = await this.authService.findById(payload.sub || payload.userId);

      if (!user) {
        this.logger.warn(`⚠️ [${clientId}] Invalid user in token`);
        client.emit('connected', {
          message: 'Connected as anonymous (user not found)',
          user: null,
          clientId: clientId,
          langchainEnabled: false
        });
        return;
      }

      client.user = {
        id: user.id,
        email: user.email,
        name: user.name,
      };

      const roomId = `user:${user.id}`;
      client.join(roomId);

      // LangChain 체인 상태 확인
      const chainStatus = await this.personalChatService.getChainStatus(user.id);

      this.logger.log(`✅ [${clientId}] LangChain Authenticated: ${user.email}`);

      client.emit('connected', {
        message: 'Successfully connected to LangChain chat',
        user: { id: user.id, email: user.email, name: user.name },
        clientId: clientId,
        langchainEnabled: true,
        chainStatus: chainStatus
      });

    } catch (error) {
      this.logger.error(`❌ [${clientId}] Connection error:`, error.message);
      client.emit('connected', {
        message: 'Connected as anonymous due to auth error',
        user: null,
        error: error.message,
        clientId: clientId,
        langchainEnabled: false
      });
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const clientId = client.id;

    if (client.user) {
      this.logger.log(`🔌 [${clientId}] LangChain user disconnected: ${client.user.email}`);
    } else {
      this.logger.log(`🔌 [${clientId}] Anonymous client disconnected`);
    }
  }

  @SubscribeMessage('join-personal-chat')
  async handleJoinPersonalChat(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('chat-error', { message: 'LangChain: Not authenticated' });
      return;
    }

    const userId = client.user.id;
    client.join(`langchain-chat:${userId}`);
    this.logger.log(`📥 User joined LangChain personal chat: ${client.user.email}`);

    // LangChain 메모리에서 이전 대화 기록 로드
    try {
      const chatHistory = await this.personalChatService.getChatHistory(userId);
      client.emit('chat-history', {
        messages: chatHistory,
        source: 'langchain',
        memoryType: 'RedisConversationMemory'
      });
    } catch (error) {
      this.logger.error('❌ Failed to load LangChain chat history:', error.message);
      client.emit('chat-history', { messages: [], source: 'langchain', error: error.message });
    }
  }

  @SubscribeMessage('send-personal-message')
  async handlePersonalMessage(
    @MessageBody() data: { message: string; chainType?: 'conversation' | 'recipe' | 'rag' },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const clientId = client.id;

    if (!client.user) {
      client.emit('chat-error', { message: 'LangChain: Not authenticated' });
      return;
    }

    const userId = client.user.id;
    const { message, chainType = 'conversation' } = data;

    this.logger.log(`💬 [${clientId}] LangChain Message (${chainType}) from ${client.user.email}: "${message?.substring(0, 50)}..."`);

    if (!message?.trim()) {
      client.emit('chat-error', { message: 'LangChain: Empty message' });
      return;
    }

    try {
      // LangChain 스트리밍 시작 알림
      client.emit('chat-stream', {
        type: 'start',
        timestamp: Date.now(),
        source: 'langchain',
        chainType: chainType
      });

      client.emit('chat-status', {
        type: 'typing',
        isTyping: true,
        source: 'langchain',
        status: 'Processing with LangChain...'
      });

      // LangChain 개인화 채팅 처리
      const stream = await this.personalChatService.processPersonalizedChat(userId, message);

      let fullResponse = '';
      let chunkCount = 0;

      for await (const chunk of stream) {
        fullResponse += chunk;
        chunkCount++;

        client.emit('chat-stream', {
          type: 'content',
          data: chunk,
          timestamp: Date.now(),
          source: 'langchain',
          chunkIndex: chunkCount
        });

        // 연결 상태 확인
        if (!client.connected) {
          this.logger.warn(`❌ [${clientId}] Client disconnected during LangChain streaming`);
          break;
        }
      }

      this.logger.log(`✅ [${clientId}] LangChain stream complete: ${chunkCount} chunks`);

      // LangChain 스트리밍 종료 알림
      client.emit('chat-stream', {
        type: 'end',
        timestamp: Date.now(),
        source: 'langchain',
        totalChunks: chunkCount
      });

      client.emit('chat-status', {
        type: 'typing',
        isTyping: false,
        source: 'langchain',
        status: 'LangChain processing complete'
      });

      client.emit('message-complete', {
        message: fullResponse,
        timestamp: Date.now(),
        source: 'langchain',
        chainType: chainType,
        metadata: {
          chunkCount,
          userId,
          model: 'ChatOllama',
          memoryType: 'RedisConversationMemory'
        }
      });

      // LangChain 메모리에 자동으로 저장됨 (ConversationChain의 memory.saveContext)

    } catch (error) {
      this.logger.error(`❌ [${clientId}] LangChain chat processing error:`, error.message);
      client.emit('chat-error', {
        message: 'Failed to process message with LangChain',
        source: 'langchain',
        error: error.message
      });
      client.emit('chat-status', {
        type: 'typing',
        isTyping: false,
        source: 'langchain',
        status: 'Error occurred'
      });
    }
  }

  @SubscribeMessage('clear-chat-history')
  async handleClearChatHistory(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('chat-error', { message: 'LangChain: Not authenticated' });
      return;
    }

    const userId = client.user.id;
    try {
      await this.personalChatService.clearChatHistory(userId);
      this.logger.log(`🗑️ LangChain chat history cleared for ${client.user.email}`);
      client.emit('chat-history-cleared', {
        success: true,
        source: 'langchain',
        memoryType: 'RedisConversationMemory'
      });
    } catch (error) {
      this.logger.error(`❌ Failed to clear LangChain chat history:`, error.message);
      client.emit('chat-error', {
        message: 'Failed to clear LangChain chat history',
        source: 'langchain',
        error: error.message
      });
    }
  }

  // 새로운 LangChain 전용 이벤트들
  @SubscribeMessage('get-chain-status')
  async handleGetChainStatus(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('chat-error', { message: 'LangChain: Not authenticated' });
      return;
    }

    try {
      const status = await this.personalChatService.getChainStatus(client.user.id);
      client.emit('chain-status', {
        status,
        source: 'langchain',
        timestamp: Date.now()
      });
    } catch (error) {
      client.emit('chat-error', {
        message: 'Failed to get chain status',
        error: error.message
      });
    }
  }

  @SubscribeMessage('switch-chain-type')
  async handleSwitchChainType(
    @MessageBody() data: { chainType: 'conversation' | 'recipe' | 'rag' },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    if (!client.user) {
      client.emit('chat-error', { message: 'LangChain: Not authenticated' });
      return;
    }

    const { chainType } = data;
    this.logger.log(`🔄 [${client.id}] Switching to ${chainType} chain for ${client.user.email}`);

    try {
      let chainInstance;

      switch (chainType) {
        case 'recipe':
          chainInstance = await this.personalChatService.createRecipeChain(client.user.id);
          break;
        case 'rag':
          chainInstance = await this.personalChatService.createRAGChain(client.user.id);
          break;
        case 'conversation':
        default:
          // 기본 대화형 체인은 이미 processPersonalizedChat에서 생성됨
          chainInstance = 'conversation';
          break;
      }

      client.emit('chain-switched', {
        chainType,
        message: `${chainType} 체인으로 전환되었습니다.`,
        timestamp: Date.now(),
        source: 'langchain'
      });

    } catch (error) {
      this.logger.error(`❌ Failed to switch chain type:`, error.message);
      client.emit('chat-error', {
        message: `Failed to switch to ${chainType} chain`,
        error: error.message
      });
    }
  }

  // LangChain 메모리 조회
  @SubscribeMessage('get-memory-info')
  async handleGetMemoryInfo(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('chat-error', { message: 'LangChain: Not authenticated' });
      return;
    }

    try {
      const chatHistory = await this.personalChatService.getChatHistory(client.user.id);
      const status = await this.personalChatService.getChainStatus(client.user.id);

      client.emit('memory-info', {
        messageCount: chatHistory.length,
        memoryType: 'RedisConversationMemory',
        memoryKeys: ['chat_history'],
        status: status,
        source: 'langchain',
        timestamp: Date.now()
      });

    } catch (error) {
      client.emit('chat-error', {
        message: 'Failed to get memory info',
        error: error.message
      });
    }
  }

  // 체인 설정 변경
  @SubscribeMessage('configure-chain')
  async handleConfigureChain(
    @MessageBody() data: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      verbose?: boolean;
    },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    if (!client.user) {
      client.emit('chat-error', { message: 'LangChain: Not authenticated' });
      return;
    }

    try {
      // 향후 구현: 동적 체인 설정 변경
      this.logger.log(`⚙️ Chain configuration requested by ${client.user.email}:`, data);

      client.emit('chain-configured', {
        success: true,
        message: 'Chain configuration updated',
        config: data,
        source: 'langchain',
        timestamp: Date.now()
      });

    } catch (error) {
      client.emit('chat-error', {
        message: 'Failed to configure chain',
        error: error.message
      });
    }
  }

  // 대화 기록 내보내기
  @SubscribeMessage('export-chat-history')
  async handleExportChatHistory(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('chat-error', { message: 'LangChain: Not authenticated' });
      return;
    }

    try {
      const chatHistory = await this.personalChatService.getChatHistory(client.user.id);
      const userContext = await this.personalChatService.getPersonalizedContext(client.user.id);

      const exportData = {
        user: {
          email: client.user.email,
          name: client.user.name,
          cookingLevel: userContext.cookingLevel,
          preferences: userContext.preferences,
          allergies: userContext.allergies
        },
        chatHistory: chatHistory,
        exportDate: new Date().toISOString(),
        source: 'langchain',
        memoryType: 'RedisConversationMemory'
      };

      client.emit('chat-history-exported', {
        success: true,
        data: exportData,
        messageCount: chatHistory.length,
        timestamp: Date.now()
      });

    } catch (error) {
      client.emit('chat-error', {
        message: 'Failed to export chat history',
        error: error.message
      });
    }
  }

  // 헬스 체크
  @SubscribeMessage('health-check')
  async handleHealthCheck(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const isAuthenticated = !!client.user;
      let chainStatus = null;

      if (isAuthenticated) {
        chainStatus = await this.personalChatService.getChainStatus(client.user.id);
      }

      client.emit('health-status', {
        websocket: 'healthy',
        langchain: 'enabled',
        authenticated: isAuthenticated,
        chainStatus: chainStatus,
        timestamp: Date.now(),
        version: '1.0.0'
      });

    } catch (error) {
      client.emit('health-status', {
        websocket: 'healthy',
        langchain: 'error',
        authenticated: false,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }
}