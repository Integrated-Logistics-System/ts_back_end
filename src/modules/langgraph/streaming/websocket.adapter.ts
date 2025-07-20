import { Injectable, Logger } from '@nestjs/common';
import { WebSocketStreamChunk } from '@/shared/interfaces/langgraph.interface';

@Injectable()
export class WebSocketAdapter {
  private readonly logger = new Logger(WebSocketAdapter.name);

  /**
   * WebSocket 청크 데이터를 표준 형태로 변환
   */
  formatChunk(chunk: WebSocketStreamChunk): WebSocketStreamChunk {
    return {
      type: chunk.type,
      content: chunk.content,
      timestamp: chunk.timestamp || Date.now(),
      userId: chunk.userId,
      query: chunk.query,
      data: chunk.data,
    };
  }

  /**
   * 에러를 WebSocket 청크로 변환
   */
  formatError(error: Error, userId?: string, query?: string): WebSocketStreamChunk {
    return {
      type: 'error',
      content: `오류: ${error.message}`,
      timestamp: Date.now(),
      userId,
      query,
      data: {
        error: error.message,
        stack: error.stack,
      },
    };
  }

  /**
   * 상태 메시지를 WebSocket 청크로 변환
   */
  formatStatus(message: string, userId?: string, query?: string, data?: any): WebSocketStreamChunk {
    return {
      type: 'status',
      content: message,
      timestamp: Date.now(),
      userId,
      query,
      data,
    };
  }

  /**
   * 완료 메시지를 WebSocket 청크로 변환
   */
  formatComplete(content: string, userId?: string, query?: string, data?: any): WebSocketStreamChunk {
    return {
      type: 'complete',
      content,
      timestamp: Date.now(),
      userId,
      query,
      data,
    };
  }

  /**
   * 스트리밍 청크 검증
   */
  validateChunk(chunk: WebSocketStreamChunk): boolean {
    if (!chunk.type || !chunk.content) {
      this.logger.warn('Invalid chunk: missing type or content');
      return false;
    }

    const validTypes = ['status', 'complete', 'error', 'message'];
    if (!validTypes.includes(chunk.type)) {
      this.logger.warn(`Invalid chunk type: ${chunk.type}`);
      return false;
    }

    return true;
  }

  /**
   * 청크 크기 제한 확인
   */
  checkChunkSize(chunk: WebSocketStreamChunk, maxSize: number = 10000): boolean {
    const chunkSize = JSON.stringify(chunk).length;
    if (chunkSize > maxSize) {
      this.logger.warn(`Chunk size ${chunkSize} exceeds limit ${maxSize}`);
      return false;
    }
    return true;
  }

  /**
   * 민감한 정보 필터링
   */
  sanitizeChunk(chunk: WebSocketStreamChunk): WebSocketStreamChunk {
    // 민감한 정보가 포함된 경우 제거
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /api[_-]?key/i,
      /private[_-]?key/i,
    ];

    let sanitizedContent = chunk.content;
    
    for (const pattern of sensitivePatterns) {
      if (pattern.test(sanitizedContent)) {
        sanitizedContent = sanitizedContent.replace(pattern, '[FILTERED]');
      }
    }

    return {
      ...chunk,
      content: sanitizedContent,
    };
  }

  /**
   * 청크 배치 처리
   */
  async *processBatch(chunks: WebSocketStreamChunk[]): AsyncGenerator<WebSocketStreamChunk, void, unknown> {
    for (const chunk of chunks) {
      if (this.validateChunk(chunk) && this.checkChunkSize(chunk)) {
        yield this.sanitizeChunk(chunk);
      }
    }
  }

  /**
   * 연결 상태 확인용 핑 메시지 생성
   */
  createPingMessage(userId?: string): WebSocketStreamChunk {
    return {
      type: 'status',
      content: 'ping',
      timestamp: Date.now(),
      userId,
      data: {
        type: 'ping',
      },
    };
  }

  /**
   * 연결 해제 메시지 생성
   */
  createDisconnectMessage(userId?: string, reason?: string): WebSocketStreamChunk {
    return {
      type: 'status',
      content: 'disconnect',
      timestamp: Date.now(),
      userId,
      data: {
        type: 'disconnect',
        reason,
      },
    };
  }
}