// 글로벌 예외 필터
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AdvancedErrorHandlerService, ErrorContext } from './advanced-error-handler.service';
import { ErrorMonitoringService } from './error-monitoring.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly errorHandler: AdvancedErrorHandlerService,
    private readonly errorMonitoring: ErrorMonitoringService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 에러 정보 추출
    const error = exception instanceof Error ? exception : new Error(String(exception));
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // 에러 컨텍스트 구성
    const errorContext: ErrorContext = {
      userId: (request as any).user?.id,
      sessionId: (request as any).sessionId,
      requestId: (request as any).requestId || this.generateRequestId(),
      component: this.extractComponent(request.path),
      operation: `${request.method} ${request.path}`,
      metadata: {
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        body: request.body,
        query: request.query,
        params: request.params,
      },
      timestamp: new Date(),
    };

    try {
      // 에러 모니터링 서비스에 이벤트 전송
      await this.errorMonitoring.processErrorEvent(error, errorContext);

      // 에러 복구 시도
      const recoveryResult = await this.errorHandler.handleError(error, errorContext);

      if (recoveryResult.recovered && recoveryResult.result) {
        // 복구 성공 - 복구된 결과 반환
        response.status(HttpStatus.OK).json({
          success: true,
          data: recoveryResult.result,
          warning: '일시적인 문제가 있었지만 복구되었습니다.',
          recovery: {
            strategy: recoveryResult.recoveryStrategy,
            fallbackUsed: recoveryResult.fallbackUsed,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 복구 실패 또는 불가능 - 적절한 에러 응답 반환
      const errorResponse = this.createErrorResponse(error, status, errorContext, recoveryResult);
      response.status(status).json(errorResponse);

    } catch (handlingError) {
      // 에러 처리 중 오류 발생 - 최소한의 안전한 응답
      this.logger.error('에러 처리 중 오류 발생:', handlingError);
      
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
        code: 'SYSTEM_ERROR',
        timestamp: new Date().toISOString(),
        requestId: errorContext.requestId,
      });
    }
  }

  private extractComponent(path: string): string {
    // URL 경로에서 컴포넌트 추출
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length >= 2 && segments[0] === 'api') {
      return segments[1] || 'unknown'; // /api/users -> users
    }
    
    return segments[0] || 'unknown';
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createErrorResponse(
    error: Error, 
    status: number, 
    context: ErrorContext,
    recoveryResult: any
  ): any {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // 기본 에러 응답
    const errorResponse: any = {
      success: false,
      message: this.getUserFriendlyMessage(error, status),
      code: this.getErrorCode(error, status),
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
    };

    // 복구 정보 추가
    if (recoveryResult.fallbackUsed) {
      errorResponse.fallback = {
        used: true,
        strategy: recoveryResult.recoveryStrategy,
        nextAction: recoveryResult.nextAction,
      };
    }

    // 개발 환경에서만 상세 정보 포함
    if (!isProduction) {
      errorResponse.debug = {
        error: error.message,
        stack: error.stack,
        context: {
          component: context.component,
          operation: context.operation,
          userId: context.userId,
        },
      };
    }

    // 특정 에러 타입별 추가 정보
    if (error.message.includes('rate limit')) {
      errorResponse.retryAfter = this.calculateRetryDelay(error);
    }

    if (error.message.includes('validation')) {
      errorResponse.validationErrors = this.extractValidationErrors(error);
    }

    return errorResponse;
  }

  private getUserFriendlyMessage(error: Error, status: number): string {
    // HTTP 상태 코드별 사용자 친화적 메시지
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return '요청에 문제가 있습니다. 입력 정보를 확인해주세요.';
      case HttpStatus.UNAUTHORIZED:
        return '인증이 필요합니다. 로그인 후 다시 시도해주세요.';
      case HttpStatus.FORBIDDEN:
        return '이 작업을 수행할 권한이 없습니다.';
      case HttpStatus.NOT_FOUND:
        return '요청하신 리소스를 찾을 수 없습니다.';
      case HttpStatus.METHOD_NOT_ALLOWED:
        return '허용되지 않은 요청 방식입니다.';
      case HttpStatus.CONFLICT:
        return '요청이 현재 상태와 충돌합니다.';
      case HttpStatus.TOO_MANY_REQUESTS:
        return '너무 많은 요청을 보내셨습니다. 잠시 후 다시 시도해주세요.';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
      case HttpStatus.BAD_GATEWAY:
        return '외부 서비스와의 연결에 문제가 있습니다.';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return '서비스를 일시적으로 사용할 수 없습니다.';
      case HttpStatus.GATEWAY_TIMEOUT:
        return '요청 처리 시간이 초과되었습니다.';
      default:
        // 에러 메시지 기반 친화적 변환
        if (error.message.includes('connection')) {
          return '서비스 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('timeout')) {
          return '요청 처리 시간이 초과되었습니다. 다시 시도해주세요.';
        } else if (error.message.includes('not found')) {
          return '요청하신 정보를 찾을 수 없습니다.';
        } else if (error.message.includes('validation')) {
          return '입력 정보에 오류가 있습니다. 확인 후 다시 시도해주세요.';
        } else {
          return '요청을 처리하는 중 문제가 발생했습니다.';
        }
    }
  }

  private getErrorCode(error: Error, status: number): string {
    // 에러 코드 생성
    if (error.message.includes('rate limit')) {
      return 'RATE_LIMIT_EXCEEDED';
    } else if (error.message.includes('validation')) {
      return 'VALIDATION_ERROR';
    } else if (error.message.includes('connection')) {
      return 'CONNECTION_ERROR';
    } else if (error.message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    } else if (error.message.includes('not found')) {
      return 'RESOURCE_NOT_FOUND';
    } else if (error.message.includes('unauthorized')) {
      return 'UNAUTHORIZED_ACCESS';
    } else if (error.message.includes('forbidden')) {
      return 'FORBIDDEN_ACCESS';
    } else {
      return `HTTP_${status}`;
    }
  }

  private calculateRetryDelay(error: Error): number {
    // Rate limit 에러의 경우 재시도 지연 시간 계산
    const match = error.message.match(/retry after (\d+)/i);
    return match && match[1] ? parseInt(match[1]) : 60; // 기본 60초
  }

  private extractValidationErrors(error: Error): any[] {
    // 유효성 검사 에러에서 상세 정보 추출
    try {
      if (error.message.includes('validation')) {
        // 실제로는 더 복잡한 파싱 로직 필요
        return [{
          field: 'unknown',
          message: error.message,
        }];
      }
    } catch {
      // 파싱 실패시 무시
    }
    return [];
  }
}