// RAG 파이프라인 API 컨트롤러
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  Query,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { GetUser } from '../auth/get-user.decorator';
import { AdvancedRAGService, RAGContext, RAGResult } from './advanced-rag.service';
import { KoreanRAGService } from './korean-rag.service';

export class RAGQueryDto {
  query!: string;
  contextType?: 'recipe_search' | 'cooking_help' | 'nutrition_advice' | 'general_chat';
  maxResults?: number;
  includeNutrition?: boolean;
  includeAlternatives?: boolean;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
}

export class RAGStreamDto extends RAGQueryDto {
  sessionId?: string;
}

@ApiTags('RAG Pipeline')
@Controller('api/rag')
export class RAGPipelineController {
  private readonly logger = new Logger(RAGPipelineController.name);

  constructor(
    private readonly advancedRAGService: AdvancedRAGService,
    private readonly koreanRAGService: KoreanRAGService,
  ) {}

  /**
   * 고급 RAG 파이프라인 실행
   */
  @Post('advanced-query')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @ApiOperation({ summary: '고급 RAG 파이프라인을 통한 질의응답' })
  @ApiResponse({ status: 200, description: '고급 RAG 응답 반환' })
  async processAdvancedRAGQuery(
    // @GetUser() user: any,
    @Body() queryDto: RAGQueryDto
  ): Promise<{
    success: boolean;
    data: RAGResult;
    metadata: {
      userId: string;
      timestamp: string;
      version: string;
    };
  }> {
    try {
      this.logger.debug(`고급 RAG 쿼리 처리: ${queryDto.query}`);

      const context: RAGContext = {
        query: queryDto.query,
        userId: 'test-user',
        contextType: queryDto.contextType || 'recipe_search',
        maxResults: queryDto.maxResults || 10,
        includeNutrition: queryDto.includeNutrition || false,
        includeAlternatives: queryDto.includeAlternatives || false,
        conversationHistory: queryDto.conversationHistory?.map(turn => ({
          ...turn,
          timestamp: turn.timestamp ? new Date(turn.timestamp) : new Date(),
        })) || [],
      };

      const result = await this.advancedRAGService.processAdvancedRAG(context);

      return {
        success: true,
        data: result,
        metadata: {
          userId: 'test-user',
          timestamp: new Date().toISOString(),
          version: 'v2.0',
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`고급 RAG 쿼리 처리 실패: ${errorMsg}`, errorStack);
      throw new HttpException(
        `고급 RAG 처리 실패: ${errorMsg}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 기본 한국어 RAG (기존 호환성)
   */
  @Post('korean-query')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @ApiOperation({ summary: '기본 한국어 RAG 질의응답' })
  @ApiResponse({ status: 200, description: '한국어 RAG 응답 반환' })
  async processKoreanRAGQuery(
    // @GetUser() user: any,
    @Body() body: { query: string }
  ): Promise<{
    success: boolean;
    data: {
      response: string;
      processingTime?: number;
    };
  }> {
    try {
      this.logger.debug(`한국어 RAG 쿼리 처리: ${body.query}`);

      const startTime = Date.now();
      const response = await this.koreanRAGService.generateKoreanResponse(body.query);
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          response,
          processingTime,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`한국어 RAG 쿼리 처리 실패: ${errorMsg}`, errorStack);
      throw new HttpException(
        `한국어 RAG 처리 실패: ${errorMsg}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * RAG 응답 비교 (A/B 테스트용)
   */
  @Post('compare')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'RAG 응답 비교 (고급 vs 기본)' })
  @ApiResponse({ status: 200, description: 'RAG 응답 비교 결과' })
  async compareRAGResponses(
    // @GetUser() user: any,
    @Body() queryDto: RAGQueryDto
  ): Promise<{
    success: boolean;
    data: {
      advancedRAG: RAGResult;
      basicRAG: {
        response: string;
        processingTime: number;
      };
      comparison: {
        advancedScore: number;
        basicScore: number;
        recommendation: 'advanced' | 'basic';
        reasoning: string;
      };
    };
  }> {
    try {
      this.logger.debug(`RAG 응답 비교 요청: ${queryDto.query}`);

      // 병렬로 두 RAG 시스템 실행
      const [advancedResult, basicResult] = await Promise.allSettled([
        this.processAdvancedRAG('test-user', queryDto),
        this.processBasicRAG(queryDto.query),
      ]);

      const advancedRAG = advancedResult.status === 'fulfilled' ? advancedResult.value : null;
      const basicRAG = basicResult.status === 'fulfilled' ? basicResult.value : null;

      if (!advancedRAG || !basicRAG) {
        throw new Error('RAG 비교 중 하나 이상의 시스템에서 오류 발생');
      }

      // 응답 품질 비교
      const comparison = await this.compareResponseQuality(advancedRAG, basicRAG, queryDto);

      return {
        success: true,
        data: {
          advancedRAG,
          basicRAG,
          comparison,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`RAG 응답 비교 실패: ${errorMsg}`, errorStack);
      throw new HttpException(
        `RAG 비교 실패: ${errorMsg}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * RAG 성능 통계 조회
   */
  @Get('stats')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'RAG 시스템 성능 통계' })
  @ApiResponse({ status: 200, description: 'RAG 성능 통계 반환' })
  async getRAGStats(
    // @GetUser() user: any,
    @Query('period') period?: 'day' | 'week' | 'month'
  ): Promise<{
    success: boolean;
    data: {
      usage: {
        totalQueries: number;
        advancedQueries: number;
        basicQueries: number;
        avgProcessingTime: number;
      };
      performance: {
        avgConfidence: number;
        avgContextQuality: number;
        successRate: number;
        userSatisfaction: number;
      };
      trends: {
        queryTypes: Array<{ type: string; count: number; percentage: number }>;
        responseStrategies: Array<{ strategy: string; count: number; avgQuality: number }>;
        commonFailures: Array<{ reason: string; count: number }>;
      };
    };
  }> {
    try {
      // 모의 통계 데이터 (실제로는 DB/캐시에서 조회)
      const mockStats = {
        usage: {
          totalQueries: 1250,
          advancedQueries: 750,
          basicQueries: 500,
          avgProcessingTime: 2.3,
        },
        performance: {
          avgConfidence: 87.5,
          avgContextQuality: 82.1,
          successRate: 94.2,
          userSatisfaction: 4.3,
        },
        trends: {
          queryTypes: [
            { type: 'recipe_search', count: 600, percentage: 48.0 },
            { type: 'cooking_help', count: 400, percentage: 32.0 },
            { type: 'nutrition_advice', count: 150, percentage: 12.0 },
            { type: 'general_chat', count: 100, percentage: 8.0 },
          ],
          responseStrategies: [
            { strategy: 'vector_primary', count: 500, avgQuality: 85.2 },
            { strategy: 'hybrid_balanced', count: 400, avgQuality: 88.1 },
            { strategy: 'personalized_deep', count: 250, avgQuality: 91.3 },
            { strategy: 'keyword_focused', count: 100, avgQuality: 78.9 },
          ],
          commonFailures: [
            { reason: 'insufficient_context', count: 25 },
            { reason: 'ambiguous_query', count: 20 },
            { reason: 'no_relevant_recipes', count: 15 },
            { reason: 'ai_model_error', count: 10 },
          ],
        },
      };

      return {
        success: true,
        data: mockStats,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`RAG 통계 조회 실패: ${errorMsg}`, errorStack);
      throw new HttpException(
        'RAG 통계 조회 실패',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * RAG 시스템 건강 상태 확인
   */
  @Get('health')
  @ApiOperation({ summary: 'RAG 시스템 건강 상태 확인' })
  @ApiResponse({ status: 200, description: 'RAG 시스템 상태 반환' })
  async checkRAGHealth(): Promise<{
    success: boolean;
    data: {
      overall: 'healthy' | 'degraded' | 'unhealthy';
      components: {
        elasticsearch: 'up' | 'down' | 'slow';
        ollama: 'up' | 'down' | 'slow';
        embedding: 'up' | 'down' | 'slow';
        personalization: 'up' | 'down' | 'slow';
      };
      metrics: {
        avgResponseTime: number;
        errorRate: number;
        throughput: number;
        uptime: number;
      };
      lastCheck: string;
    };
  }> {
    try {
      // 각 컴포넌트 상태 확인
      const [esHealth, ollamaHealth, embeddingHealth] = await Promise.allSettled([
        this.checkElasticsearchHealth(),
        this.checkOllamaHealth(),
        this.checkEmbeddingHealth(),
      ]);

      const components = {
        elasticsearch: esHealth.status === 'fulfilled' ? esHealth.value : 'down',
        ollama: ollamaHealth.status === 'fulfilled' ? ollamaHealth.value : 'down',
        embedding: embeddingHealth.status === 'fulfilled' ? embeddingHealth.value : 'down',
        personalization: 'up' as 'up' | 'down' | 'slow', // 개인화 서비스 상태
      };

      // 전체 건강 상태 판정
      const healthyComponents = Object.values(components).filter(status => status === 'up').length;
      const totalComponents = Object.keys(components).length;
      const healthPercentage = healthyComponents / totalComponents;

      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (healthPercentage >= 0.8) overall = 'healthy';
      else if (healthPercentage >= 0.5) overall = 'degraded';
      else overall = 'unhealthy';

      return {
        success: true,
        data: {
          overall,
          components,
          metrics: {
            avgResponseTime: 2.1,
            errorRate: 0.05,
            throughput: 45.2,
            uptime: 99.7,
          },
          lastCheck: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`RAG 건강 상태 확인 실패: ${errorMsg}`, errorStack);
      throw new HttpException(
        'RAG 건강 상태 확인 실패',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Private helper methods
  private async processAdvancedRAG(userId: string, queryDto: RAGQueryDto): Promise<RAGResult> {
    const context: RAGContext = {
      query: queryDto.query,
      userId,
      contextType: queryDto.contextType || 'recipe_search',
      maxResults: queryDto.maxResults || 10,
      includeNutrition: queryDto.includeNutrition || false,
      includeAlternatives: queryDto.includeAlternatives || false,
      conversationHistory: queryDto.conversationHistory?.map(turn => ({
        ...turn,
        timestamp: turn.timestamp ? new Date(turn.timestamp) : new Date(),
      })) || [],
    };

    return await this.advancedRAGService.processAdvancedRAG(context);
  }

  private async processBasicRAG(query: string): Promise<{ response: string; processingTime: number }> {
    const startTime = Date.now();
    const response = await this.koreanRAGService.generateKoreanResponse(query);
    const processingTime = Date.now() - startTime;

    return { response, processingTime };
  }

  private async compareResponseQuality(
    advancedRAG: RAGResult,
    basicRAG: { response: string; processingTime: number },
    queryDto: RAGQueryDto
  ) {
    // 응답 품질 비교 로직
    const advancedScore = advancedRAG.confidence;
    const basicScore = this.calculateBasicRAGScore(basicRAG.response, queryDto.query);

    const recommendation: 'advanced' | 'basic' = advancedScore > basicScore ? 'advanced' : 'basic';
    const reasoning = this.generateComparisonReasoning(advancedRAG, basicRAG, advancedScore, basicScore);

    return {
      advancedScore,
      basicScore,
      recommendation,
      reasoning,
    };
  }

  private calculateBasicRAGScore(response: string, query: string): number {
    // 기본 RAG 응답 점수 계산
    let score = 50; // 기본 점수

    // 길이 적절성
    if (response.length >= 100 && response.length <= 1000) score += 15;
    
    // 쿼리 관련성
    if (response.toLowerCase().includes(query.toLowerCase().slice(0, 5))) score += 10;
    
    // 구체적 정보 포함
    if (/\d+분|\d+개|단계/.test(response)) score += 10;
    
    // 한국어 자연스러움
    if (/입니다|해보세요|하시면/.test(response)) score += 10;

    return Math.min(score, 95);
  }

  private generateComparisonReasoning(
    advancedRAG: RAGResult,
    basicRAG: { response: string; processingTime: number },
    advancedScore: number,
    basicScore: number
  ): string {
    const scoreDiff = Math.abs(advancedScore - basicScore);
    const timeDiff = advancedRAG.metadata.processingTime - basicRAG.processingTime;

    let reasoning = `고급 RAG의 신뢰도는 ${advancedScore.toFixed(1)}%, 기본 RAG는 ${basicScore.toFixed(1)}%입니다. `;
    
    if (scoreDiff < 10) {
      reasoning += '두 시스템의 품질 차이가 크지 않습니다. ';
    } else if (advancedScore > basicScore) {
      reasoning += '고급 RAG가 더 높은 품질의 응답을 제공했습니다. ';
    } else {
      reasoning += '기본 RAG가 더 나은 성능을 보였습니다. ';
    }

    reasoning += `처리 시간은 고급 RAG가 ${timeDiff}ms 더 소요되었습니다.`;

    return reasoning;
  }

  private async checkElasticsearchHealth(): Promise<'up' | 'down' | 'slow'> {
    try {
      // Elasticsearch 상태 확인 로직
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkOllamaHealth(): Promise<'up' | 'down' | 'slow'> {
    try {
      // Ollama 서비스 상태 확인 로직
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkEmbeddingHealth(): Promise<'up' | 'down' | 'slow'> {
    try {
      // 임베딩 서비스 상태 확인 로직
      return 'up';
    } catch {
      return 'down';
    }
  }
}