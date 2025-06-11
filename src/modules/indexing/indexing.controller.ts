import { Controller, Post, Get, Query, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { IndexingService } from './services/indexing.service';

@ApiTags('Indexing')
@Controller('indexing')
export class IndexingController {
  private readonly logger = new Logger(IndexingController.name);

  constructor(private readonly indexingService: IndexingService) {}

  @Post('full')
  @ApiOperation({
    summary: '전체 데이터 인덱싱',
    description: '레시피와 알레르기 데이터를 읽어서 Elasticsearch, MongoDB, Redis에 인덱싱합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        recipeFilePath: {
          type: 'string',
          description: '레시피 CSV 파일 경로 (선택사항)',
          example: '/Users/choeseonghyeon/smart-recipe-chatbot/mini_recipes.csv',
        },
        allergenFilePath: {
          type: 'string',
          description: '알레르기 CSV 파일 경로 (선택사항)',
          example: '/Users/choeseonghyeon/smart-recipe-chatbot/allergen_ultra_clean.csv',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '인덱싱 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        duration: { type: 'string' },
        stats: {
          type: 'object',
          properties: {
            totalRecipes: { type: 'number' },
            totalIngredients: { type: 'number' },
            averageMatchRate: { type: 'number' },
          },
        },
        phases: {
          type: 'object',
          properties: {
            data_processing: { type: 'string' },
            elasticsearch_indexing: { type: 'string' },
            mongodb_storage: { type: 'string' },
            redis_caching: { type: 'string' },
          },
        },
      },
    },
  })
  async runFullIndexing(
    @Body() body: { recipeFilePath?: string; allergenFilePath?: string }
  ) {
    this.logger.log('전체 데이터 인덱싱 요청 받음');
    
    try {
      const result = await this.indexingService.runFullIndexing();
      
      this.logger.log('전체 데이터 인덱싱 완료');
      return result;
    } catch (error) {
      this.logger.error('전체 데이터 인덱싱 실패:', error);
      throw error;
    }
  }

  @Get('status')
  @ApiOperation({
    summary: '인덱싱 상태 확인',
    description: 'Elasticsearch, MongoDB, Redis의 연결 상태와 데이터 통계를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '상태 확인 성공',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string' },
        services: {
          type: 'object',
          properties: {
            elasticsearch: { type: 'object' },
            mongodb: { type: 'object' },
            redis: { type: 'object' },
          },
        },
        overall_health: { type: 'string', enum: ['healthy', 'partially_healthy', 'unhealthy'] },
      },
    },
  })
  async getIndexingStatus() {
    this.logger.log('인덱싱 상태 확인 요청 받음');
    
    try {
      const status = await this.indexingService.getIndexingStatus();
      this.logger.log('인덱싱 상태 확인 완료');
      return status;
    } catch (error) {
      this.logger.error('인덱싱 상태 확인 실패:', error);
      throw error;
    }
  }

  @Post('elasticsearch/reindex')
  @ApiOperation({
    summary: 'Elasticsearch 재인덱싱',
    description: 'Elasticsearch 인덱스만 다시 생성합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '재인덱싱 성공',
  })
  async reindexElasticsearch() {
    this.logger.log('Elasticsearch 재인덱싱 요청 받음');
    
    try {
      const result = await this.indexingService.reindexElasticsearch();
      this.logger.log('Elasticsearch 재인덱싱 완료');
      return result;
    } catch (error) {
      this.logger.error('Elasticsearch 재인덱싱 실패:', error);
      throw error;
    }
  }

  @Post('redis/rebuild')
  @ApiOperation({
    summary: 'Redis 캐시 재구축',
    description: 'Redis 캐시만 다시 구축합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 재구축 성공',
  })
  async rebuildCache() {
    this.logger.log('Redis 캐시 재구축 요청 받음');
    
    try {
      const result = await this.indexingService.rebuildCache();
      this.logger.log('Redis 캐시 재구축 완료');
      return result;
    } catch (error) {
      this.logger.error('Redis 캐시 재구축 실패:', error);
      throw error;
    }
  }

  @Get('search/safe-recipes')
  @ApiOperation({
    summary: '알레르기 안전 레시피 검색',
    description: '특정 알레르기에 안전한 레시피를 검색합니다.',
  })
  @ApiQuery({
    name: 'allergens',
    description: '피해야 할 알레르기 목록 (쉼표로 구분)',
    example: '우유,견과류',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: '검색 성공',
    schema: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['cache', 'database'] },
        allergens: { type: 'array', items: { type: 'string' } },
        results: { type: 'array' },
        timestamp: { type: 'string' },
      },
    },
  })
  async findSafeRecipes(@Query('allergens') allergensQuery: string) {
    this.logger.log(`알레르기 안전 레시피 검색 요청: ${allergensQuery}`);
    
    try {
      const allergens = allergensQuery.split(',').map(a => a.trim());
      const result = await this.indexingService.findSafeRecipes(allergens);
      
      this.logger.log(`알레르기 안전 레시피 검색 완료: ${allergens.length}개 알레르기`);
      return result;
    } catch (error) {
      this.logger.error('알레르기 안전 레시피 검색 실패:', error);
      throw error;
    }
  }

  @Get('search/ingredient')
  @ApiOperation({
    summary: '재료 알레르기 정보 검색',
    description: '특정 재료의 알레르기 정보를 검색합니다.',
  })
  @ApiQuery({
    name: 'name',
    description: '검색할 재료명',
    example: 'butter',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: '검색 성공',
    schema: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['cache', 'database', 'not_found'] },
        ingredient: { type: 'string' },
        result: { type: 'object' },
        timestamp: { type: 'string' },
      },
    },
  })
  async getIngredientInfo(@Query('name') ingredientName: string) {
    this.logger.log(`재료 알레르기 정보 검색 요청: ${ingredientName}`);
    
    try {
      const result = await this.indexingService.getIngredientInfo(ingredientName);
      this.logger.log(`재료 알레르기 정보 검색 완료: ${ingredientName}`);
      return result;
    } catch (error) {
      this.logger.error('재료 알레르기 정보 검색 실패:', error);
      throw error;
    }
  }
}
