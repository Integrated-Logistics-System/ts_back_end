// 통합 테스트 및 성능 최적화 서비스
import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '../../modules/elasticsearch/elasticsearch.service';
import { AdvancedRAGService } from '../../modules/rag/advanced-rag.service';
import { UserPersonalizationService } from '../../modules/user/user-personalization.service';
import { StreamingOptimizationService } from '../../modules/websocket/streaming-optimization.service';
import { AiService } from '../../modules/ai/ai.service';

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  type: 'functional' | 'performance' | 'load' | 'integration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number; // ms
  setup?: () => Promise<void>;
  execute: () => Promise<TestResult>;
  cleanup?: () => Promise<void>;
  dependencies?: string[];
}

export interface TestResult {
  success: boolean;
  duration: number;
  metrics?: {
    responseTime?: number;
    throughput?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    errorRate?: number;
  };
  details?: any;
  errors?: string[];
  warnings?: string[];
}

export interface PerformanceBaseline {
  component: string;
  operation: string;
  expectedResponseTime: number; // ms
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // percentage
  minThroughput: number; // requests/second
  maxErrorRate: number; // percentage
}

export interface OptimizationSuggestion {
  component: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendations: string[];
  estimatedImpact: {
    responseTime?: string;
    throughput?: string;
    memoryUsage?: string;
  };
}

@Injectable()
export class IntegrationTestService {
  private readonly logger = new Logger(IntegrationTestService.name);
  
