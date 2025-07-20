import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  AuthenticatedSocket,
  ClientConnectionInfo,
  UserProfile,
  ConnectionMetrics,
  WebSocketError,
} from '../interfaces/websocket.interface';
import {
  WEBSOCKET_CONFIG,
  ERROR_CODES,
  ERROR_MESSAGES,
} from '../constants/websocket.constants';

@Injectable()
export class ConnectionManager {
  private readonly logger = new Logger(ConnectionManager.name);
  private readonly connectedClients = new Map<string, ClientConnectionInfo>();
  private readonly userSocketMap = new Map<string, string>(); // userId -> socketId
  private connectionMetrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    authenticatedConnections: 0,
    averageSessionDuration: 0,
    totalMessages: 0,
    messagesPerSecond: 0,
    errorRate: 0,
  };
  private server: Server | null = null;

  /**
   * WebSocket 서버 설정
   */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('WebSocket server configured');
  }

  /**
   * 클라이언트 연결 처리
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const clientId = socket.id;
      this.logger.log(`Client connecting: ${clientId}`);

      // 연결 정보 초기화
      this.connectedClients.set(clientId, {
        socket,
        user: this.createGuestUser(clientId),
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        roomIds: new Set(),
      });

      // 메트릭스 업데이트
      this.connectionMetrics.totalConnections++;
      this.connectionMetrics.activeConnections++;

      this.logger.log(`Client connected: ${clientId} (Total: ${this.connectionMetrics.activeConnections})`);

      // 연결 확인 응답
      socket.emit('connection_established', {
        clientId,
        timestamp: Date.now(),
        serverVersion: '1.0',
        features: ['chat', 'langgraph', 'streaming'],
      });

    } catch (error) {
      this.logger.error('Connection handling failed:', error);
      socket.emit('connection_error', this.createError(
        ERROR_CODES.INTERNAL_ERROR,
        'Connection setup failed'
      ));
      socket.disconnect();
    }
  }

  /**
   * 클라이언트 연결 해제 처리
   */
  async handleDisconnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const clientId = socket.id;
      const clientInfo = this.connectedClients.get(clientId);

      if (clientInfo) {
        const sessionDuration = Date.now() - clientInfo.connectedAt;
        
        this.logger.log(`Client disconnecting: ${clientId} (Session: ${sessionDuration}ms)`);

        // 사용자 매핑 제거
        if (clientInfo.user.id !== clientId) {
          this.userSocketMap.delete(clientInfo.user.id);
        }

        // 룸에서 제거
        clientInfo.roomIds.forEach(roomId => {
          socket.leave(roomId);
        });

        // 클라이언트 정보 제거
        this.connectedClients.delete(clientId);

        // 메트릭스 업데이트
        this.connectionMetrics.activeConnections--;
        if (clientInfo.user.id !== clientId) {
          this.connectionMetrics.authenticatedConnections--;
        }

        this.updateAverageSessionDuration(sessionDuration);

        this.logger.log(`Client disconnected: ${clientId} (Remaining: ${this.connectionMetrics.activeConnections})`);
      }
    } catch (error) {
      this.logger.error('Disconnection handling failed:', error);
    }
  }

  /**
   * 사용자 인증 후 클라이언트 정보 업데이트
   */
  async authenticateClient(
    socket: AuthenticatedSocket,
    userProfile: UserProfile
  ): Promise<void> {
    try {
      const clientId = socket.id;
      const clientInfo = this.connectedClients.get(clientId);

      if (!clientInfo) {
        throw new Error('Client connection not found');
      }

      // 기존 연결이 있다면 해제
      const existingSocketId = this.userSocketMap.get(userProfile.id);
      if (existingSocketId && existingSocketId !== clientId) {
        const existingSocket = this.connectedClients.get(existingSocketId)?.socket;
        if (existingSocket) {
          existingSocket.emit('session_replaced', {
            message: '다른 곳에서 로그인되어 연결이 해제됩니다.',
            timestamp: Date.now(),
          });
          existingSocket.disconnect();
        }
      }

      // 클라이언트 정보 업데이트
      clientInfo.user = userProfile;
      socket.user = {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
      };
      socket.isAuthenticated = true;
      socket.authTimestamp = Date.now();

      // 사용자 매핑 업데이트
      this.userSocketMap.set(userProfile.id, clientId);

      // 메트릭스 업데이트
      this.connectionMetrics.authenticatedConnections++;

      this.logger.log(`Client authenticated: ${clientId} (User: ${userProfile.email})`);

    } catch (error) {
      this.logger.error('Client authentication failed:', error);
      throw error;
    }
  }

  /**
   * 클라이언트 활동 업데이트
   */
  updateClientActivity(clientId: string): void {
    const clientInfo = this.connectedClients.get(clientId);
    if (clientInfo) {
      clientInfo.lastActivity = Date.now();
      clientInfo.messageCount++;
      this.connectionMetrics.totalMessages++;
    }
  }

  /**
   * 클라이언트 룸 참가
   */
  async joinRoom(clientId: string, roomId: string): Promise<void> {
    const clientInfo = this.connectedClients.get(clientId);
    if (clientInfo) {
      clientInfo.socket.join(roomId);
      clientInfo.roomIds.add(roomId);
      this.logger.debug(`Client ${clientId} joined room: ${roomId}`);
    }
  }

  /**
   * 클라이언트 룸 떠나기
   */
  async leaveRoom(clientId: string, roomId: string): Promise<void> {
    const clientInfo = this.connectedClients.get(clientId);
    if (clientInfo) {
      clientInfo.socket.leave(roomId);
      clientInfo.roomIds.delete(roomId);
      this.logger.debug(`Client ${clientId} left room: ${roomId}`);
    }
  }

  /**
   * 특정 사용자에게 메시지 전송
   */
  async sendToUser(userId: string, event: string, data: any): Promise<boolean> {
    const socketId = this.userSocketMap.get(userId);
    if (socketId) {
      const clientInfo = this.connectedClients.get(socketId);
      if (clientInfo) {
        clientInfo.socket.emit(event, data);
        return true;
      }
    }
    return false;
  }

  /**
   * 룸에 메시지 브로드캐스트
   */
  async broadcastToRoom(roomId: string, event: string, data: any): Promise<void> {
    if (this.server) {
      this.server.to(roomId).emit(event, data);
    }
  }

  /**
   * 모든 클라이언트에게 메시지 브로드캐스트
   */
  async broadcastToAll(event: string, data: any): Promise<void> {
    if (this.server) {
      this.server.emit(event, data);
    }
  }

  /**
   * 연결된 클라이언트 정보 조회
   */
  getClientInfo(clientId: string): ClientConnectionInfo | null {
    return this.connectedClients.get(clientId) || null;
  }

  /**
   * 사용자의 연결 상태 확인
   */
  isUserConnected(userId: string): boolean {
    return this.userSocketMap.has(userId);
  }

  /**
   * 연결 메트릭스 조회
   */
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }

  /**
   * 비활성 연결 정리
   */
  async cleanupInactiveConnections(): Promise<void> {
    const now = Date.now();
    const timeout = WEBSOCKET_CONFIG.SESSION_DURATION;
    let cleanedCount = 0;

    for (const [clientId, clientInfo] of this.connectedClients.entries()) {
      const inactiveTime = now - clientInfo.lastActivity;
      
      if (inactiveTime > timeout) {
        this.logger.log(`Cleaning up inactive connection: ${clientId}`);
        clientInfo.socket.emit('session_timeout', {
          message: '세션이 만료되어 연결이 해제됩니다.',
          timestamp: now,
        });
        clientInfo.socket.disconnect();
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} inactive connections`);
    }
  }

  // ==================== Private Helper Methods ====================

  private createGuestUser(clientId: string): UserProfile {
    return {
      id: clientId,
      email: 'guest',
      name: 'Guest',
      joinedAt: Date.now(),
    };
  }

  private createError(code: string, message?: string): WebSocketError {
    return {
      code,
      message: message || ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || 'Unknown error',
      timestamp: Date.now(),
    };
  }

  private updateAverageSessionDuration(newDuration: number): void {
    const totalSessions = this.connectionMetrics.totalConnections;
    const currentAverage = this.connectionMetrics.averageSessionDuration;
    
    this.connectionMetrics.averageSessionDuration = 
      ((currentAverage * (totalSessions - 1)) + newDuration) / totalSessions;
  }

  /**
   * 정기적인 메트릭스 업데이트 (주기적으로 호출)
   */
  updateMetrics(): void {
    // 메시지 처리 속도 계산 등 추가 메트릭스 로직
    const now = Date.now();
    // 구현 필요: 메시지/초 계산, 에러율 계산 등
  }
}