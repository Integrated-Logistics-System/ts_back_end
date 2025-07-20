import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from '../../langgraph/langgraph.service';
import { PersonalChatService } from '../personal-chat.service';
import {
  AuthenticatedSocket,
  StatusEventData,
  HealthCheckResult,
  ConnectionMetrics,
} from '../interfaces/websocket.interface';
import {
  WEBSOCKET_EVENTS,
  SYSTEM_INFO,
  WEBSOCKET_CONFIG,
} from '../constants/websocket.constants';
import { ConnectionManager } from '../managers/connection.manager';

@Injectable()
export class StatusHandler {
  private readonly logger = new Logger(StatusHandler.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly langGraphService: LangGraphService,
    private readonly personalChatService: PersonalChatService,
    private readonly connectionManager: ConnectionManager,
  ) {}

  /**
   * 시스템 상태 조회 처리
   */
  async handleGetStatus(
    socket: AuthenticatedSocket,
    data: StatusEventData = {}
  ): Promise<void> {
    try {
      this.logger.debug(`Status request from client: ${socket.id}`);

      const statusInfo = await this.gatherSystemStatus(data);

      socket.emit(WEBSOCKET_EVENTS.STATUS_UPDATE, {
        message: '시스템 상태 정보',
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: statusInfo,
      });

    } catch (error) {
      this.logger.error('Get status failed:', error);
      
      socket.emit(WEBSOCKET_EVENTS.ERROR, {
        error: true,
        message: '상태 조회 중 오류가 발생했습니다.',
        timestamp: Date.now(),
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 핑 요청 처리
   */
  async handlePing(socket: AuthenticatedSocket): Promise<void> {
    try {
      const timestamp = Date.now();
      
      socket.emit(WEBSOCKET_EVENTS.PONG, {
        message: 'pong',
        timestamp,
        version: SYSTEM_INFO.VERSION,
        serverTime: timestamp,
        uptime: this.getUptime(),
      });

      this.logger.debug(`Ping from client: ${socket.id}`);

    } catch (error) {
      this.logger.error('Ping handling failed:', error);
    }
  }

  /**
   * 상세 건강 상태 확인
   */
  async handleHealthCheck(
    socket: AuthenticatedSocket,
    data: StatusEventData = {}
  ): Promise<void> {
    try {
      const healthResult = await this.performHealthCheck();

      socket.emit(WEBSOCKET_EVENTS.STATUS_UPDATE, {
        message: `시스템 상태: ${healthResult.status}`,
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          healthCheck: healthResult,
          requestedBy: socket.user?.id || 'anonymous',
        },
      });

    } catch (error) {
      this.logger.error('Health check failed:', error);
      
      socket.emit(WEBSOCKET_EVENTS.ERROR, {
        error: true,
        message: '건강 상태 확인 중 오류가 발생했습니다.',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 연결 메트릭스 조회
   */
  async handleGetMetrics(socket: AuthenticatedSocket): Promise<void> {
    try {
      const metrics = this.connectionManager.getConnectionMetrics();
      const additionalMetrics = await this.gatherAdditionalMetrics();

      socket.emit(WEBSOCKET_EVENTS.STATUS_UPDATE, {
        message: '시스템 메트릭스',
        timestamp: Date.now(),
        version: SYSTEM_INFO.VERSION,
        metadata: {
          connectionMetrics: metrics,
          systemMetrics: additionalMetrics,
          uptime: this.getUptime(),
        },
      });

    } catch (error) {
      this.logger.error('Get metrics failed:', error);
      
      socket.emit(WEBSOCKET_EVENTS.ERROR, {
        error: true,
        message: '메트릭스 조회 중 오류가 발생했습니다.',
        timestamp: Date.now(),
      });
    }
  }

  // ==================== Private Helper Methods ====================

  private async gatherSystemStatus(data: StatusEventData): Promise<any> {
    const uptime = this.getUptime();
    const connectionMetrics = this.connectionManager.getConnectionMetrics();

    const status = {
      server: {
        version: SYSTEM_INFO.VERSION,
        apiVersion: SYSTEM_INFO.API_VERSION,
        websocketVersion: SYSTEM_INFO.WEBSOCKET_VERSION,
        uptime,
        features: SYSTEM_INFO.SUPPORTED_FEATURES,
        timestamp: Date.now(),
      },
      connections: connectionMetrics,
      configuration: {
        maxHistorySize: WEBSOCKET_CONFIG.MAX_HISTORY_SIZE,
        maxMessageLength: WEBSOCKET_CONFIG.MAX_MESSAGE_LENGTH,
        rateLimitWindow: WEBSOCKET_CONFIG.RATE_LIMIT_WINDOW,
        rateLimitMaxRequests: WEBSOCKET_CONFIG.RATE_LIMIT_MAX_REQUESTS,
        pingInterval: WEBSOCKET_CONFIG.PING_INTERVAL,
        pingTimeout: WEBSOCKET_CONFIG.PING_TIMEOUT,
      },
    };

    // 요청된 추가 정보 포함
    if (data.includePerformanceMetrics) {
      (status as any)['performance'] = await this.gatherPerformanceMetrics();
    }

    if (data.includeSystemInfo) {
      (status as any)['system'] = await this.gatherSystemInfo();
    }

    // 특정 컴포넌트 상태만 요청된 경우
    if (data.requestedComponents?.length) {
      const componentStatus: Record<string, any> = {};
      for (const component of data.requestedComponents) {
        componentStatus[component] = await this.checkComponentStatus(component);
      }
      (status as any)['components'] = componentStatus;
    }

    return status;
  }

  private async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // 각 컴포넌트 상태 확인
      const components = {
        websocket: true, // WebSocket 서버 자체는 동작 중
        authentication: await this.checkAuthenticationService(),
        database: await this.checkDatabaseService(),
        ai_service: await this.checkAIService(),
        langgraph: await this.checkLangGraphService(),
      };

      // 전체 상태 결정
      const failedComponents = Object.values(components).filter(status => !status).length;
      const status = failedComponents === 0 ? 'healthy' : 
                     failedComponents <= 2 ? 'degraded' : 'unhealthy';

      const metrics = this.connectionManager.getConnectionMetrics();

      return {
        status,
        components,
        metrics,
        timestamp: Date.now(),
        uptime: this.getUptime(),
      };

    } catch (error) {
      this.logger.error('Health check execution failed:', error);
      
      return {
        status: 'unhealthy',
        components: {
          websocket: true,
          authentication: false,
          database: false,
          ai_service: false,
          langgraph: false,
        },
        metrics: this.connectionManager.getConnectionMetrics(),
        timestamp: Date.now(),
        uptime: this.getUptime(),
      };
    }
  }

  private async gatherPerformanceMetrics(): Promise<any> {
    // 메모리 사용량
    const memUsage = process.memoryUsage();
    
    // CPU 사용량 (간단한 추정)
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: this.getUptime(),
      timestamp: Date.now(),
    };
  }

  private async gatherSystemInfo(): Promise<any> {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: this.getUptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  private async gatherAdditionalMetrics(): Promise<any> {
    return {
      eventLoop: {
        delay: await this.measureEventLoopDelay(),
      },
      process: {
        uptime: process.uptime(),
        version: process.version,
      },
      timestamp: Date.now(),
    };
  }

  private async checkComponentStatus(component: string): Promise<boolean> {
    switch (component) {
      case 'authentication':
        return await this.checkAuthenticationService();
      case 'database':
        return await this.checkDatabaseService();
      case 'ai_service':
        return await this.checkAIService();
      case 'langgraph':
        return await this.checkLangGraphService();
      case 'websocket':
        return true; // WebSocket 서버 자체는 동작 중
      default:
        return false;
    }
  }

  private async checkAuthenticationService(): Promise<boolean> {
    try {
      // 실제 구현에서는 AuthService나 JwtService 상태 확인
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkDatabaseService(): Promise<boolean> {
    try {
      // 실제 구현에서는 데이터베이스 연결 상태 확인
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkAIService(): Promise<boolean> {
    try {
      // PersonalChatService를 통한 AI 서비스 상태 확인
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkLangGraphService(): Promise<boolean> {
    try {
      // LangGraph 서비스 상태 확인
      // 실제 구현에서는 간단한 ping 요청 등으로 확인
      return true;
    } catch (error) {
      return false;
    }
  }

  private getUptime(): number {
    return Date.now() - this.startTime;
  }

  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // ms
        resolve(delay);
      });
    });
  }
}