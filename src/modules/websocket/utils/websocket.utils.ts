import { Injectable } from '@nestjs/common';
import {
  WebSocketError,
  WebSocketResponse,
  RateLimitInfo,
  AuthenticatedSocket,
} from '../interfaces/websocket.interface';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  WEBSOCKET_CONFIG,
  RESPONSE_TYPES,
  SYSTEM_INFO,
  WEBSOCKET_EVENTS,
} from '../constants/websocket.constants';

@Injectable()
export class WebSocketUtils {
  private readonly rateLimitMap = new Map<string, RateLimitInfo>();

  /**
   * 요청 데이터 검증
   */
  validateEventData(eventName: string, data: any): void {
    if (!data) {
      throw this.createValidationError('data', 'Event data is required');
    }

    // 이벤트별 특별한 검증
    switch (eventName) {
      case 'send_message':
        this.validateChatMessage(data);
        break;
      case 'langgraph_recipe_v2':
      case 'langgraph_rag_v2':
        this.validateLangGraphRequest(data);
        break;
      case 'langgraph_benchmark':
        this.validateBenchmarkRequest(data);
        break;
    }
  }

  /**
   * 요청 빈도 제한 확인
   */
  checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limit = this.rateLimitMap.get(clientId);

    if (!limit) {
      // 새로운 클라이언트
      this.rateLimitMap.set(clientId, {
        requests: 1,
        windowStart: now,
        windowSize: WEBSOCKET_CONFIG.RATE_LIMIT_WINDOW,
        maxRequests: WEBSOCKET_CONFIG.RATE_LIMIT_MAX_REQUESTS,
      });
      return true;
    }

    // 윈도우 시간이 지났으면 리셋
    if (now - limit.windowStart >= limit.windowSize) {
      limit.requests = 1;
      limit.windowStart = now;
      return true;
    }

    // 요청 한도 확인
    if (limit.requests >= limit.maxRequests) {
      return false;
    }

