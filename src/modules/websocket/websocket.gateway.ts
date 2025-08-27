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
import { LangChainService } from '../langchain/langchain.service';
import { ReactAgentService } from '../langchain/services/react-agent.service';
import { WEBSOCKET_CONFIG } from './constants/websocket.constants';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: WEBSOCKET_CONFIG.PING_TIMEOUT,
  pingInterval: WEBSOCKET_CONFIG.PING_INTERVAL,
  connectTimeout: WEBSOCKET_CONFIG.CONNECT_TIMEOUT,
  upgradeTimeout: WEBSOCKET_CONFIG.UPGRADE_TIMEOUT,
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedClients = new Map<string, Socket>();

  constructor(
    private readonly langChainService: LangChainService,
    private readonly reactAgentService: ReactAgentService,
  ) {}

  afterInit(_server: Server) {
    const websocketPort = process.env.WEBSOCKET_PORT || 8083;
    this.logger.log(`🚀 WebSocket Gateway initialized on port ${websocketPort}`);
  }

  async handleConnection(client: Socket) {
    const clientId = client.id;
    this.connectedClients.set(clientId, client);
    this.logger.log(`🔌 [${clientId}] New connection. Total connected: ${this.connectedClients.size}`);

    client.emit('connection-status', {
      connected: true,
      clientId: client.id,
      timestamp: Date.now()
    });
  }

  handleDisconnect(client: Socket) {
    const clientId = client.id;
    const hadClient = this.connectedClients.has(clientId);
    this.connectedClients.delete(clientId);
    
    this.logger.log(`🔌 [${clientId}] Client disconnected (was tracked: ${hadClient}). Total connected: ${this.connectedClients.size}`);
    
    // 연결 해제 원인 분석을 위한 추가 정보
    const disconnectReason = client.disconnected ? 'already disconnected' : 'graceful disconnect';
    this.logger.warn(`📊 [${clientId}] Disconnect reason: ${disconnectReason}`, {
      timestamp: new Date().toISOString(),
      socketId: clientId,
      transport: (client as any)?.conn?.transport?.name || 'unknown',
      readyState: (client as any)?.conn?.readyState || 'unknown'
    });
  }

  /**
   * Ping/Pong for connection health check
   */
  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', {
      timestamp: Date.now(),
      clientId: client.id
    });
  }

  /**
   * 일반 대화 메시지 처리 (비스트리밍)
   */
  @SubscribeMessage('conversation_message')
  async handleConversationMessage(
    @MessageBody() data: { 
      message: string; 
      sessionId?: string;
      context?: {
        history?: Array<{ type: string; text: string; timestamp: string }>;
        allergies?: string[];
        cookingLevel?: string;
      }
    },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = data.sessionId || client.id;
    this.logger.log(`💬 [${sessionId}] Non-streaming message: ${data.message.substring(0, 50)}...`);

    try {
      // LangChain 서비스에서 일반 응답 처리
      const searchResponse = await this.langChainService.searchAndProcessRecipes(data.message, data.context);
      
      const response = {
        content: searchResponse.content,
        sessionId,
        metadata: searchResponse.metadata,
        recipes: searchResponse.recipes || [],
        timestamp: new Date().toISOString(),
      };

      client.emit('conversation_response', response);
      this.logger.log(`✅ [${sessionId}] Non-streaming response sent`);

    } catch (error) {
      this.logger.error(`❌ [${sessionId}] Conversation error:`, error);
      client.emit('conversation_error', {
        message: '메시지 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 🌊 스트리밍 대화 메시지 처리 (리팩토링됨)
   * 순수하게 LangChain 서비스의 응답을 클라이언트에 전달만 수행
   */
  @SubscribeMessage('conversation_stream')
  async handleConversationStream(
    @MessageBody() data: { 
      message: string; 
      sessionId?: string;
      context?: {
        history?: Array<{ type: string; text: string; timestamp: string }>;
        allergies?: string[];
        cookingLevel?: string;
      }
    },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = data.sessionId || client.id;
    this.logger.log(`📥 [Backend] Received conversation_stream from [${sessionId}]: ${data.message.substring(0, 50)}...`);

    if (!client.connected) {
      this.logger.warn(`⚠️ [${sessionId}] Client not connected, aborting`);
      return;
    }

    try {
      // LangChain 모듈의 통합된 스트리밍 서비스 호출
      const streamGenerator = this.langChainService.processConversationStream(
        data.message, 
        sessionId, 
        data.context
      );

      let chunkCount = 0;
      const startTime = Date.now();

      // 스트리밍 청크를 단순히 전달
      for await (const chunk of streamGenerator) {
        // 청크를 클라이언트에게 전달
        try {
          this.logger.debug(`📤 [Backend] Sending conversation_chunk to [${sessionId}] - chunk ${chunkCount + 1}, type: ${chunk.type}`);
          client.emit('conversation_chunk', chunk);
          chunkCount++;
          
          // 10개 청크마다 연결 상태 확인 (성능 최적화)
          if (chunkCount % 10 === 0) {
            const isClientConnected = client.connected;
            const isClientTracked = this.connectedClients.has(client.id);
            
            this.logger.debug(`🔍 [${sessionId}] Connection check at chunk ${chunkCount}:`, {
              clientConnected: isClientConnected,
              clientTracked: isClientTracked,
              socketId: client.id,
              connectedCount: this.connectedClients.size
            });
            
            if (!isClientConnected || !isClientTracked) {
              this.logger.warn(`⚠️ [${sessionId}] Client disconnected during streaming after ${chunkCount} chunks`, {
                clientConnected: isClientConnected,
                clientTracked: isClientTracked,
                socketId: client.id,
                disconnectReason: client.disconnected ? 'already_disconnected' : 'graceful_disconnect'
              });
              break;
            }
          }
        } catch (error) {
          this.logger.error(`❌ [${sessionId}] Error sending chunk ${chunkCount}:`, error);
          break;
        }
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ [${sessionId}] Streaming completed - ${chunkCount} chunks in ${processingTime}ms`);

    } catch (error) {
      this.logger.error(`❌ [${sessionId}] Streaming error:`, error);
      
      // 에러 청크 전송
      if (client.connected) {
        client.emit('conversation_chunk', {
          type: 'error',
          content: '메시지 처리 중 오류가 발생했습니다.',
          sessionId,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * 🧠 ReAct 스트리밍 대화 메시지 처리
   * 단계별 추론 과정을 실시간으로 스트리밍
   */
  @SubscribeMessage('conversation_react_stream')
  async handleReactConversationStream(
    @MessageBody() data: { 
      message: string; 
      sessionId?: string;
      context?: {
        history?: Array<{ type: string; text: string; timestamp: string }>;
        allergies?: string[];
        cookingLevel?: string;
      }
    },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = data.sessionId || client.id;
    this.logger.log(`📥 [Backend] Received conversation_react_stream from [${sessionId}]: ${data.message.substring(0, 50)}...`);

    if (!client.connected) {
      this.logger.warn(`⚠️ [${sessionId}] Client not connected, aborting`);
      return;
    }

    try {
      // ReAct 에이전트 스트리밍 실행
      const reactStreamGenerator = this.reactAgentService.executeReactStream(
        data.message, 
        sessionId, 
        data.context
      );

      let chunkCount = 0;
      const startTime = Date.now();

      // ReAct 스트리밍 청크를 클라이언트에게 전달
      for await (const chunk of reactStreamGenerator) {
        try {
          // ReAct 전용 이벤트로 전송
          this.logger.debug(`📤 [Backend] Sending react_chunk to [${sessionId}] - chunk ${chunkCount + 1}, type: ${chunk.type}`);
          client.emit('react_chunk', chunk);
          chunkCount++;
          
          // 연결 상태 확인
          if (chunkCount % 5 === 0) {
            if (!client.connected || !this.connectedClients.has(client.id)) {
              this.logger.warn(`⚠️ [${sessionId}] Client disconnected during ReAct streaming after ${chunkCount} chunks`);
              break;
            }
          }
        } catch (error) {
          this.logger.error(`❌ [${sessionId}] Error sending ReAct chunk ${chunkCount}:`, error);
          break;
        }
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ [${sessionId}] ReAct streaming completed - ${chunkCount} chunks in ${processingTime}ms`);

    } catch (error) {
      this.logger.error(`❌ [${sessionId}] ReAct streaming error:`, error);
      
      // 에러 청크 전송
      if (client.connected) {
        client.emit('react_chunk', {
          type: 'error',
          content: 'ReAct 처리 중 오류가 발생했습니다.',
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * 대화 히스토리 요청 처리
   */
  @SubscribeMessage('conversation_get_history')
  async handleGetConversationHistory(@ConnectedSocket() client: Socket) {
    try {
      // 프론트엔드에서 히스토리를 관리하므로 빈 응답 전송
      client.emit('conversation_history', {
        conversations: [],
        userContext: null,
        metadata: {
          message: '히스토리는 프론트엔드에서 관리됩니다.'
        },
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`📚 [${client.id}] Empty conversation history sent (frontend managed)`);

    } catch (error) {
      this.logger.error(`❌ [${client.id}] History error:`, error);
      client.emit('conversation_error', {
        message: '히스토리 로드 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    }
  }


  /**
   * 연결된 클라이언트 수 반환
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}