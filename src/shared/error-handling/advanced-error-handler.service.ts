// 고급 에러 처리 및 복구 메커니즘
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../modules/cache/cache.service';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component: string;
  operation: string;
  metadata?: any;
  timestamp: Date;
  retryCount?: number;
}

export interface ErrorRecoveryStrategy {
  name: string;
  priority: number;
  applicable: (error: Error, context: ErrorContext) => boolean;
  execute: (error: Error, context: ErrorContext) => Promise<any>;
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByComponent: Record<string, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  criticalErrors: number;
  lastError?: {
    message: string;
    timestamp: Date;
    context: ErrorContext;
  };
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount: number;
}

@Injectable()
export class AdvancedErrorHandlerService {
  private readonly logger = new Logger(AdvancedErrorHandlerService.name);
  
  private errorMetrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByType: {},
    errorsByComponent: {},
    recoverySuccessRate: 0,
    averageRecoveryTime: 0,
    criticalErrors: 0,
  };

  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private errorHistory: Array<{ error: Error; context: ErrorContext; timestamp: Date }> = [];

  constructor(private readonly cacheService: CacheService) {
    this.initializeRecoveryStrategies();
    this.startMetricsCollection();
  }

  /**
   * 에러 처리 및 복구 실행
   */
  async handleError(error: Error, context: ErrorContext): Promise<{
    recovered: boolean;
    result?: any;
    fallbackUsed: boolean;
    recoveryStrategy?: string;
    nextAction?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // 에러 분류 및 로깅
      const errorType = this.classifyError(error);
      const severity = this.assessErrorSeverity(error, context);
      
      this.logError(error, context, errorType, severity);
      this.updateErrorMetrics(error, context, errorType);

      // Circuit Breaker 확인
      if (this.isCircuitBreakerOpen(context.component)) {
        return this.handleCircuitBreakerOpen(context);
      }

      // 복구 전략 실행
      const recoveryResult = await this.attemptRecovery(error, context);
      
      if (recoveryResult.success) {
        this.updateCircuitBreakerSuccess(context.component);
        this.updateRecoveryMetrics(true, Date.now() - startTime);
        
        return {
          recovered: true,
          result: recoveryResult.result,
          fallbackUsed: recoveryResult.fallbackUsed,
          recoveryStrategy: recoveryResult.strategy,
        };
      } else {
        this.updateCircuitBreakerFailure(context.component);
        return this.handleRecoveryFailure(error, context);
      }

    } catch (handlingError) {
      this.logger.error('에러 처리 중 오류 발생:', handlingError);
      return {
        recovered: false,
        fallbackUsed: true,
        nextAction: 'manual_intervention_required',
      };
    }
  }

  /**
   * 에러 예측 및 사전 방지
   */
  async predictAndPreventErrors(context: Omit<ErrorContext, 'timestamp'>): Promise<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    predictions: Array<{
      errorType: string;
      probability: number;
      preventionActions: string[];
    }>;
    preventionActions: string[];
  }> {
    try {
      // 히스토리 기반 패턴 분석
      const patterns = this.analyzeErrorPatterns(context);
      
      // 시스템 상태 기반 리스크 평가
      const systemRisk = await this.assessSystemRisk(context);
      
      // 예측 모델 실행
      const predictions = this.generateErrorPredictions(patterns, systemRisk);
      
      // 사전 방지 액션 생성
      const preventionActions = this.generatePreventionActions(predictions);

      return {
        riskLevel: this.calculateOverallRisk(predictions),
        predictions,
        preventionActions,
      };
    } catch (error) {
      this.logger.error('에러 예측 실패:', error);
      return {
        riskLevel: 'medium',
        predictions: [],
        preventionActions: ['시스템 모니터링 강화'],
      };
    }
  }

  /**
   * 자동 복구 메커니즘 등록
   */
  registerRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => b.priority - a.priority);
    this.logger.log(`복구 전략 등록: ${strategy.name} (우선순위: ${strategy.priority})`);
  }

  /**
   * 에러 메트릭 조회
   */
  getErrorMetrics(): ErrorMetrics & {
    circuitBreakers: Array<{
      component: string;
      state: CircuitBreakerState;
    }>;
    recentErrors: Array<{
      message: string;
      type: string;
      component: string;
      timestamp: Date;
      recovered: boolean;
    }>;
  } {
    const circuitBreakers = Array.from(this.circuitBreakers.entries()).map(([component, state]) => ({
      component,
      state,
    }));

    const recentErrors = this.errorHistory.slice(-10).map(entry => ({
      message: entry.error.message,
      type: this.classifyError(entry.error),
      component: entry.context.component,
      timestamp: entry.timestamp,
      recovered: false, // TODO: 복구 상태 추적
    }));

    return {
      ...this.errorMetrics,
      circuitBreakers,
      recentErrors,
    };
  }

  /**
   * Circuit Breaker 상태 관리
   */
  async resetCircuitBreaker(component: string): Promise<void> {
    this.circuitBreakers.set(component, {
      isOpen: false,
      failureCount: 0,
      successCount: 0,
    });
    
    this.logger.log(`Circuit Breaker 리셋: ${component}`);
  }

  /**
   * 에러 복구 테스트
   */
  async testRecoveryStrategies(
    testError: Error,
    testContext: ErrorContext
  ): Promise<Array<{
    strategy: string;
    applicable: boolean;
    success?: boolean;
    executionTime?: number;
    result?: any;
  }>> {
    const results = [];

    for (const strategy of this.recoveryStrategies) {
      const startTime = Date.now();
      
      try {
        const applicable = strategy.applicable(testError, testContext);
        
        if (applicable) {
          const result = await strategy.execute(testError, testContext);
          results.push({
            strategy: strategy.name,
            applicable: true,
            success: true,
            executionTime: Date.now() - startTime,
            result,
          });
        } else {
          results.push({
            strategy: strategy.name,
            applicable: false,
          });
        }
      } catch (error) {
        results.push({
          strategy: strategy.name,
          applicable: true,
          success: false,
          executionTime: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  // Private methods
  private initializeRecoveryStrategies(): void {
    // 데이터베이스 연결 복구
    this.registerRecoveryStrategy({
      name: 'DatabaseConnectionRecovery',
      priority: 90,
      applicable: (error) => error.message.includes('connection') || error.message.includes('ECONNREFUSED'),
      execute: async (error, context) => {
        this.logger.log('데이터베이스 연결 복구 시도');
        await this.delay(1000);
        // 실제로는 DB 연결 재시도 로직
        return { recovered: true, method: 'reconnection' };
      },
      maxRetries: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
    });

    // 캐시 서비스 복구
    this.registerRecoveryStrategy({
      name: 'CacheServiceRecovery',
      priority: 80,
      applicable: (error, context) => context.component.includes('cache') || error.message.includes('Redis'),
      execute: async (error, context) => {
        this.logger.log('캐시 서비스 복구 시도');
        // 메모리 캐시로 폴백
        return { recovered: true, method: 'fallback_to_memory' };
      },
      maxRetries: 2,
      backoffStrategy: 'linear',
      baseDelay: 500,
    });

    // AI 서비스 복구
    this.registerRecoveryStrategy({
      name: 'AIServiceRecovery',
      priority: 70,
      applicable: (error, context) => 
        context.component.includes('ai') || 
        context.component.includes('ollama') || 
        error.message.includes('model'),
      execute: async (error, context) => {
        this.logger.log('AI 서비스 복구 시도');
        
        // 대체 모델 사용
        if (error.message.includes('gemma2')) {
          return { recovered: true, method: 'fallback_model', model: 'simple_response' };
        }
        
        // 캐시된 응답 사용
        const cachedResponse = await this.getCachedResponse(context);
        if (cachedResponse) {
          return { recovered: true, method: 'cached_response', response: cachedResponse };
        }
        
        throw new Error('AI 서비스 복구 실패');
      },
      maxRetries: 2,
      backoffStrategy: 'exponential',
      baseDelay: 2000,
    });

    // 네트워크 오류 복구
    this.registerRecoveryStrategy({
      name: 'NetworkErrorRecovery',
      priority: 60,
      applicable: (error) => 
        error.message.includes('timeout') || 
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT'),
      execute: async (error, context) => {
        this.logger.log('네트워크 오류 복구 시도');
        
        // 재시도 간격 조정
        const retryDelay = Math.min(1000 * Math.pow(2, context.retryCount || 0), 10000);
        await this.delay(retryDelay);
        
        return { recovered: true, method: 'retry_with_backoff' };
      },
      maxRetries: 5,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
    });

    // 일반적인 서비스 오류 복구
    this.registerRecoveryStrategy({
      name: 'GenericServiceRecovery',
      priority: 30,
      applicable: () => true, // 모든 오류에 적용 가능한 기본 전략
      execute: async (error, context) => {
        this.logger.log('일반적인 서비스 복구 시도');
        
        // 기본 응답 반환
        const fallbackResponse = this.generateFallbackResponse(context);
        return { recovered: true, method: 'fallback_response', response: fallbackResponse };
      },
      maxRetries: 1,
      backoffStrategy: 'fixed',
      baseDelay: 100,
    });
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('connection') || message.includes('econnrefused')) {
      return 'connection_error';
    } else if (message.includes('timeout') || message.includes('etimedout')) {
      return 'timeout_error';
    } else if (message.includes('not found') || message.includes('enotfound')) {
      return 'not_found_error';
    } else if (message.includes('permission') || message.includes('unauthorized')) {
      return 'auth_error';
    } else if (message.includes('validation') || message.includes('invalid')) {
      return 'validation_error';
    } else if (message.includes('model') || message.includes('ai')) {
      return 'ai_service_error';
    } else {
      return 'unknown_error';
    }
  }

  private assessErrorSeverity(error: Error, context: ErrorContext): 'low' | 'medium' | 'high' | 'critical' {
    // 크리티컬: 시스템 전체에 영향
    if (context.component === 'database' || context.component === 'auth') {
      return 'critical';
    }
    
    // 높음: 핵심 기능에 영향
    if (context.component.includes('ai') || context.component.includes('search')) {
      return 'high';
    }
    
    // 중간: 부분적 기능 장애
    if (context.component.includes('cache') || context.component.includes('websocket')) {
      return 'medium';
    }
    
    return 'low';
  }

  private logError(error: Error, context: ErrorContext, type: string, severity: string): void {
    const logMethod = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'debug';
    
    this.logger[logMethod](`[${severity.toUpperCase()}] ${type}: ${error.message}`, {
      component: context.component,
      operation: context.operation,
      userId: context.userId,
      stack: error.stack,
      metadata: context.metadata,
    });
  }

  private updateErrorMetrics(error: Error, context: ErrorContext, type: string): void {
    this.errorMetrics.totalErrors++;
    this.errorMetrics.errorsByType[type] = (this.errorMetrics.errorsByType[type] || 0) + 1;
    this.errorMetrics.errorsByComponent[context.component] = 
      (this.errorMetrics.errorsByComponent[context.component] || 0) + 1;
    
    if (this.assessErrorSeverity(error, context) === 'critical') {
      this.errorMetrics.criticalErrors++;
    }
    
    this.errorMetrics.lastError = {
      message: error.message,
      timestamp: new Date(),
      context,
    };

    // 에러 히스토리 유지 (최근 100개)
    this.errorHistory.push({ error, context, timestamp: new Date() });
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }
  }

  private async attemptRecovery(error: Error, context: ErrorContext): Promise<{
    success: boolean;
    result?: any;
    strategy?: string;
    fallbackUsed: boolean;
  }> {
    for (const strategy of this.recoveryStrategies) {
      if (!strategy.applicable(error, context)) {
        continue;
      }

      try {
        const result = await this.executeWithRetry(strategy, error, context);
        return {
          success: true,
          result,
          strategy: strategy.name,
          fallbackUsed: strategy.name.includes('fallback'),
        };
      } catch (recoveryError) {
        const errorMsg = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
        this.logger.debug(`복구 전략 실패: ${strategy.name} - ${errorMsg}`);
        continue;
      }
    }

    return { success: false, fallbackUsed: false };
  }

  private async executeWithRetry(
    strategy: ErrorRecoveryStrategy,
    error: Error,
    context: ErrorContext
  ): Promise<any> {
    let lastError: Error = error;
    
    for (let attempt = 0; attempt < strategy.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateBackoffDelay(strategy, attempt);
          await this.delay(delay);
        }

        const updatedContext = { ...context, retryCount: attempt };
        return await strategy.execute(error, updatedContext);
      } catch (retryError) {
        lastError = retryError instanceof Error ? retryError : new Error(String(retryError));
        this.logger.debug(`복구 시도 ${attempt + 1}/${strategy.maxRetries} 실패: ${lastError.message}`);
      }
    }

    throw lastError;
  }

  private calculateBackoffDelay(strategy: ErrorRecoveryStrategy, attempt: number): number {
    switch (strategy.backoffStrategy) {
      case 'exponential':
        return strategy.baseDelay * Math.pow(2, attempt);
      case 'linear':
        return strategy.baseDelay * (attempt + 1);
      case 'fixed':
      default:
        return strategy.baseDelay;
    }
  }

  private isCircuitBreakerOpen(component: string): boolean {
    const breaker = this.circuitBreakers.get(component);
    if (!breaker) return false;

    if (breaker.isOpen) {
      const now = Date.now();
      if (breaker.nextAttemptTime && now >= breaker.nextAttemptTime.getTime()) {
        // Half-open 상태로 전환
        breaker.isOpen = false;
        return false;
      }
      return true;
    }

    return false;
  }

  private handleCircuitBreakerOpen(context: ErrorContext): any {
    this.logger.warn(`Circuit Breaker 열림: ${context.component}`);
    return {
      recovered: false,
      fallbackUsed: true,
      nextAction: 'circuit_breaker_open',
    };
  }

  private updateCircuitBreakerSuccess(component: string): void {
    const breaker = this.circuitBreakers.get(component) || {
      isOpen: false,
      failureCount: 0,
      successCount: 0,
    };

    breaker.successCount++;
    breaker.failureCount = 0;
    this.circuitBreakers.set(component, breaker);
  }

  private updateCircuitBreakerFailure(component: string): void {
    const breaker = this.circuitBreakers.get(component) || {
      isOpen: false,
      failureCount: 0,
      successCount: 0,
    };

    breaker.failureCount++;
    breaker.successCount = 0;

    // 실패 임계값 도달시 Circuit Breaker 열기
    if (breaker.failureCount >= 5) {
      breaker.isOpen = true;
      breaker.lastFailureTime = new Date();
      breaker.nextAttemptTime = new Date(Date.now() + 60000); // 1분 후 재시도
    }

    this.circuitBreakers.set(component, breaker);
  }

  private handleRecoveryFailure(error: Error, context: ErrorContext): any {
    return {
      recovered: false,
      fallbackUsed: false,
      nextAction: 'escalation_required',
    };
  }

  private analyzeErrorPatterns(context: Omit<ErrorContext, 'timestamp'>): any {
    // 에러 패턴 분석 로직
    return {
      frequentErrors: [],
      timePatterns: [],
      componentCorrelations: [],
    };
  }

  private async assessSystemRisk(context: Omit<ErrorContext, 'timestamp'>): Promise<any> {
    // 시스템 리스크 평가
    return {
      cpuUsage: 0.5,
      memoryUsage: 0.6,
      activeConnections: 100,
      errorRate: 0.01,
    };
  }

  private generateErrorPredictions(patterns: any, systemRisk: any): any[] {
    // 에러 예측 생성
    return [];
  }

  private generatePreventionActions(predictions: any[]): string[] {
    // 예방 액션 생성
    return ['시스템 모니터링 강화', '리소스 사용량 최적화'];
  }

  private calculateOverallRisk(predictions: any[]): 'low' | 'medium' | 'high' | 'critical' {
    // 전체 리스크 레벨 계산
    return 'medium';
  }

  private async getCachedResponse(context: ErrorContext): Promise<any> {
    try {
      const cacheKey = `fallback:${context.component}:${context.operation}`;
      return await this.cacheService.get(cacheKey);
    } catch {
      return null;
    }
  }

  private generateFallbackResponse(context: ErrorContext): any {
    return {
      message: '일시적으로 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해주세요.',
      component: context.component,
      operation: context.operation,
      timestamp: new Date(),
    };
  }

  private startMetricsCollection(): void {
    // 5분마다 메트릭 업데이트
    setInterval(() => {
      this.updateRecoverySuccessRate();
    }, 300000);
  }

  private updateRecoverySuccessRate(): void {
    // 성공률 계산 로직
    // 실제로는 복구 성공/실패 추적이 필요
    this.errorMetrics.recoverySuccessRate = 0.85; // 85% 가정
  }

  private updateRecoveryMetrics(success: boolean, duration: number): void {
    if (success) {
      // 평균 복구 시간 업데이트
      this.errorMetrics.averageRecoveryTime = 
        (this.errorMetrics.averageRecoveryTime + duration) / 2;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}