    limit.requests++;
    return true;
  }

  /**
   * 요청 빈도 제한 정보 조회
   */
  getRateLimitInfo(clientId: string): RateLimitInfo | null {
    return this.rateLimitMap.get(clientId) || null;
  }

  /**
   * 클라이언트 요청 빈도 제한 정리
   */
  cleanupRateLimit(clientId: string): void {
    this.rateLimitMap.delete(clientId);
  }

  /**
   * WebSocket 에러 생성
   */
  createError(
    code: string,
    message?: string,
    details?: Record<string, any>,
    requestId?: string
  ): WebSocketError {
    return {
      code,
      message: message || ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || 'Unknown error',
      details,
      timestamp: Date.now(),
      requestId,
    };
  }

  /**
   * 성공 응답 생성
   */
  createSuccessResponse(
    message: string,
    metadata?: Record<string, any>,
    requestId?: string
  ): WebSocketResponse {
    return {
      message,
      timestamp: Date.now(),
      version: SYSTEM_INFO.VERSION,
      type: RESPONSE_TYPES.SUCCESS,
      metadata,
    };
  }

  /**
   * 에러 응답 생성
   */
  createErrorResponse(
    error: WebSocketError,
    requestId?: string
  ): WebSocketResponse {
    return {
      message: error.message,
      timestamp: error.timestamp,
      version: SYSTEM_INFO.VERSION,
      type: RESPONSE_TYPES.ERROR,
      error: error.code,
      metadata: {
        error: {
          code: error.code,
          details: error.details,
        },
        requestId: requestId || error.requestId,
      },
    };
  }

  /**
   * 스트리밍 응답 생성
   */
  createStreamResponse(
    content: string,
    type: 'start' | 'chunk' | 'end',
    metadata?: Record<string, any>
  ): WebSocketResponse {
    return {
      message: content,
      timestamp: Date.now(),
      version: SYSTEM_INFO.VERSION,
      type: type === 'start' ? RESPONSE_TYPES.STREAM_START :
            type === 'end' ? RESPONSE_TYPES.STREAM_END :
            RESPONSE_TYPES.STREAM_CHUNK,
      metadata: {
        streaming: true,
        streamType: type,
        ...metadata,
      },
    };
  }

  /**
   * 입력 데이터 정제
   */
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // 스크립트 태그 제거
      .replace(/<[^>]+>/g, '') // HTML 태그 제거
      .replace(/javascript:/gi, '') // JavaScript URL 제거
      .substring(0, WEBSOCKET_CONFIG.MAX_MESSAGE_LENGTH); // 길이 제한
  }

  /**
   * 클라이언트 정보 추출
   */
  extractClientInfo(socket: AuthenticatedSocket): {
    id: string;
    ip: string;
    userAgent: string;
    origin: string;
  } {
    return {
      id: socket.id,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'] || 'unknown',
      origin: socket.handshake.headers.origin || 'unknown',
    };
  }

  /**
   * 메트릭 수집
   */
  collectMetrics(
    eventName: string,
    processingTime: number,
    success: boolean,
    clientId: string
  ): void {
    // 실제 구현에서는 메트릭 수집 시스템에 전송
    // 예: Prometheus, StatsD, CloudWatch 등
    
    // 로깅을 통한 간단한 메트릭 수집
    const metrics = {
      event: eventName,
      processingTime,
      success,
      clientId,
      timestamp: Date.now(),
    };

    // 실제 메트릭 시스템으로 전송하는 로직 추가 필요
  }

  /**
   * 이벤트 이름 검증
   */
  isValidEventName(eventName: string): boolean {
    const validEvents = Object.values({
      ...Object.values(WEBSOCKET_EVENTS),
    });

    return validEvents.includes(eventName as any);
  }

  /**
   * 요청 ID 생성
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== Private Validation Methods ====================

  private validateChatMessage(data: any): void {
    if (!data.message || typeof data.message !== 'string') {
      throw this.createValidationError('message', 'Message must be a non-empty string');
    }

    if (data.message.trim().length === 0) {
      throw this.createValidationError('message', 'Message cannot be empty');
    }

    if (data.message.length > WEBSOCKET_CONFIG.MAX_MESSAGE_LENGTH) {
      throw this.createValidationError('message', 
        `Message too long (max: ${WEBSOCKET_CONFIG.MAX_MESSAGE_LENGTH})`);
    }
  }

  private validateLangGraphRequest(data: any): void {
    if (!data.query || typeof data.query !== 'string') {
      throw this.createValidationError('query', 'Query must be a non-empty string');
    }

    if (data.query.trim().length === 0) {
      throw this.createValidationError('query', 'Query cannot be empty');
    }

    if (data.query.length > WEBSOCKET_CONFIG.MAX_QUERY_LENGTH) {
      throw this.createValidationError('query', 
        `Query too long (max: ${WEBSOCKET_CONFIG.MAX_QUERY_LENGTH})`);
    }

    if (data.allergies && !Array.isArray(data.allergies)) {
      throw this.createValidationError('allergies', 'Allergies must be an array');
    }

    if (data.preferences && !Array.isArray(data.preferences)) {
      throw this.createValidationError('preferences', 'Preferences must be an array');
    }
  }

  private validateBenchmarkRequest(data: any): void {
    if (!data.queries || !Array.isArray(data.queries)) {
      throw this.createValidationError('queries', 'Queries must be an array');
    }

    if (data.queries.length === 0) {
      throw this.createValidationError('queries', 'At least one query is required');
    }

    if (data.queries.length > 10) {
      throw this.createValidationError('queries', 'Maximum 10 queries allowed');
    }

    data.queries.forEach((query: any, index: number) => {
      if (!query || typeof query !== 'string') {
        throw this.createValidationError(`queries[${index}]`, 'Query must be a string');
      }
    });

    if (data.iterations !== undefined) {
      if (typeof data.iterations !== 'number' || data.iterations < 1 || data.iterations > 10) {
        throw this.createValidationError('iterations', 'Iterations must be between 1 and 10');
      }
    }
  }

  private createValidationError(field: string, message: string): WebSocketError {
    return this.createError(
      ERROR_CODES.VALIDATION_INVALID_FORMAT,
      `${field}: ${message}`,
      { field, validation: message }
    );
  }
}