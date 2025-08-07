// src/modules/elasticsearch/elasticsearch.service.ts
import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import {
  ElasticsearchRecipe,
  SearchOptions,
  AdvancedSearchOptions,
  SearchResult,
  RecipeCreateInput,
  RecipeUpdateInput,
  BulkOperationResult,
  RecipeStats,
  HealthStatus,
} from './types/elasticsearch.types';

// Re-export types for external use
export {
  ElasticsearchRecipe,
  SearchOptions,
  AdvancedSearchOptions,
  SearchResult,
  RecipeCreateInput,
  RecipeUpdateInput,
  BulkOperationResult,
  RecipeStats,
  HealthStatus,
  AllergenInfo,
} from './types/elasticsearch.types';

// Modular services
import { RecipeSearchService } from './search/recipe-search.service';
// import { RecipeManagementService } from './management/recipe-management.service'; // Removed
import { AllergenProcessor } from './processors/allergen-processor.service';

/**
 * 리팩토링된 ElasticsearchService
 * 기존 1,409줄 → 모듈화된 구조로 분리
 * 
 * 주요 개선사항:
 * - 검색 로직 → RecipeSearchService
 * - 관리 로직 → RecipeManagementService
 * - 알레르기 처리 → AllergenProcessor
 * - 타입 정의 → elasticsearch.types.ts
 * - 쿼리 빌더 → QueryBuilder 유틸리티
 * - 응답 포맷터 → ResponseFormatter 유틸리티
 * - 유효성 검증 → RecipeValidator 유틸리티
 */
