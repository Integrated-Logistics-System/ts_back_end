// 에러 모니터링 및 알림 서비스
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../../modules/cache/cache.service';
import { ErrorContext } from './advanced-error-handler.service';

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    errorType?: string[];
    component?: string[];
    severity?: ('low' | 'medium' | 'high' | 'critical')[];
    frequency?: {
      count: number;
      timeWindow: number; // minutes
    };
    errorRate?: {
      threshold: number; // percentage
      timeWindow: number; // minutes
    };
  };
  actions: {
    type: 'email' | 'slack' | 'webhook' | 'escalation';
    target: string;
    template?: string;
  }[];
  enabled: boolean;
  cooldown: number; // minutes
  lastTriggered?: Date;
}

export interface SystemHealthMetrics {
  errorRate: number;
  criticalErrors: number;
  systemLoad: number;
  responseTime: number;
  availability: number;
  lastUpdated: Date;
  trends: {
    errorRate: number[]; // last 24 hours
    criticalErrors: number[]; // last 24 hours
    responseTime: number[]; // last 24 hours
  };
}

export interface ErrorTrend {
  component: string;
  errorType: string;
  count: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  predictions: {
    nextHour: number;
    nextDay: number;
    confidence: number;
  };
}

@Injectable()
export class ErrorMonitoringService {
  private readonly logger = new Logger(ErrorMonitoringService.name);
  
  private alertRules: AlertRule[] = [];
  private errorBuffer: Array<{ error: Error; context: ErrorContext; timestamp: Date }> = [];
  private healthMetrics: SystemHealthMetrics = {
    errorRate: 0,
    criticalErrors: 0,
    systemLoad: 0,
    responseTime: 0,
    availability: 100,
    lastUpdated: new Date(),
    trends: {
      errorRate: [],
      criticalErrors: [],
      responseTime: [],
    },
  };

  constructor(
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initializeDefaultAlertRules();
    this.startContinuousMonitoring();
  }

  /**
   * 에러 이벤트 처리
   */
  async processErrorEvent(error: Error, context: ErrorContext): Promise<void> {
    try {
      // 에러 버퍼에 추가
      this.addToErrorBuffer(error, context);
      
      // 실시간 메트릭 업데이트
      await this.updateRealTimeMetrics(error, context);
      
      // 알림 규칙 확인 및 실행
      await this.checkAndExecuteAlerts(error, context);
      
      // 에러 트렌드 분석
      await this.analyzeErrorTrends();
      
      // 시스템 건강도 평가
      await this.assessSystemHealth();

    } catch (monitoringError) {
      this.logger.error('에러 모니터링 중 오류 발생:', monitoringError);
    }
  }

  /**
   * 알림 규칙 추가
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const alertRule: AlertRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...rule,
    };

    this.alertRules.push(alertRule);
    this.logger.log(`알림 규칙 추가: ${alertRule.name} (ID: ${alertRule.id})`);
    
    return alertRule.id;
  }

  /**
   * 시스템 건강도 메트릭 조회
   */
  getSystemHealthMetrics(): SystemHealthMetrics {
    return { ...this.healthMetrics };
  }

  /**
   * 에러 트렌드 분석 결과 조회
   */
  async getErrorTrends(timeWindow: number = 24): Promise<ErrorTrend[]> {
    try {
      const trends = await this.calculateErrorTrends(timeWindow);
      return trends;
    } catch (error) {
      this.logger.error('에러 트렌드 조회 실패:', error);
      return [];
    }
  }

  /**
   * 예측 기반 알림
   */
  async generatePredictiveAlerts(): Promise<Array<{
    type: 'warning' | 'critical';
    message: string;
    prediction: {
      component: string;
      expectedErrorCount: number;
      timeframe: string;
      confidence: number;
    };
    preventiveActions: string[];
  }>> {
    try {
      const predictions = await this.predictUpcomingIssues();
      const alerts = [];

      for (const prediction of predictions) {
        if (prediction.confidence > 0.7) {
          alerts.push({
            type: (prediction.severity === 'critical' ? 'critical' : 'warning') as 'warning' | 'critical',
            message: `${prediction.component}에서 ${prediction.timeframe} 내 ${prediction.expectedErrorCount}개의 오류가 예상됩니다.`,
            prediction: {
              component: prediction.component,
              expectedErrorCount: prediction.expectedErrorCount,
              timeframe: prediction.timeframe,
              confidence: prediction.confidence,
            },
            preventiveActions: prediction.preventiveActions,
          });
        }
      }

      return alerts;
    } catch (error) {
      this.logger.error('예측 알림 생성 실패:', error);
      return [];
    }
  }

