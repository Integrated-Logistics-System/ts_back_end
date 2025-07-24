// 통합 테스트 API 컨트롤러
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
// import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';
// import { GetUser } from '../../modules/auth/get-user.decorator';
import { IntegrationTestService, TestScenario } from './integration-test.service';

export class LoadTestConfigDto {
  concurrentUsers!: number;
  duration!: number; // seconds
  scenarios!: string[];
}

@ApiTags('Integration Testing')
@Controller('api/testing')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class IntegrationTestController {
  private readonly logger = new Logger(IntegrationTestController.name);

  constructor(
    private readonly integrationTestService: IntegrationTestService,
  ) {}

  /**
   * 전체 통합 테스트 실행
   */
  @Post('integration/full')
  @ApiOperation({ summary: '전체 통합 테스트 실행' })
  @ApiResponse({ status: 200, description: '통합 테스트 결과 반환' })
  async runFullIntegrationTest(
    // @GetUser() user: any
  ): Promise<{
    success: boolean;
    data: any;
    metadata: {
      executedBy: string;
      timestamp: string;
    };
  }> {
    try {
      this.logger.log(`통합 테스트 실행 요청: 사용자 ${'test-user'}`);

      const results = await this.integrationTestService.runFullIntegrationTest();

      return {
        success: true,
        data: results,
        metadata: {
          executedBy: 'test@example.com',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('통합 테스트 실행 실패:', error);
      throw new HttpException(
        '통합 테스트 실행 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 성능 벤치마크 테스트 실행
   */
  @Post('performance/benchmark')
  @ApiOperation({ summary: '성능 벤치마크 테스트 실행' })
  @ApiResponse({ status: 200, description: '성능 벤치마크 결과 반환' })
  async runPerformanceBenchmark(
    // @GetUser() user: any
  ): Promise<{
    success: boolean;
    data: any;
    metadata: {
      executedBy: string;
      timestamp: string;
    };
  }> {
    try {
      this.logger.log(`성능 벤치마크 실행 요청: 사용자 ${'test-user'}`);

      const results = await this.integrationTestService.runPerformanceBenchmark();

      return {
        success: true,
        data: results,
        metadata: {
          executedBy: 'test@example.com',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('성능 벤치마크 실행 실패:', error);
      throw new HttpException(
        '성능 벤치마크 실행 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 부하 테스트 실행
   */
  @Post('load-test')
  @ApiOperation({ summary: '부하 테스트 실행' })
  @ApiResponse({ status: 200, description: '부하 테스트 결과 반환' })
  async runLoadTest(
    // @GetUser() user: any,
    @Body() config: LoadTestConfigDto
  ): Promise<{
    success: boolean;
    data: any;
    metadata: {
      executedBy: string;
      timestamp: string;
      config: LoadTestConfigDto;
    };
  }> {
    try {
      this.logger.log(`부하 테스트 실행 요청: 사용자 ${'test-user'}, 설정: ${JSON.stringify(config)}`);

      // 안전 검사
      if (config.concurrentUsers > 100) {
        throw new HttpException(
          '동시 사용자 수는 100명을 초과할 수 없습니다.',
          HttpStatus.BAD_REQUEST
        );
      }

      if (config.duration > 300) { // 5분
        throw new HttpException(
          '테스트 지속 시간은 300초를 초과할 수 없습니다.',
          HttpStatus.BAD_REQUEST
        );
      }

      const results = await this.integrationTestService.runLoadTest(config);

      return {
        success: true,
        data: results,
        metadata: {
          executedBy: 'test@example.com',
          timestamp: new Date().toISOString(),
          config,
        },
      };
    } catch (error) {
      this.logger.error('부하 테스트 실행 실패:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        '부하 테스트 실행 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 최적화 제안 조회
   */
  @Get('optimization/suggestions')
  @ApiOperation({ summary: '시스템 최적화 제안 조회' })
  @ApiResponse({ status: 200, description: '최적화 제안 목록 반환' })
  async getOptimizationSuggestions(
    // @GetUser() user: any
  ): Promise<{
    success: boolean;
    data: {
      suggestions: any[];
      summary: {
        totalSuggestions: number;
        criticalIssues: number;
        highPriorityIssues: number;
        estimatedImpact: string;
      };
    };
  }> {
    try {
      this.logger.log(`최적화 제안 조회 요청: 사용자 ${'test-user'}`);

      const suggestions = await this.integrationTestService.generateOptimizationSuggestions();

      const criticalIssues = suggestions.filter(s => s.severity === 'critical').length;
      const highPriorityIssues = suggestions.filter(s => s.severity === 'high').length;

      return {
        success: true,
        data: {
          suggestions,
          summary: {
            totalSuggestions: suggestions.length,
            criticalIssues,
            highPriorityIssues,
            estimatedImpact: this.calculateOverallImpact(suggestions),
          },
        },
      };
    } catch (error) {
      this.logger.error('최적화 제안 조회 실패:', error);
      throw new HttpException(
        '최적화 제안을 가져오는 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 테스트 시나리오 목록 조회
   */
  @Get('scenarios')
  @ApiOperation({ summary: '사용 가능한 테스트 시나리오 목록 조회' })
  @ApiResponse({ status: 200, description: '테스트 시나리오 목록 반환' })
  async getTestScenarios(): Promise<{
    success: boolean;
    data: {
      scenarios: Array<{
        id: string;
        name: string;
        description: string;
        type: string;
        priority: string;
        timeout: number;
        dependencies?: string[];
      }>;
      summary: {
        total: number;
        byType: Record<string, number>;
        byPriority: Record<string, number>;
      };
    };
  }> {
    try {
      // 실제로는 IntegrationTestService에서 시나리오 목록을 가져와야 함
      const mockScenarios = [
        {
          id: 'vector_search_basic',
          name: '기본 벡터 검색 테스트',
          description: '벡터 검색 기능의 기본 동작을 테스트합니다.',
          type: 'functional',
          priority: 'high',
          timeout: 5000,
        },
        {
          id: 'rag_pipeline_test',
          name: 'RAG 파이프라인 통합 테스트',
          description: '고급 RAG 파이프라인의 전체 플로우를 테스트합니다.',
          type: 'integration',
          priority: 'critical',
          timeout: 30000,
          dependencies: ['vector_search_basic'],
        },
        {
          id: 'personalization_test',
          name: '사용자 개인화 서비스 테스트',
          description: '개인화 프로필 생성 및 추천 기능을 테스트합니다.',
          type: 'functional',
          priority: 'high',
          timeout: 10000,
        },
        {
          id: 'streaming_optimization_test',
          name: '스트리밍 최적화 테스트',
          description: 'WebSocket 스트리밍 최적화 기능을 테스트합니다.',
          type: 'performance',
          priority: 'medium',
          timeout: 15000,
        },
      ];

      const byType = mockScenarios.reduce((acc, scenario) => {
        acc[scenario.type] = (acc[scenario.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byPriority = mockScenarios.reduce((acc, scenario) => {
        acc[scenario.priority] = (acc[scenario.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        success: true,
        data: {
          scenarios: mockScenarios,
          summary: {
            total: mockScenarios.length,
            byType,
            byPriority,
          },
        },
      };
    } catch (error) {
      this.logger.error('테스트 시나리오 조회 실패:', error);
      throw new HttpException(
        '테스트 시나리오를 가져오는 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 시스템 건강도 체크
   */
  @Get('health/comprehensive')
  @ApiOperation({ summary: '종합적인 시스템 건강도 체크' })
  @ApiResponse({ status: 200, description: '시스템 건강도 정보 반환' })
  async getComprehensiveHealthCheck(): Promise<{
    success: boolean;
    data: {
      overallStatus: 'healthy' | 'degraded' | 'critical';
      components: Array<{
        name: string;
        status: 'healthy' | 'degraded' | 'critical';
        responseTime?: number;
        errorRate?: number;
        lastCheck: string;
      }>;
      performance: {
        averageResponseTime: number;
        systemLoad: number;
        memoryUsage: number;
        diskUsage: number;
      };
      recommendations: string[];
    };
  }> {
    try {
      // 실제로는 각 서비스의 건강도를 확인하는 로직이 필요
      const mockHealthData = {
        overallStatus: 'healthy' as const,
        components: [
          {
            name: 'Elasticsearch',
            status: 'healthy' as const,
            responseTime: 25,
            errorRate: 0.1,
            lastCheck: new Date().toISOString(),
          },
          {
            name: 'RAG Pipeline',
            status: 'healthy' as const,
            responseTime: 1200,
            errorRate: 0.5,
            lastCheck: new Date().toISOString(),
          },
          {
            name: 'Personalization Service',
            status: 'healthy' as const,
            responseTime: 150,
            errorRate: 0.2,
            lastCheck: new Date().toISOString(),
          },
          {
            name: 'WebSocket Streaming',
            status: 'healthy' as const,
            responseTime: 35,
            errorRate: 0.05,
            lastCheck: new Date().toISOString(),
          },
          {
            name: 'AI Service (Ollama)',
            status: 'degraded' as const,
            responseTime: 3500,
            errorRate: 2.1,
            lastCheck: new Date().toISOString(),
          },
        ],
        performance: {
          averageResponseTime: 845,
          systemLoad: 45.2,
          memoryUsage: 68.5,
          diskUsage: 23.1,
        },
        recommendations: [
          'AI 서비스 응답 시간 개선 필요',
          '메모리 사용량 모니터링 강화',
          '캐시 최적화 고려',
        ],
      };

      return {
        success: true,
        data: mockHealthData,
      };
    } catch (error) {
      this.logger.error('시스템 건강도 체크 실패:', error);
      throw new HttpException(
        '시스템 건강도 체크 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 테스트 리포트 생성
   */
  @Post('reports/generate')
  @ApiOperation({ summary: '종합 테스트 리포트 생성' })
  @ApiResponse({ status: 200, description: '테스트 리포트 반환' })
  async generateTestReport(
    // @GetUser() user: any,
    @Query('includePerformance') includePerformance: boolean = true,
    @Query('includeLoad') includeLoad: boolean = false
  ): Promise<{
    success: boolean;
    data: {
      reportId: string;
      summary: {
        generatedAt: string;
        generatedBy: string;
        totalTests: number;
        passedTests: number;
        failedTests: number;
        overallHealthScore: number;
      };
      sections: {
        integration?: any;
        performance?: any;
        load?: any;
        optimization?: any;
      };
    };
  }> {
    try {
      this.logger.log(`테스트 리포트 생성 요청: 사용자 ${'test-user'}`);

      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sections: any = {};

      // 통합 테스트 결과
      const integrationResults = await this.integrationTestService.runFullIntegrationTest();
      sections.integration = integrationResults;

      // 성능 테스트 결과 (옵션)
      if (includePerformance) {
        const performanceResults = await this.integrationTestService.runPerformanceBenchmark();
        sections.performance = performanceResults;
      }

      // 부하 테스트 결과 (옵션)
      if (includeLoad) {
        const loadResults = await this.integrationTestService.runLoadTest({
          concurrentUsers: 10,
          duration: 60,
          scenarios: ['vector_search_basic', 'rag_pipeline_test'],
        });
        sections.load = loadResults;
      }

      // 최적화 제안
      const optimizationSuggestions = await this.integrationTestService.generateOptimizationSuggestions();
      sections.optimization = { suggestions: optimizationSuggestions };

      // 요약 정보 계산
      const totalTests = integrationResults.summary.total;
      const passedTests = integrationResults.summary.passed;
      const failedTests = integrationResults.summary.failed;
      const overallHealthScore = this.calculateHealthScore(integrationResults, optimizationSuggestions);

      return {
        success: true,
        data: {
          reportId,
          summary: {
            generatedAt: new Date().toISOString(),
            generatedBy: 'test@example.com',
            totalTests,
            passedTests,
            failedTests,
            overallHealthScore,
          },
          sections,
        },
      };
    } catch (error) {
      this.logger.error('테스트 리포트 생성 실패:', error);
      throw new HttpException(
        '테스트 리포트 생성 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Private helper methods
  private calculateOverallImpact(suggestions: any[]): string {
    const criticalCount = suggestions.filter(s => s.severity === 'critical').length;
    const highCount = suggestions.filter(s => s.severity === 'high').length;

    if (criticalCount > 0) {
      return '매우 높음 - 즉시 조치 필요';
    } else if (highCount > 2) {
      return '높음 - 우선순위 조치 필요';
    } else if (suggestions.length > 5) {
      return '중간 - 점진적 개선 권장';
    } else {
      return '낮음 - 현재 상태 양호';
    }
  }

  private calculateHealthScore(integrationResults: any, optimizationSuggestions: any[]): number {
    let score = 100;

    // 테스트 통과율 기반 점수 차감
    const passRate = integrationResults.summary.passed / integrationResults.summary.total;
    score -= (1 - passRate) * 40; // 최대 40점 차감

    // 최적화 제안 기반 점수 차감
    const criticalSuggestions = optimizationSuggestions.filter(s => s.severity === 'critical').length;
    const highSuggestions = optimizationSuggestions.filter(s => s.severity === 'high').length;
    
    score -= criticalSuggestions * 15; // 크리티컬 이슈당 15점 차감
    score -= highSuggestions * 5; // 높은 우선순위 이슈당 5점 차감

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}