@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private isConnected = false;
  private readonly elasticsearchUrl: string;
  private readonly USE_AI_GENERATED_ONLY: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly recipeSearchService: RecipeSearchService,
    // private readonly recipeManagementService: RecipeManagementService, // Removed
    private readonly allergenProcessor: AllergenProcessor,
    @Inject('ELASTICSEARCH_CLIENT') private readonly client: Client,
  ) {
    this.elasticsearchUrl = this.configService.get<string>('ELASTICSEARCH_URL') || 'http://localhost:9200';
    this.USE_AI_GENERATED_ONLY = this.configService.get<boolean>('USE_AI_GENERATED_ONLY') || false;
  }

  async onModuleInit() {
    await this.testConnection();
  }

  // ==================== Search Operations ====================

  /**
   * 기본 레시피 검색
   */
  async searchRecipes(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    this.ensureConnection();
    return this.recipeSearchService.searchRecipes(query, options);
  }

  /**
   * 고급 레시피 검색
   */
  async advancedSearch(query: string, options: AdvancedSearchOptions): Promise<SearchResult> {
    this.ensureConnection();
    return this.recipeSearchService.advancedSearch(query, options);
  }

  /**
   * ID로 레시피 조회
   */
  async getRecipeById(id: string): Promise<ElasticsearchRecipe | null> {
    this.ensureConnection();
    return this.recipeSearchService.getRecipeById(id);
  }

  /**
   * 다중 ID로 레시피 조회
   */
  async getRecipesByIds(ids: string[]): Promise<ElasticsearchRecipe[]> {
    this.ensureConnection();
    return this.recipeSearchService.getRecipesByIds(ids);
  }

  /**
   * 유사한 레시피 검색
   */
  async getSimilarRecipes(
    recipeId: string, 
    limit: number = 5,
    options: SearchOptions = {}
  ): Promise<ElasticsearchRecipe[]> {
    this.ensureConnection();
    return this.recipeSearchService.getSimilarRecipes(recipeId, limit, options);
  }

  /**
   * 추천 레시피 (개인화)
   */
  async getRecommendedRecipes(
    userId: string,
    userPreferences: string[] = [],
    userAllergies: string[] = [],
    limit: number = 10
  ): Promise<ElasticsearchRecipe[]> {
    this.ensureConnection();
    return this.recipeSearchService.getRecommendedRecipes(userId, userPreferences, userAllergies, limit);
  }

  /**
   * 검색 자동완성
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    this.ensureConnection();
    return this.recipeSearchService.getSearchSuggestions(query, limit);
  }

  /**
   * 카테고리별 인기 레시피
   */
  async getPopularRecipesByCategory(category: string, limit: number = 10): Promise<ElasticsearchRecipe[]> {
    this.ensureConnection();
    return this.recipeSearchService.getPopularRecipesByCategory(category, limit);
  }

  /**
   * 최근 추가된 레시피
   */
  async getRecentRecipes(limit: number = 10): Promise<ElasticsearchRecipe[]> {
    this.ensureConnection();
    return this.recipeSearchService.getRecentRecipes(limit);
  }

  /**
   * 평점 높은 레시피
   */
  async getTopRatedRecipes(limit: number = 10): Promise<ElasticsearchRecipe[]> {
    this.ensureConnection();
    return this.recipeSearchService.getTopRatedRecipes(limit);
  }



  // ==================== Allergen Operations ====================

  /**
   * 레시피의 알레르기 정보 생성
   */
  generateAllergenInfo(recipe: ElasticsearchRecipe) {
    return this.allergenProcessor.generateAllergenInfo(recipe);
  }

  /**
   * 사용자 알레르기에 따른 안전한 레시피 필터링
   */
  filterSafeRecipes(recipes: ElasticsearchRecipe[], userAllergies: string[]): ElasticsearchRecipe[] {
    return this.allergenProcessor.filterSafeRecipes(recipes, userAllergies);
  }

  /**
   * 레시피가 사용자에게 안전한지 확인
   */
  isRecipeSafeForUser(recipe: ElasticsearchRecipe, userAllergies: string[]): boolean {
    const allergenInfo = recipe.allergenInfo || this.allergenProcessor.generateAllergenInfo(recipe);
    return this.allergenProcessor.isRecipeSafeForUser(allergenInfo, userAllergies);
  }

  /**
   * 레시피의 안전도 점수 계산
   */
  calculateSafetyScore(recipe: ElasticsearchRecipe, userAllergies: string[] = []): number {
    return this.allergenProcessor.calculateSafetyScore(recipe, userAllergies);
  }

  /**
   * 대체 재료 제안
   */
  suggestAllergenFreeAlternatives(
    ingredients: string[],
    userAllergies: string[]
  ): Array<{ original: string; alternatives: string[] }> {
    return this.allergenProcessor.suggestAllergenFreeAlternatives(ingredients, userAllergies);
  }


  // ==================== Recipe Management ====================

  /**
   * 새로운 레시피를 Elasticsearch에 저장
   */
  async createRecipe(recipe: ElasticsearchRecipe): Promise<{ success: boolean; id: string }> {
    this.ensureConnection();
    
    try {
      const response = await this.client.index({
        index: 'recipes',
        id: recipe.id,
        body: {
          ...recipe,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
      
      // 인덱스 새로고침으로 즉시 검색 가능하도록 설정
      await this.client.indices.refresh({ index: 'recipes' });
      
      this.logger.log(`✅ 레시피 저장 완료: ${recipe.id}`);
      return { success: true, id: recipe.id };
    } catch (error) {
      this.logger.error(`❌ 레시피 저장 실패: ${recipe.id}`, error);
      throw error;
    }
  }

  /**
   * 레시피 업데이트
   */
  async updateRecipe(id: string, updates: Partial<ElasticsearchRecipe>): Promise<{ success: boolean }> {
    this.ensureConnection();
    
    try {
      await this.client.update({
        index: 'recipes',
        id,
        body: {
          doc: {
            ...updates,
            updatedAt: new Date().toISOString()
          }
        }
      });
      
      await this.client.indices.refresh({ index: 'recipes' });
      
      this.logger.log(`✅ 레시피 업데이트 완료: ${id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`❌ 레시피 업데이트 실패: ${id}`, error);
      throw error;
    }
  }

  /**
   * 레시피 삭제
   */
  async deleteRecipe(id: string): Promise<{ success: boolean }> {
    this.ensureConnection();
    
    try {
      await this.client.delete({
        index: 'recipes',
        id
      });
      
      await this.client.indices.refresh({ index: 'recipes' });
      
      this.logger.log(`✅ 레시피 삭제 완료: ${id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`❌ 레시피 삭제 실패: ${id}`, error);
      throw error;
    }
  }

  // ==================== Statistics & Health ====================

  /**
   * 레시피 통계 조회
   */
  async getRecipeStats(): Promise<RecipeStats> {
    this.ensureConnection();
    
    try {
      // 총 레시피 수 조회
      const totalResponse = await this.executeCount();
      
      // AI 생성 레시피 수 조회
      const aiGeneratedResponse = await this.executeCount({
        bool: {
          filter: [{ term: { isAiGenerated: true } }]
        }
      });

      // 집계 쿼리로 추가 통계 수집
      const statsResponse = await this.executeStatsAggregation();

      return {
        totalRecipes: totalResponse.count,
        averageRating: statsResponse.averageRating || 0,
        popularTags: statsResponse.popularTags || [],
        difficultyDistribution: statsResponse.difficultyDistribution || {},
        averageCookingTime: statsResponse.averageCookingTime || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get recipe stats:', error);
      return {
        totalRecipes: 0,
        averageRating: 0,
        popularTags: [],
        difficultyDistribution: {},
        averageCookingTime: 0,
      };
    }
  }

  /**
   * Elasticsearch 건강 상태 확인
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const clusterHealthResponse = await fetch(`${this.elasticsearchUrl}/_cluster/health`);
      const clusterHealth = await clusterHealthResponse.json();
      
      const indexStatsResponse = await fetch(`${this.elasticsearchUrl}/recipes/_stats`);
      const indexStats = indexStatsResponse.ok ? await indexStatsResponse.json() : null;

      const status = clusterHealth.status === 'green' ? 'healthy' as const : 
                     clusterHealth.status === 'yellow' ? 'degraded' as const : 'unhealthy' as const;

      return {
        status,
        details: {
          connection: this.isConnected,
          indexExists: indexStats !== null,
          docCount: indexStats?.indices?.recipes?.total?.docs?.count || 0,
          lastUpdate: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy' as const,
        details: {
          connection: false,
          indexExists: false,
          docCount: 0,
          lastUpdate: new Date().toISOString(),
        },
      };
    }
  }

  // ==================== Client Access for Migration ====================
  
  /**
   * Elasticsearch 클라이언트 직접 접근 (마이그레이션 용도)
   */
  getClient(): Client {
    return this.client;
  }

  // ==================== Private Helper Methods ====================

  private async testConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.elasticsearchUrl}/_cluster/health`);
      if (response.ok) {
        const health = await response.json() as { status: string };
        this.logger.log(`✅ Elasticsearch connected: ${health.status}`);
        this.isConnected = true;
        
        // 연결 후 기본 통계 확인
        const stats = await this.getRecipeStats();
        this.logger.log(`📊 Recipe Stats: Total=${stats.totalRecipes}, Avg Rating=${stats.averageRating}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('❌ Elasticsearch connection failed:', error);
      this.isConnected = false;
    }
  }

  private ensureConnection(): void {
    if (!this.isConnected) {
      throw new Error('Elasticsearch is not connected');
    }
  }

  // Elasticsearch 실행 메서드들 (실제 구현 필요)
  private async executeCount(query?: object): Promise<{ count: number }> {
    try {
      const response = await this.client.count({
        index: 'recipes',
        ...(query ? { query } : {}),
      });
      
      return { count: response.count };
    } catch (error) {
      this.logger.error('Failed to execute count query:', error);
      throw new Error(`Failed to execute count query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeStatsAggregation(): Promise<any> {
    try {
      const response = await this.client.search({
        index: 'recipes',
        size: 0,
        aggs: {
          avg_rating: { avg: { field: 'rating' } },
          popular_tags: { 
            terms: { 
              field: 'tags.keyword',
              size: 10 
            } 
          },
          difficulty_distribution: { 
            terms: { 
              field: 'difficulty.keyword' 
            } 
          },
          avg_cooking_time: { avg: { field: 'minutes' } }
        }
      });
      
      return response.aggregations || {};
    } catch (error) {
      this.logger.error('Failed to execute stats aggregation:', error);
      throw new Error(`Failed to execute stats aggregation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}