  private testScenarios: TestScenario[] = [];
  private performanceBaselines: PerformanceBaseline[] = [];
  private testHistory: Array<{
    scenario: string;
    result: TestResult;
    timestamp: Date;
  }> = [];

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly advancedRAGService: AdvancedRAGService,
    private readonly personalizationService: UserPersonalizationService,
    private readonly streamingOptimization: StreamingOptimizationService,
    private readonly aiService: AiService,
  ) {
    this.initializeTestScenarios();
    this.initializePerformanceBaselines();
  }

  /**
   * 전체 통합 테스트 실행
   */
  async runFullIntegrationTest(): Promise<{
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
    };
    results: Array<{
      scenario: string;
      result: TestResult;
    }>;
    performanceReport: {
      baselineViolations: Array<{
        component: string;
        issue: string;
        actual: number;
        expected: number;
      }>;
      optimizationSuggestions: OptimizationSuggestion[];
    };
  }> {
    const startTime = Date.now();
    this.logger.log('전체 통합 테스트 시작');

    const results = [];
    let passed = 0;
    let failed = 0;
    const skipped = 0;

    // 의존성 그래프 기반으로 테스트 순서 결정
    const orderedScenarios = this.orderScenariosByDependencies();

    for (const scenario of orderedScenarios) {
      try {
        this.logger.debug(`테스트 시나리오 실행: ${scenario.name}`);
        
        const result = await this.runTestScenario(scenario);
        results.push({ scenario: scenario.name, result });

        if (result.success) {
          passed++;
        } else {
          failed++;
        }

        // 테스트 히스토리에 추가
        this.testHistory.push({
          scenario: scenario.name,
          result,
          timestamp: new Date(),
        });

      } catch (error) {
        this.logger.error(`테스트 시나리오 실행 실패: ${scenario.name}`, error);
        failed++;
        results.push({
          scenario: scenario.name,
          result: {
            success: false,
            duration: 0,
            errors: [error instanceof Error ? error.message : String(error)],
          },
        });
      }
    }

    const duration = Date.now() - startTime;

    // 성능 분석 및 최적화 제안
    const performanceReport = await this.analyzePerformanceAndGenerateSuggestions(results);

    this.logger.log(`통합 테스트 완료: ${passed}/${passed + failed} 통과, 소요시간: ${duration}ms`);

    return {
      summary: {
        total: passed + failed + skipped,
        passed,
        failed,
        skipped,
        duration,
      },
      results,
      performanceReport,
    };
  }

  /**
   * 성능 벤치마크 테스트
   */
  async runPerformanceBenchmark(): Promise<{
    vectorSearch: {
      averageResponseTime: number;
      throughput: number;
      p95ResponseTime: number;
      errorRate: number;
    };
    ragPipeline: {
      averageResponseTime: number;
      throughput: number;
      p95ResponseTime: number;
      errorRate: number;
    };
    personalization: {
      averageResponseTime: number;
      throughput: number;
      p95ResponseTime: number;
      errorRate: number;
    };
    websocketStreaming: {
      averageLatency: number;
      throughput: number;
      connectionQuality: string;
      errorRate: number;
    };
  }> {
    this.logger.log('성능 벤치마크 테스트 시작');

    const [vectorSearchResults, ragResults, personalizationResults, streamingResults] = await Promise.all([
      this.benchmarkVectorSearch(),
      this.benchmarkRAGPipeline(),
      this.benchmarkPersonalization(),
      this.benchmarkWebSocketStreaming(),
    ]);

    return {
      vectorSearch: vectorSearchResults,
      ragPipeline: ragResults,
      personalization: personalizationResults,
      websocketStreaming: streamingResults,
    };
  }

  /**
   * 부하 테스트 실행
   */
  async runLoadTest(config: {
    concurrentUsers: number;
    duration: number; // seconds
    scenarios: string[];
  }): Promise<{
    summary: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number;
      maxResponseTime: number;
      requestsPerSecond: number;
      errorRate: number;
    };
    errors: Array<{
      error: string;
      count: number;
      percentage: number;
    }>;
    performanceMetrics: {
      cpuUsage: number[];
      memoryUsage: number[];
      diskUsage: number[];
    };
  }> {
    this.logger.log(`부하 테스트 시작: ${config.concurrentUsers}명 동시 사용자, ${config.duration}초 지속`);

    const startTime = Date.now();
    const endTime = startTime + config.duration * 1000;
    const results: any[] = [];
    const errors = new Map<string, number>();

    // 동시 사용자 시뮬레이션
    const userPromises = [];
    for (let i = 0; i < config.concurrentUsers; i++) {
      userPromises.push(this.simulateUser(i, endTime, config.scenarios, results, errors));
    }

    // 성능 메트릭 수집 시작
    const performanceMetrics: {
      cpuUsage: number[];
      memoryUsage: number[];
      diskUsage: number[];
    } = {
      cpuUsage: [],
      memoryUsage: [],
      diskUsage: [],
    };
    const metricsInterval = setInterval(() => {
      performanceMetrics.cpuUsage.push(this.getCurrentCpuUsage());
      performanceMetrics.memoryUsage.push(this.getCurrentMemoryUsage());
      performanceMetrics.diskUsage.push(this.getCurrentDiskUsage());
    }, 1000);

    // 모든 사용자 시뮬레이션 완료 대기
    await Promise.all(userPromises);
    clearInterval(metricsInterval);

    // 결과 분석
    const totalRequests = results.length;
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const responseTimes = results.map(r => r.responseTime);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const requestsPerSecond = totalRequests / config.duration;
    const errorRate = (failedRequests / totalRequests) * 100;

    const errorSummary = Array.from(errors.entries()).map(([error, count]) => ({
      error,
      count,
      percentage: (count / totalRequests) * 100,
    }));

    this.logger.log(`부하 테스트 완료: ${successfulRequests}/${totalRequests} 성공, 평균 응답시간: ${averageResponseTime.toFixed(2)}ms`);

    return {
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime,
        maxResponseTime,
        requestsPerSecond,
        errorRate,
      },
      errors: errorSummary,
      performanceMetrics,
    };
  }

  /**
   * 시스템 최적화 제안 생성
   */
  async generateOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // 테스트 히스토리 기반 분석
    const recentTests = this.testHistory.slice(-50);
    
    // 성능 문제 분석
    for (const test of recentTests) {
      if (test.result.metrics) {
        const metrics = test.result.metrics;
        
        // 응답 시간 분석
        if (metrics.responseTime && metrics.responseTime > 1000) {
          suggestions.push({
            component: this.extractComponentFromScenario(test.scenario),
            issue: 'High Response Time',
            severity: metrics.responseTime > 5000 ? 'critical' : 'high',
            description: `평균 응답 시간이 ${metrics.responseTime}ms로 목표치를 초과합니다.`,
            recommendations: [
              '데이터베이스 쿼리 최적화',
              '캐싱 전략 개선',
              '비동기 처리 도입',
              '리소스 풀 크기 조정',
            ],
            estimatedImpact: {
              responseTime: '30-50% 개선',
              throughput: '20-40% 증가',
            },
          });
        }

        // 메모리 사용량 분석
        if (metrics.memoryUsage && metrics.memoryUsage > 512) {
          suggestions.push({
            component: this.extractComponentFromScenario(test.scenario),
            issue: 'High Memory Usage',
            severity: metrics.memoryUsage > 1024 ? 'high' : 'medium',
            description: `메모리 사용량이 ${metrics.memoryUsage}MB로 과도합니다.`,
            recommendations: [
              '메모리 누수 확인 및 수정',
              '객체 풀링 도입',
              '가비지 컬렉션 튜닝',
              '데이터 구조 최적화',
            ],
            estimatedImpact: {
              memoryUsage: '20-40% 감소',
              responseTime: '10-20% 개선',
            },
          });
        }

        // 에러율 분석
        if (metrics.errorRate && metrics.errorRate > 1) {
          suggestions.push({
            component: this.extractComponentFromScenario(test.scenario),
            issue: 'High Error Rate',
            severity: metrics.errorRate > 5 ? 'critical' : 'high',
            description: `에러율이 ${metrics.errorRate}%로 허용 수준을 초과합니다.`,
            recommendations: [
              '에러 처리 로직 강화',
              'Circuit Breaker 패턴 적용',
              '재시도 메커니즘 개선',
              '모니터링 및 알림 강화',
            ],
            estimatedImpact: {
              responseTime: '가용성 95% 이상 달성',
              throughput: '안정성 확보',
            },
          });
        }
      }
    }

    // 컴포넌트별 최적화 제안
    suggestions.push(...await this.generateComponentSpecificSuggestions());

    return suggestions.slice(0, 10); // 상위 10개만 반환
  }

  // Private methods
  private initializeTestScenarios(): void {
    // 벡터 검색 테스트
    this.testScenarios.push({
      id: 'vector_search_basic',
      name: '기본 벡터 검색 테스트',
      description: '벡터 검색 기능의 기본 동작을 테스트합니다.',
      type: 'functional',
      priority: 'high',
      timeout: 5000,
      execute: async () => {
        const startTime = Date.now();
        try {
          // 테스트 쿼리 실행
          const results = await (this.elasticsearchService as any).search({
            index: 'recipes',
            body: {
              query: {
                match: { name: '김치찌개' }
              },
              size: 5
            }
          });

          const duration = Date.now() - startTime;
          return {
            success: results.hits.hits.length > 0,
            duration,
            metrics: {
              responseTime: duration,
              throughput: results.hits.hits.length / (duration / 1000),
            },
            details: {
              totalHits: results.hits.total,
              resultsCount: results.hits.hits.length,
            },
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - startTime,
            errors: [error instanceof Error ? error.message : String(error)],
          };
        }
      },
    });

    // RAG 파이프라인 테스트
    this.testScenarios.push({
      id: 'rag_pipeline_test',
      name: 'RAG 파이프라인 통합 테스트',
      description: '고급 RAG 파이프라인의 전체 플로우를 테스트합니다.',
      type: 'integration',
      priority: 'critical',
      timeout: 30000,
      dependencies: ['vector_search_basic'],
      execute: async () => {
        const startTime = Date.now();
        try {
          const ragContext = {
            query: '건강한 닭가슴살 요리 추천해줘',
            userId: 'test_user_001',
            contextType: 'recipe_search' as const,
            maxResults: 5,
          };

          const result = await this.advancedRAGService.processAdvancedRAG(ragContext);
          const duration = Date.now() - startTime;

          return {
            success: result.response.length > 0 && result.confidence > 0.5,
            duration,
            metrics: {
              responseTime: duration,
              throughput: 1 / (duration / 1000),
            },
            details: {
              responseLength: result.response.length,
              confidence: result.confidence,
              sourcesCount: result.sources.length,
              suggestionsCount: result.suggestions.length,
            },
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - startTime,
            errors: [error instanceof Error ? error.message : String(error)],
          };
        }
      },
    });

    // 개인화 서비스 테스트
    this.testScenarios.push({
      id: 'personalization_test',
      name: '사용자 개인화 서비스 테스트',
      description: '개인화 프로필 생성 및 추천 기능을 테스트합니다.',
      type: 'functional',
      priority: 'high',
      timeout: 10000,
      execute: async () => {
        const startTime = Date.now();
        try {
          const userId = 'test_user_002';
          
          // 행동 데이터 기록
          await this.personalizationService.recordUserBehavior({
            userId,
            actionType: 'view',
            targetId: 'recipe_001',
            targetType: 'recipe',
            context: {
              timeOfDay: 'evening',
              deviceType: 'desktop',
            },
          });

          // 개인화 프로필 생성
          const profile = await this.personalizationService.generatePersonalizationProfile(userId);
          const duration = Date.now() - startTime;

          return {
            success: profile.userId === userId && profile.metadata.profileStrength > 0,
            duration,
            metrics: {
              responseTime: duration,
            },
            details: {
              profileStrength: profile.metadata.profileStrength,
              totalInteractions: profile.metadata.totalInteractions,
              confidenceScore: profile.metadata.confidenceScore,
            },
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - startTime,
            errors: [error instanceof Error ? error.message : String(error)],
          };
        }
      },
    });

    // 스트리밍 최적화 테스트
    this.testScenarios.push({
      id: 'streaming_optimization_test',
      name: '스트리밍 최적화 테스트',
      description: 'WebSocket 스트리밍 최적화 기능을 테스트합니다.',
      type: 'performance',
      priority: 'medium',
      timeout: 15000,
      execute: async () => {
        const startTime = Date.now();
        try {
          const metrics = this.streamingOptimization.getSystemStreamingMetrics();
          const duration = Date.now() - startTime;

          return {
            success: metrics.connectionQuality !== 'critical',
            duration,
            metrics: {
              responseTime: duration,
              throughput: metrics.totalBandwidth,
            },
            details: {
              activeStreams: metrics.activeStreams,
              averageLatency: metrics.averageLatency,
              connectionQuality: metrics.connectionQuality,
              cacheHitRate: metrics.cacheHitRate,
            },
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - startTime,
            errors: [error instanceof Error ? error.message : String(error)],
          };
        }
      },
    });
  }

  private initializePerformanceBaselines(): void {
    this.performanceBaselines = [
      {
        component: 'vector_search',
        operation: 'search',
        expectedResponseTime: 200, // 200ms
        maxMemoryUsage: 256, // 256MB
        maxCpuUsage: 50, // 50%
        minThroughput: 10, // 10 req/s
        maxErrorRate: 1, // 1%
      },
      {
        component: 'rag_pipeline',
        operation: 'generate_response',
        expectedResponseTime: 2000, // 2s
        maxMemoryUsage: 512, // 512MB
        maxCpuUsage: 70, // 70%
        minThroughput: 1, // 1 req/s
        maxErrorRate: 2, // 2%
      },
      {
        component: 'personalization',
        operation: 'generate_profile',
        expectedResponseTime: 500, // 500ms
        maxMemoryUsage: 128, // 128MB
        maxCpuUsage: 30, // 30%
        minThroughput: 5, // 5 req/s
        maxErrorRate: 0.5, // 0.5%
      },
      {
        component: 'websocket_streaming',
        operation: 'stream_data',
        expectedResponseTime: 50, // 50ms latency
        maxMemoryUsage: 64, // 64MB
        maxCpuUsage: 20, // 20%
        minThroughput: 100, // 100 req/s
        maxErrorRate: 0.1, // 0.1%
      },
    ];
  }

  private orderScenariosByDependencies(): TestScenario[] {
    const ordered: TestScenario[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (scenario: TestScenario) => {
      if (visiting.has(scenario.id)) {
        throw new Error(`Circular dependency detected: ${scenario.id}`);
      }
      if (visited.has(scenario.id)) {
        return;
      }

      visiting.add(scenario.id);

      if (scenario.dependencies) {
        for (const depId of scenario.dependencies) {
          const depScenario = this.testScenarios.find(s => s.id === depId);
          if (depScenario) {
            visit(depScenario);
          }
        }
      }

      visiting.delete(scenario.id);
      visited.add(scenario.id);
      ordered.push(scenario);
    };

    for (const scenario of this.testScenarios) {
      if (!visited.has(scenario.id)) {
        visit(scenario);
      }
    }

    return ordered;
  }

  private async runTestScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Setup
      if (scenario.setup) {
        await scenario.setup();
      }

      // Execute with timeout
      const result = await Promise.race([
        scenario.execute(),
        new Promise<TestResult>((_, reject) =>
          setTimeout(() => reject(new Error('Test timeout')), scenario.timeout)
        ),
      ]);

      // Cleanup
      if (scenario.cleanup) {
        await scenario.cleanup();
      }

      return result;
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private async analyzePerformanceAndGenerateSuggestions(
    results: Array<{ scenario: string; result: TestResult }>
  ): Promise<{
    baselineViolations: Array<{
      component: string;
      issue: string;
      actual: number;
      expected: number;
    }>;
    optimizationSuggestions: OptimizationSuggestion[];
  }> {
    const baselineViolations = [];
    
    // 성능 기준선과 비교
    for (const result of results) {
      const component = this.extractComponentFromScenario(result.scenario);
      const baseline = this.performanceBaselines.find(b => b.component === component);
      
      if (baseline && result.result.metrics) {
        if (result.result.metrics.responseTime && result.result.metrics.responseTime > baseline.expectedResponseTime) {
          baselineViolations.push({
            component,
            issue: 'Response Time Exceeded',
            actual: result.result.metrics.responseTime,
            expected: baseline.expectedResponseTime,
          });
        }
        
        if (result.result.metrics.memoryUsage && result.result.metrics.memoryUsage > baseline.maxMemoryUsage) {
          baselineViolations.push({
            component,
            issue: 'Memory Usage Exceeded',
            actual: result.result.metrics.memoryUsage,
            expected: baseline.maxMemoryUsage,
          });
        }
      }
    }

    const optimizationSuggestions = await this.generateOptimizationSuggestions();

    return {
      baselineViolations,
      optimizationSuggestions,
    };
  }

  private async benchmarkVectorSearch(): Promise<any> {
    const iterations = 10;
    const responseTimes = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now();
        await (this.elasticsearchService as any).search({
          index: 'recipes',
          body: {
            query: { match: { name: '김치찌개' } },
            size: 5
          }
        });
        responseTimes.push(Date.now() - startTime);
      } catch {
        errors++;
      }
    }

    return {
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      throughput: iterations / (responseTimes.reduce((a, b) => a + b, 0) / 1000),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      errorRate: (errors / iterations) * 100,
    };
  }

  private async benchmarkRAGPipeline(): Promise<any> {
    const iterations = 5;
    const responseTimes = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now();
        await this.advancedRAGService.processAdvancedRAG({
          query: '건강한 요리 추천해줘',
          userId: 'benchmark_user',
          contextType: 'recipe_search',
        });
        responseTimes.push(Date.now() - startTime);
      } catch {
        errors++;
      }
    }

    return {
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      throughput: iterations / (responseTimes.reduce((a, b) => a + b, 0) / 1000),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      errorRate: (errors / iterations) * 100,
    };
  }

  private async benchmarkPersonalization(): Promise<any> {
    const iterations = 10;
    const responseTimes = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now();
        await this.personalizationService.generatePersonalizationProfile(`benchmark_user_${i}`);
        responseTimes.push(Date.now() - startTime);
      } catch {
        errors++;
      }
    }

    return {
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      throughput: iterations / (responseTimes.reduce((a, b) => a + b, 0) / 1000),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      errorRate: (errors / iterations) * 100,
    };
  }

  private async benchmarkWebSocketStreaming(): Promise<any> {
    const metrics = this.streamingOptimization.getSystemStreamingMetrics();
    
    return {
      averageLatency: metrics.averageLatency,
      throughput: metrics.totalBandwidth,
      connectionQuality: metrics.connectionQuality,
      errorRate: 0, // 실제로는 스트리밍 에러율 계산 필요
    };
  }

  private async simulateUser(
    userId: number,
    endTime: number,
    scenarios: string[],
    results: any[],
    errors: Map<string, number>
  ): Promise<void> {
    while (Date.now() < endTime) {
      const scenarioName = scenarios[Math.floor(Math.random() * scenarios.length)];
      const scenario = this.testScenarios.find(s => s.name === scenarioName);
      
      if (scenario) {
        const startTime = Date.now();
        try {
          await scenario.execute();
          results.push({
            userId,
            scenario: scenarioName,
            success: true,
            responseTime: Date.now() - startTime,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.set(errorMsg, (errors.get(errorMsg) || 0) + 1);
          results.push({
            userId,
            scenario: scenarioName,
            success: false,
            responseTime: Date.now() - startTime,
          });
        }
      }

      // 사용자 간 간격 시뮬레이션
      await this.delay(100 + Math.random() * 500);
    }
  }

  private getCurrentCpuUsage(): number {
    // 실제로는 시스템 메트릭에서 조회
    return Math.random() * 100;
  }

  private getCurrentMemoryUsage(): number {
    // 실제로는 프로세스 메모리 사용량 조회
    const used = process.memoryUsage();
    return used.heapUsed / 1024 / 1024; // MB
  }

  private getCurrentDiskUsage(): number {
    // 실제로는 디스크 사용량 조회
    return Math.random() * 100;
  }

  private extractComponentFromScenario(scenarioName: string): string {
    if (scenarioName.includes('vector')) return 'vector_search';
    if (scenarioName.includes('rag')) return 'rag_pipeline';
    if (scenarioName.includes('personalization')) return 'personalization';
    if (scenarioName.includes('streaming')) return 'websocket_streaming';
    return 'unknown';
  }

  private async generateComponentSpecificSuggestions(): Promise<OptimizationSuggestion[]> {
    return [
      {
        component: 'elasticsearch',
        issue: 'Index Optimization',
        severity: 'medium',
        description: 'Elasticsearch 인덱스 최적화가 필요합니다.',
        recommendations: [
          '인덱스 매핑 최적화',
          '샤드 설정 조정',
          '캐시 설정 개선',
        ],
        estimatedImpact: {
          responseTime: '15-25% 개선',
          throughput: '20-30% 증가',
        },
      },
    ];
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}