  /**
   * 실시간 대시보드 데이터
   */
  async getDashboardData(): Promise<{
    currentStatus: 'healthy' | 'degraded' | 'critical';
    activeErrors: number;
    errorRate: number;
    systemLoad: number;
    recentAlerts: Array<{
      timestamp: Date;
      severity: string;
      message: string;
      component: string;
    }>;
    componentHealth: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'critical';
      errorCount: number;
      lastError?: Date;
    }>;
  }> {
    try {
      const recentErrors = this.getRecentErrors(60); // 최근 1시간
      const componentHealth = await this.calculateComponentHealth();
      const currentStatus = this.calculateOverallStatus(componentHealth);

      return {
        currentStatus,
        activeErrors: recentErrors.length,
        errorRate: this.healthMetrics.errorRate,
        systemLoad: this.healthMetrics.systemLoad,
        recentAlerts: await this.getRecentAlerts(10),
        componentHealth,
      };
    } catch (error) {
      this.logger.error('대시보드 데이터 조회 실패:', error);
      return {
        currentStatus: 'critical',
        activeErrors: 0,
        errorRate: 0,
        systemLoad: 0,
        recentAlerts: [],
        componentHealth: [],
      };
    }
  }

  /**
   * 에러 패턴 감지
   */
  async detectAnomalousPatterns(): Promise<Array<{
    pattern: 'spike' | 'sustained_high' | 'cascade' | 'periodic';
    severity: 'low' | 'medium' | 'high';
    description: string;
    affectedComponents: string[];
    duration: number; // minutes
    recommendedActions: string[];
  }>> {
    try {
      const patterns = [];
      const recentErrors = this.getRecentErrors(180); // 최근 3시간

      // 스파이크 패턴 감지
      const spikePattern = this.detectSpike(recentErrors);
      if (spikePattern) {
        patterns.push(spikePattern);
      }

      // 지속적 높은 에러율 패턴
      const sustainedHighPattern = this.detectSustainedHigh(recentErrors);
      if (sustainedHighPattern) {
        patterns.push(sustainedHighPattern);
      }

      // 캐스케이드 패턴 (연쇄 오류)
      const cascadePattern = this.detectCascade(recentErrors);
      if (cascadePattern) {
        patterns.push(cascadePattern);
      }

      return patterns;
    } catch (error) {
      this.logger.error('이상 패턴 감지 실패:', error);
      return [];
    }
  }

  // Private methods
  private initializeDefaultAlertRules(): void {
    // 크리티컬 에러 즉시 알림
    this.addAlertRule({
      name: 'Critical Error Alert',
      condition: {
        severity: ['critical'],
      },
      actions: [
        {
          type: 'slack',
          target: '#alerts',
          template: 'critical_error',
        },
        {
          type: 'email',
          target: 'admin@example.com',
        },
      ],
      enabled: true,
      cooldown: 5, // 5분
    });

    // 높은 에러율 알림
    this.addAlertRule({
      name: 'High Error Rate Alert',
      condition: {
        errorRate: {
          threshold: 5.0, // 5%
          timeWindow: 15, // 15분
        },
      },
      actions: [
        {
          type: 'slack',
          target: '#monitoring',
        },
      ],
      enabled: true,
      cooldown: 30, // 30분
    });

    // AI 서비스 오류 알림
    this.addAlertRule({
      name: 'AI Service Error Alert',
      condition: {
        component: ['ai', 'ollama', 'langgraph'],
        frequency: {
          count: 3,
          timeWindow: 10, // 10분
        },
      },
      actions: [
        {
          type: 'slack',
          target: '#ai-team',
        },
      ],
      enabled: true,
      cooldown: 15, // 15분
    });
  }

  private addToErrorBuffer(error: Error, context: ErrorContext): void {
    this.errorBuffer.push({
      error,
      context,
      timestamp: new Date(),
    });

    // 버퍼 크기 제한 (최근 1000개)
    if (this.errorBuffer.length > 1000) {
      this.errorBuffer = this.errorBuffer.slice(-1000);
    }
  }

  private async updateRealTimeMetrics(error: Error, context: ErrorContext): Promise<void> {
    try {
      // 에러율 계산
      const recentErrors = this.getRecentErrors(60); // 최근 1시간
      const totalRequests = await this.getTotalRequests(60);
      
      this.healthMetrics.errorRate = totalRequests > 0 ? (recentErrors.length / totalRequests) * 100 : 0;
      
      // 크리티컬 에러 카운트
      this.healthMetrics.criticalErrors = recentErrors.filter(
        e => this.assessErrorSeverity(e.error, e.context) === 'critical'
      ).length;
      
      // 트렌드 데이터 업데이트
      this.updateTrendData();
      
      this.healthMetrics.lastUpdated = new Date();
    } catch (error) {
      this.logger.error('실시간 메트릭 업데이트 실패:', error);
    }
  }

  private async checkAndExecuteAlerts(error: Error, context: ErrorContext): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;
      
      // 쿨다운 확인
      if (rule.lastTriggered && this.isInCooldown(rule)) {
        continue;
      }

      // 조건 확인
      if (await this.evaluateAlertCondition(rule, error, context)) {
        await this.executeAlertActions(rule, error, context);
        rule.lastTriggered = new Date();
      }
    }
  }

  private async evaluateAlertCondition(
    rule: AlertRule,
    error: Error,
    context: ErrorContext
  ): Promise<boolean> {
    const { condition } = rule;

    // 심각도 조건
    if (condition.severity) {
      const severity = this.assessErrorSeverity(error, context);
      if (!condition.severity.includes(severity)) {
        return false;
      }
    }

    // 컴포넌트 조건
    if (condition.component) {
      if (!condition.component.some(comp => context.component.includes(comp))) {
        return false;
      }
    }

    // 에러 타입 조건
    if (condition.errorType) {
      const errorType = this.classifyError(error);
      if (!condition.errorType.includes(errorType)) {
        return false;
      }
    }

    // 빈도 조건
    if (condition.frequency) {
      const recentErrors = this.getRecentErrors(condition.frequency.timeWindow);
      if (recentErrors.length < condition.frequency.count) {
        return false;
      }
    }

    // 에러율 조건
    if (condition.errorRate) {
      if (this.healthMetrics.errorRate < condition.errorRate.threshold) {
        return false;
      }
    }

    return true;
  }

  private async executeAlertActions(
    rule: AlertRule,
    error: Error,
    context: ErrorContext
  ): Promise<void> {
    this.logger.warn(`알림 규칙 트리거: ${rule.name}`);

    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'slack':
            await this.sendSlackAlert(action.target, rule, error, context);
            break;
          case 'email':
            await this.sendEmailAlert(action.target, rule, error, context);
            break;
          case 'webhook':
            await this.sendWebhookAlert(action.target, rule, error, context);
            break;
          case 'escalation':
            await this.escalateAlert(action.target, rule, error, context);
            break;
        }
      } catch (actionError) {
        this.logger.error(`알림 액션 실행 실패 (${action.type}):`, actionError);
      }
    }

    // 이벤트 발생
    this.eventEmitter.emit('alert.triggered', {
      rule: rule.name,
      error: error.message,
      context,
      timestamp: new Date(),
    });
  }

  private getRecentErrors(minutes: number): Array<{ error: Error; context: ErrorContext; timestamp: Date }> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.errorBuffer.filter(entry => entry.timestamp >= cutoff);
  }

  private async getTotalRequests(minutes: number): Promise<number> {
    // 실제로는 메트릭 수집기에서 조회
    // 여기서는 추정값 반환
    return Math.max(this.getRecentErrors(minutes).length * 20, 100);
  }

  private assessErrorSeverity(error: Error, context: ErrorContext): 'low' | 'medium' | 'high' | 'critical' {
    if (context.component === 'database' || context.component === 'auth') {
      return 'critical';
    }
    
    if (context.component.includes('ai') || context.component.includes('search')) {
      return 'high';
    }
    
    if (context.component.includes('cache') || context.component.includes('websocket')) {
      return 'medium';
    }
    
    return 'low';
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('connection')) return 'connection_error';
    if (message.includes('timeout')) return 'timeout_error';
    if (message.includes('not found')) return 'not_found_error';
    if (message.includes('permission')) return 'auth_error';
    if (message.includes('validation')) return 'validation_error';
    if (message.includes('model') || message.includes('ai')) return 'ai_service_error';
    
    return 'unknown_error';
  }

  private isInCooldown(rule: AlertRule): boolean {
    if (!rule.lastTriggered) return false;
    const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldown * 60 * 1000);
    return new Date() < cooldownEnd;
  }

  private updateTrendData(): void {
    const now = new Date();
    const hourOfDay = now.getHours();
    
    // 24시간 트렌드 배열 업데이트
    if (this.healthMetrics.trends.errorRate.length !== 24) {
      this.healthMetrics.trends.errorRate = new Array(24).fill(0);
      this.healthMetrics.trends.criticalErrors = new Array(24).fill(0);
      this.healthMetrics.trends.responseTime = new Array(24).fill(0);
    }
    
    this.healthMetrics.trends.errorRate[hourOfDay] = this.healthMetrics.errorRate;
    this.healthMetrics.trends.criticalErrors[hourOfDay] = this.healthMetrics.criticalErrors;
    // responseTime은 별도 메트릭에서 수집 필요
  }

  private startContinuousMonitoring(): void {
    // 1분마다 시스템 건강도 체크
    setInterval(async () => {
      await this.assessSystemHealth();
    }, 60000);

    // 10분마다 예측 분석
    setInterval(async () => {
      await this.generatePredictiveAlerts();
    }, 600000);

    // 5분마다 이상 패턴 감지
    setInterval(async () => {
      await this.detectAnomalousPatterns();
    }, 300000);
  }

  private async analyzeErrorTrends(): Promise<void> {
    // 에러 트렌드 분석 로직
  }

  private async assessSystemHealth(): Promise<void> {
    // 시스템 건강도 평가 로직
    const recentErrors = this.getRecentErrors(60);
    const criticalErrors = recentErrors.filter(e => 
      this.assessErrorSeverity(e.error, e.context) === 'critical'
    );

    // 가용성 계산
    this.healthMetrics.availability = Math.max(100 - (criticalErrors.length * 10), 0);
    
    // 시스템 로드 추정
    this.healthMetrics.systemLoad = Math.min(recentErrors.length / 10, 1) * 100;
  }

  private async calculateErrorTrends(timeWindow: number): Promise<ErrorTrend[]> {
    // 에러 트렌드 계산 로직
    return [];
  }

  private async predictUpcomingIssues(): Promise<any[]> {
    // 문제 예측 로직
    return [];
  }

  private async calculateComponentHealth(): Promise<any[]> {
    // 컴포넌트 건강도 계산
    return [];
  }

  private calculateOverallStatus(componentHealth: any[]): 'healthy' | 'degraded' | 'critical' {
    // 전체 상태 계산
    return 'healthy';
  }

  private async getRecentAlerts(limit: number): Promise<any[]> {
    // 최근 알림 조회
    return [];
  }

  private detectSpike(errors: any[]): any | null {
    // 스파이크 패턴 감지
    return null;
  }

  private detectSustainedHigh(errors: any[]): any | null {
    // 지속적 높은 에러율 패턴 감지
    return null;
  }

  private detectCascade(errors: any[]): any | null {
    // 캐스케이드 패턴 감지
    return null;
  }

  private async sendSlackAlert(target: string, rule: AlertRule, error: Error, context: ErrorContext): Promise<void> {
    // Slack 알림 전송 로직
    this.logger.log(`Slack 알림 전송: ${target} - ${error.message}`);
  }

  private async sendEmailAlert(target: string, rule: AlertRule, error: Error, context: ErrorContext): Promise<void> {
    // 이메일 알림 전송 로직
    this.logger.log(`이메일 알림 전송: ${target} - ${error.message}`);
  }

  private async sendWebhookAlert(target: string, rule: AlertRule, error: Error, context: ErrorContext): Promise<void> {
    // 웹훅 알림 전송 로직
    this.logger.log(`웹훅 알림 전송: ${target} - ${error.message}`);
  }

  private async escalateAlert(target: string, rule: AlertRule, error: Error, context: ErrorContext): Promise<void> {
    // 에스컬레이션 로직
    this.logger.warn(`알림 에스컬레이션: ${target} - ${error.message}`);
  }
}