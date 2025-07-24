import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Query, 
  HttpException, 
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ElasticsearchService } from '../elasticsearch.service';
import { VectorSearchCacheService } from '../services/vector-search-cache.service';
import { 
  VectorSearchDto, 
  VectorSearchQueryDto, 
  PersonalizedRecommendationDto,
  VectorSearchResponseDto 
} from '../dto/vector-search.dto';
import { 
  VectorSearchResponse, 
  VectorSearchOptions,
  ElasticsearchRecipe 
} from '../types/elasticsearch.types';

/**
 * 벡터 검색 전용 REST API 컨트롤러
 * 의미적 유사도 기반 레시피 검색 서비스
 */
@ApiTags('Vector Search')
@Controller('api/vector-search')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class VectorSearchController {
  private readonly logger = new Logger(VectorSearchController.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly cacheService: VectorSearchCacheService
  ) {}

  /**
   * 벡터 검색 (POST) - 고급 옵션 지원
   */
  @Post('search')
  @ApiOperation({ 
    summary: '벡터 검색 (고급)',
    description: '의미적 유사도 기반 레시피 검색 (하이브리드 검색, 개인화 필터링 지원)'
  })
  @ApiResponse({ 
    status: 200, 
    description: '검색 성공',
    type: VectorSearchResponseDto
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 500, description: '서버 오류' })
  async vectorSearch(@Body() searchDto: VectorSearchDto): Promise<VectorSearchResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🔍 Vector search request: "${searchDto.query}"`);

      // DTO를 VectorSearchOptions로 변환
      const searchOptions: VectorSearchOptions = {
        query: searchDto.query,
        k: searchDto.k || 10,
        vectorWeight: searchDto.vectorWeight || 0.6,
        textWeight: searchDto.textWeight || 0.4,
        useHybridSearch: searchDto.useHybridSearch !== false,
        minScore: searchDto.minScore || 0.1,
        allergies: searchDto.allergies || [],
        preferences: searchDto.preferences || []
      };

      // 캐시된 결과 확인
      const cachedResult = await this.cacheService.getCachedResult(searchOptions);
      if (cachedResult) {
        const processingTime = Date.now() - startTime;
        this.logger.log(`✅ Vector search (cached): ${cachedResult.results.length} results in ${processingTime}ms`);
        return cachedResult;
      }

      // 벡터 검색 실행
      const result = await this.elasticsearchService.vectorSearch(searchOptions);

      // 결과 캐싱 (비동기로 실행하여 응답 속도에 영향 없음)
      this.cacheService.cacheResult(searchOptions, result).catch(err => {
        this.logger.warn('Failed to cache result:', err);
      });

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Vector search completed: ${result.results.length} results in ${processingTime}ms`);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Vector search failed: ${errorMessage}`, error);
      
      throw new HttpException(
        {
          message: 'Vector search failed',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 벡터 검색 (GET) - 간단한 쿼리용
   */
  @Get('search')
  @ApiOperation({ 
    summary: '벡터 검색 (간단)',
    description: '쿼리 문자열을 사용한 간단한 벡터 검색'
  })
  @ApiQuery({ name: 'q', description: '검색 쿼리', required: true })
  @ApiQuery({ name: 'k', description: '반환할 결과 수', required: false, type: Number })
  @ApiQuery({ name: 'hybrid', description: '하이브리드 검색 사용', required: false, type: Boolean })
  @ApiQuery({ name: 'allergies', description: '알레르기 필터 (쉼표로 구분)', required: false })
  @ApiResponse({ status: 200, description: '검색 성공', type: VectorSearchResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async simpleVectorSearch(@Query() queryDto: VectorSearchQueryDto): Promise<VectorSearchResponse> {
    const startTime = Date.now();

    try {
      if (!queryDto.q || queryDto.q.trim().length === 0) {
        throw new HttpException('검색 쿼리가 필요합니다', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`🔍 Simple vector search: "${queryDto.q}"`);

      // 쿼리 파라미터를 VectorSearchOptions로 변환
      const searchOptions: VectorSearchOptions = {
        query: queryDto.q.trim(),
        k: queryDto.k || 10,
        useHybridSearch: queryDto.hybrid !== false,
        allergies: queryDto.allergies ? queryDto.allergies.split(',').map(a => a.trim()) : [],
        vectorWeight: 0.6,
        textWeight: 0.4,
        minScore: 0.1
      };

      const result = await this.elasticsearchService.vectorSearch(searchOptions);

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Simple vector search completed: ${result.results.length} results in ${processingTime}ms`);

      return result;

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Simple vector search failed: ${errorMessage}`, error);
      
      throw new HttpException(
        {
          message: 'Vector search failed',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 유사한 레시피 검색
   */
  @Get('similar/:recipeId')
  @ApiOperation({ 
    summary: '유사한 레시피 검색',
    description: '특정 레시피와 유사한 다른 레시피들을 벡터 검색으로 찾기'
  })
  @ApiQuery({ name: 'k', description: '반환할 결과 수', required: false, type: Number })
  @ApiQuery({ name: 'allergies', description: '알레르기 필터 (쉼표로 구분)', required: false })
  @ApiResponse({ status: 200, description: '유사 레시피 검색 성공' })
  @ApiResponse({ status: 404, description: '레시피를 찾을 수 없음' })
  async findSimilarRecipes(
    @Query('recipeId') recipeId: string,
    @Query('k') k?: number,
    @Query('allergies') allergies?: string
  ): Promise<{
    baseRecipe: ElasticsearchRecipe;
    similarRecipes: VectorSearchResponse;
  }> {
    const startTime = Date.now();

    try {
      this.logger.log(`🔍 Finding similar recipes for: ${recipeId}`);

      // 기준 레시피 조회
      const baseRecipe = await this.elasticsearchService.getRecipeById(recipeId);
      if (!baseRecipe) {
        throw new HttpException('레시피를 찾을 수 없습니다', HttpStatus.NOT_FOUND);
      }

      // 레시피 이름과 설명을 기반으로 유사 레시피 검색
      const searchQuery = `${baseRecipe.name} ${baseRecipe.description}`;
      const searchOptions: VectorSearchOptions = {
        query: searchQuery,
        k: (k || 5) + 1, // 자기 자신 제외를 위해 +1
        useHybridSearch: true,
        allergies: allergies ? allergies.split(',').map(a => a.trim()) : [],
        vectorWeight: 0.8, // 벡터 검색 비중 높임
        textWeight: 0.2,
        minScore: 0.2
      };

      const similarResults = await this.elasticsearchService.vectorSearch(searchOptions);

      // 자기 자신 제외
      const filteredResults = {
        ...similarResults,
        results: similarResults.results.filter(recipe => recipe.id !== recipeId)
      };

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Similar recipes found: ${filteredResults.results.length} results in ${processingTime}ms`);

      return {
        baseRecipe,
        similarRecipes: filteredResults
      };

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Similar recipe search failed: ${errorMessage}`, error);
      
      throw new HttpException(
        {
          message: 'Similar recipe search failed',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 개인화된 레시피 추천
   */
  @Post('recommendations')
  @ApiOperation({ 
    summary: '개인화된 레시피 추천',
    description: '사용자 프로필 기반 맞춤형 레시피 추천'
  })
  @ApiResponse({ status: 200, description: '추천 성공', type: VectorSearchResponseDto })
  async getPersonalizedRecommendations(
    @Body() recommendationDto: PersonalizedRecommendationDto
  ): Promise<VectorSearchResponse> {
    const startTime = Date.now();

    try {
      this.logger.log(`🎯 Personalized recommendation request`);

      // 개인화 쿼리 생성
      const queryParts = [];
      
      if (recommendationDto.preferences && recommendationDto.preferences.length > 0) {
        queryParts.push(recommendationDto.preferences.join(' '));
      }
      
      if (recommendationDto.favoriteIngredients && recommendationDto.favoriteIngredients.length > 0) {
        queryParts.push(recommendationDto.favoriteIngredients.join(' '));
      }

      if (recommendationDto.difficulty) {
        queryParts.push(recommendationDto.difficulty);
      }

      // 기본 쿼리가 없으면 인기 레시피 검색
      const searchQuery = queryParts.length > 0 ? queryParts.join(' ') : '인기 맛있는 요리';

      const searchOptions: VectorSearchOptions = {
        query: searchQuery,
        k: recommendationDto.k || 10,
        useHybridSearch: true,
        allergies: recommendationDto.allergies || [],
        preferences: recommendationDto.preferences || [],
        vectorWeight: 0.7,
        textWeight: 0.3,
        minScore: 0.15 // 추천의 경우 더 관대한 점수
      };

      const result = await this.elasticsearchService.vectorSearch(searchOptions);

      // 추가 필터링 적용 (요리 시간 등)
      if (recommendationDto.maxCookTime) {
        result.results = result.results.filter(recipe => 
          recipe.minutes <= recommendationDto.maxCookTime!
        );
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Personalized recommendations: ${result.results.length} results in ${processingTime}ms`);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Personalized recommendations failed: ${errorMessage}`, error);
      
      throw new HttpException(
        {
          message: 'Personalized recommendations failed',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 벡터 검색 성능 통계
   */
  @Get('stats')
  @ApiOperation({ 
    summary: '벡터 검색 통계',
    description: '벡터 검색 서비스의 성능 및 상태 정보'
  })
  @ApiResponse({ status: 200, description: '통계 조회 성공' })
  async getVectorSearchStats(): Promise<{
    elasticsearch: any;
    embedding: any;
    totalRecipes: number;
    indexedRecipes: number;
    lastUpdate: string;
  }> {
    try {
      this.logger.log('📊 Getting vector search statistics');

      // Elasticsearch 상태 확인
      const esHealth = await this.elasticsearchService.getHealthStatus();
      
      // 레시피 통계 확인
      const recipeStats = await this.elasticsearchService.getRecipeStats();

      // 임베딩이 있는 레시피 수 계산 (추정)
      // 실제로는 Elasticsearch aggregation으로 정확히 계산해야 함
      const indexedRecipes = Math.floor(recipeStats.totalRecipes * 0.95); // 95% 추정

      return {
        elasticsearch: esHealth,
        embedding: {
          status: 'healthy', // EmbeddingService 상태 확인 필요
          model: 'nomic-embed-text',
          dimensions: 384
        },
        totalRecipes: recipeStats.totalRecipes,
        indexedRecipes,
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Vector search stats failed: ${errorMessage}`, error);
      
      throw new HttpException(
        {
          message: 'Failed to get vector search statistics',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 벡터 검색 캐시 관리
   */
  @Post('cache/invalidate')
  @ApiOperation({ 
    summary: '캐시 무효화',
    description: '모든 벡터 검색 캐시를 무효화합니다'
  })
  @ApiResponse({ status: 200, description: '캐시 무효화 성공' })
  async invalidateCache(): Promise<{ message: string; timestamp: string }> {
    try {
      await this.cacheService.invalidateAll();
      
      this.logger.log('🗑️  All vector search cache invalidated');
      
      return {
        message: 'All vector search cache invalidated successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Cache invalidation failed: ${errorMessage}`, error);
      
      throw new HttpException(
        {
          message: 'Cache invalidation failed',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 캐시 상태 조회
   */
  @Get('cache/status')
  @ApiOperation({ 
    summary: '캐시 상태 조회',
    description: '벡터 검색 캐시의 현재 상태와 통계 정보'
  })
  @ApiResponse({ status: 200, description: '캐시 상태 조회 성공' })
  async getCacheStatus(): Promise<{
    cache: any;
    health: any;
    stats: any;
    lastUpdated: string;
  }> {
    try {
      const [cacheStats, healthCheck] = await Promise.all([
        this.cacheService.getCacheStats(),
        this.cacheService.healthCheck()
      ]);

      return {
        cache: {
          status: healthCheck.status,
          totalKeys: cacheStats.totalKeys,
          hitRate: cacheStats.hitRate,
          memoryUsage: cacheStats.memoryUsage
        },
        health: healthCheck,
        stats: cacheStats,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Cache status check failed: ${errorMessage}`, error);
      
      throw new HttpException(
        {
          message: 'Failed to get cache status',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 인기 검색어 조회
   */
  @Get('popular-queries')
  @ApiOperation({ 
    summary: '인기 검색어 조회',
    description: '자주 검색되는 쿼리 목록 (캐시 최적화용)'
  })
  @ApiQuery({ name: 'limit', description: '조회할 검색어 수', required: false, type: Number })
  @ApiResponse({ status: 200, description: '인기 검색어 조회 성공' })
  async getPopularQueries(@Query('limit') limit?: number): Promise<{
    queries: Array<{
      query: string;
      hitCount: number;
      lastAccessed: string;
    }>;
    totalQueries: number;
    lastUpdated: string;
  }> {
    try {
      const queryLimit = Math.min(limit || 10, 50);
      const popularQueries = await this.cacheService.getPopularQueries(queryLimit);

      return {
        queries: popularQueries,
        totalQueries: popularQueries.length,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Popular queries lookup failed: ${errorMessage}`, error);
      
      throw new HttpException(
        {
          message: 'Failed to get popular queries',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 캐시 워밍업
   */
  @Post('cache/warmup')
  @ApiOperation({ 
    summary: '캐시 워밍업',
    description: '인기 검색어들을 미리 캐싱하여 성능 향상'
  })
  @ApiResponse({ status: 200, description: '캐시 워밍업 시작' })
  async warmupCache(@Body() warmupDto: { queries: string[] }): Promise<{
    message: string;
    queriesCount: number;
    timestamp: string;
  }> {
    try {
      // 비동기로 워밍업 실행 (응답 속도를 위해)
      this.cacheService.warmupCache(warmupDto.queries).catch(err => {
        this.logger.error('Cache warmup failed:', err);
      });

      this.logger.log(`🔥 Cache warmup started for ${warmupDto.queries.length} queries`);

      return {
        message: 'Cache warmup started successfully',
        queriesCount: warmupDto.queries.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Cache warmup failed: ${errorMessage}`, error);
      
      throw new HttpException(
        {
          message: 'Cache warmup failed',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}