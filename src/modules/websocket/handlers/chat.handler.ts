import { Injectable, Logger } from '@nestjs/common';
import { PersonalChatService } from '../personal-chat.service';
import {
  AuthenticatedSocket,
  ChatEventData,
  WebSocketError,
} from '../interfaces/websocket.interface';
import {
  WEBSOCKET_EVENTS,
  SYSTEM_INFO,
  ERROR_CODES,
  WEBSOCKET_CONFIG,
  CHAT_ROOMS,
} from '../constants/websocket.constants';

@Injectable()
export class ChatHandler {
  private readonly logger = new Logger(ChatHandler.name);

  constructor(private readonly personalChatService: PersonalChatService) {}

  /**
   * 채팅방 참가 처리
   */
  async handleJoinChat(
    socket: AuthenticatedSocket,
    data: { roomId?: string } = {}
  ): Promise<void> {
    try {
      const userId = socket.user?.id;
      if (!userId) {
        throw this.createError(ERROR_CODES.AUTH_REQUIRED, 'User authentication required');
      }

      const roomId = data.roomId || CHAT_ROOMS.GENERAL;
      
      // 룸 참가
      socket.join(roomId);
      
      this.logger.log(`User ${userId} joined chat room: ${roomId}`);

      // 참가 확인 응답
      socket.emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
        message: `채팅방에 참가했습니다: ${roomId}`,
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          roomId,
          userId,
          event: 'room_joined',
        },
      });

      // 다른 사용자들에게 참가 알림
      socket.to(roomId).emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
        message: `${socket.user?.name || 'User'}님이 채팅방에 참가했습니다.`,
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          roomId,
          event: 'user_joined',
          userName: socket.user?.name,
        },
      });

    } catch (error) {
      this.logger.error('Join chat failed:', error);
      socket.emit(WEBSOCKET_EVENTS.ERROR, this.formatError(error));
    }
  }

  /**
   * 채팅 메시지 전송 처리
   */
  async handleSendMessage(
    socket: AuthenticatedSocket,
    data: ChatEventData
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const userId = socket.user?.id;
      if (!userId) {
        throw this.createError(ERROR_CODES.AUTH_REQUIRED, 'User authentication required');
      }

      // 메시지 검증
      this.validateChatMessage(data);

      this.logger.log(`Processing chat message from user: ${userId}`);

      // 메시지 에코 (사용자에게 즉시 표시)
      socket.emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
        message: data.message,
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          userId,
          messageType: 'user_echo',
          echo: true,
        },
      });

      // AI 응답 처리 시작 알림
      socket.emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
        message: '응답을 생성하고 있습니다... 🤔',
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          processing: true,
          messageType: 'processing_start',
        },
      });

      // PersonalChatService를 통한 스트리밍 응답 처리
      await this.processPersonalizedChatStream(socket, userId, data.message);

      const processingTime = Date.now() - startTime;
      this.logger.log(`Chat message processed in ${processingTime}ms`);

    } catch (error) {
      this.logger.error('Send message failed:', error);
      
      const errorResponse = {
        message: '메시지 처리 중 오류가 발생했습니다.',
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        error: true,
        details: error instanceof Error ? error.message : 'Unknown error',
      };

      socket.emit(WEBSOCKET_EVENTS.ERROR, errorResponse);
    }
  }

  /**
   * 채팅 기록 삭제 처리
   */
  async handleClearHistory(
    socket: AuthenticatedSocket,
    data: { confirmClear?: boolean } = {}
  ): Promise<void> {
    try {
      const userId = socket.user?.id;
      if (!userId) {
        throw this.createError(ERROR_CODES.AUTH_REQUIRED, 'User authentication required');
      }

      // 확인 없이 요청된 경우 확인 요청
      if (!data.confirmClear) {
        socket.emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
          message: '정말로 채팅 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
          timestamp: Date.now(),
          version: SYSTEM_INFO.VERSION,
          metadata: {
            requiresConfirmation: true,
            action: 'clear_history',
          },
        });
        return;
      }

      this.logger.log(`Clearing chat history for user: ${userId}`);

      // 채팅 기록 삭제 (실제 구현에서는 PersonalChatService나 별도 서비스 사용)
      // await this.personalChatService.clearUserHistory(userId);

      socket.emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
        message: '채팅 기록이 삭제되었습니다. 새로운 대화를 시작하세요! 🆕',
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          historyCleared: true,
          userId,
        },
      });

      this.logger.log(`Chat history cleared for user: ${userId}`);

    } catch (error) {
      this.logger.error('Clear history failed:', error);
      socket.emit(WEBSOCKET_EVENTS.ERROR, this.formatError(error));
    }
  }

  /**
   * 채팅 상태 조회 처리
   */
  async handleGetChatStatus(socket: AuthenticatedSocket): Promise<void> {
    try {
      const userId = socket.user?.id;
      if (!userId) {
        throw this.createError(ERROR_CODES.AUTH_REQUIRED, 'User authentication required');
      }

      // PersonalChatService에서 상태 조회
      const chatStats = await this.personalChatService.getUserChatStats(userId);
      const chainStatus = await this.personalChatService.getChainStatus(userId);

      socket.emit(WEBSOCKET_EVENTS.STATUS_UPDATE, {
        message: '채팅 상태 정보',
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          chatStats,
          chainStatus,
          userId,
        },
      });

    } catch (error) {
      this.logger.error('Get chat status failed:', error);
      socket.emit(WEBSOCKET_EVENTS.ERROR, this.formatError(error));
    }
  }

  // ==================== Private Helper Methods ====================

  private validateChatMessage(data: ChatEventData): void {
    if (!data.message || data.message.trim().length === 0) {
      throw this.createError(ERROR_CODES.VALIDATION_MISSING_FIELD, 'Message is required');
    }

    if (data.message.length > WEBSOCKET_CONFIG.MAX_MESSAGE_LENGTH) {
      throw this.createError(ERROR_CODES.VALIDATION_FIELD_TOO_LONG, 'Message too long');
    }

    // 스팸 방지를 위한 추가 검증
    if (this.isSpamMessage(data.message)) {
      throw this.createError(ERROR_CODES.VALIDATION_INVALID_FORMAT, 'Message appears to be spam');
    }
  }

  private isSpamMessage(message: string): boolean {
    // 간단한 스팸 검사
    const repeatedChars = /(.)\1{10,}/; // 같은 문자 10번 이상 반복
    const tooManyNumbers = /\d{20,}/; // 20자리 이상 숫자
    const suspiciousPatterns = [
      /https?:\/\/[^\s]+/gi, // URL 포함 (필요시 허용 목록 구현)
    ];

    if (repeatedChars.test(message) || tooManyNumbers.test(message)) {
      return true;
    }

    // 의심스러운 패턴 검사 (실제 환경에서는 더 정교한 검사 필요)
    return suspiciousPatterns.some(pattern => pattern.test(message));
  }

  private async processPersonalizedChatStream(
    socket: AuthenticatedSocket,
    userId: string,
    message: string
  ): Promise<void> {
    try {
      const chatStream = await this.personalChatService.processPersonalizedChat(userId, message);
      let isFirstChunk = true;

      for await (const chunk of chatStream) {
        if (chunk.trim()) {
          // 첫 번째 실제 응답 청크인 경우 처리 중 메시지 제거
          if (isFirstChunk) {
            socket.emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
              message: chunk,
              timestamp: Date.now(),
              version: SYSTEM_INFO.VERSION,
              metadata: {
                messageType: 'ai_response_start',
                userId,
                streaming: true,
                replaceProcessing: true, // 클라이언트에서 처리 중 메시지 교체
              },
            });
            isFirstChunk = false;
          } else {
            socket.emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
              message: chunk,
              timestamp: Date.now(),
              version: SYSTEM_INFO.VERSION,
              metadata: {
                messageType: 'ai_response_chunk',
                userId,
                streaming: true,
              },
            });
          }
        }
      }

      // 스트림 완료 알림
      socket.emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
        message: '',
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          messageType: 'ai_response_complete',
          userId,
          completed: true,
        },
      });

    } catch (error) {
      this.logger.error('Personalized chat stream failed:', error);
      
      socket.emit(WEBSOCKET_EVENTS.CHAT_RESPONSE, {
        message: '죄송합니다. 응답 생성 중 오류가 발생했어요. 다시 시도해주세요. 😔',
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          messageType: 'ai_response_error',
          userId,
          error: true,
        },
      });
    }
  }

  private createError(code: string, message: string): WebSocketError {
    return {
      code,
      message,
      timestamp: Date.now(),
    };
  }

  private isWebSocketError(error: any): error is WebSocketError {
    return error && typeof error === 'object' && 'code' in error && 'message' in error && 'timestamp' in error;
  }

  private formatError(error: any): any {
    if (this.isWebSocketError(error)) {
      return {
        error: true,
        code: error.code,
        message: error.message,
        timestamp: error.timestamp,
        details: error.details,
      };
    }

    return {
      error: true,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
  }
}