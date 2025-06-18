import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      
      if (typeof errorResponse === 'object' && errorResponse !== null) {
        message = (errorResponse as any).message || exception.message;
        error = (errorResponse as any).error || 'Http Exception';
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      
      // 특정 에러 타입별 처리
      if (exception.message.includes('ECONNREFUSED')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = '외부 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
        error = 'Service Unavailable';
      } else if (exception.message.includes('timeout')) {
        status = HttpStatus.REQUEST_TIMEOUT;
        message = '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
        error = 'Request Timeout';
      } else if (exception.message.includes('검색어')) {
        status = HttpStatus.BAD_REQUEST;
        error = 'Bad Request';
      }
    }

    // 에러 로깅
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : exception,
    );

    // 클라이언트에 응답
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: error,
      message: message,
    });
  }
}
