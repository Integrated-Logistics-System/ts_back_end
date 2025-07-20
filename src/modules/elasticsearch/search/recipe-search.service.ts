import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import {
  ElasticsearchRecipe,
  SearchOptions,
  AdvancedSearchOptions,
  SearchResult,
  ElasticsearchResponse,
  ElasticsearchHit,
} from '../types/elasticsearch.types';
import { QueryBuilder } from '../utils/query-builder.util';
import { ResponseFormatter } from '../utils/response-formatter.util';

@Injectable()
export class RecipeSearchService {
  private readonly logger = new Logger(RecipeSearchService.name);
  private readonly indexName = 'recipes';

  constructor(
    private readonly configService: ConfigService,
    private readonly queryBuilder: QueryBuilder,
    private readonly responseFormatter: ResponseFormatter,
    @Inject('ELASTICSEARCH_CLIENT') private readonly client: Client,
  ) {}

  /**
   * 기본 레시피 검색
   */
  async searchRecipes(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      const searchQuery = this.queryBuilder.buildBasicSearchQuery(query, options);
      const response = await this.executeSearch(searchQuery);
      
      const recipes = this.responseFormatter.formatSearchResults(response);
      const searchTime = Date.now() - startTime;

      return {
        recipes,
        total: response.hits.total.value,
        page: options.page || 1,
        limit: options.limit || 10,
        hasMore: this.hasMoreResults(response, options),
        searchTime,
        aggregations: response.aggregations,
      };

    } catch (error) {
      this.logger.error('Recipe search failed:', error);
      throw error;
    }
  }

  /**
   * 고급 레시피 검색
   */
  async advancedSearch(query: string, options: AdvancedSearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      const searchQuery = this.queryBuilder.buildAdvancedSearchQuery(query, options);
      const response = await this.executeSearch(searchQuery);
      
      const recipes = this.responseFormatter.formatSearchResults(response);
      const searchTime = Date.now() - startTime;

      return {
        recipes,
        total: response.hits.total.value,
        page: options.page || 1,
        limit: options.limit || 10,
        hasMore: this.hasMoreResults(response, options),
        searchTime,
        aggregations: response.aggregations,
      };

    } catch (error) {
      this.logger.error('Advanced search failed:', error);
      throw error;
    }
  }

  /**
   * ID로 레시피 조회
   */
  async getRecipeById(id: string): Promise<ElasticsearchRecipe | null> {
    try {
      const response = await this.executeGet(id);
      return response ? this.responseFormatter.formatSingleResult(response) : null;
    } catch (error) {
      this.logger.error(`Failed to get recipe by ID ${id}:`, error);
      return null;
    }
  }

  /**
   * 다중 ID로 레시피 조회
   */
  async getRecipesByIds(ids: string[]): Promise<ElasticsearchRecipe[]> {
    if (!ids.length) return [];

    try {
      const query = this.queryBuilder.buildMultiGetQuery(ids);
      const response = await this.executeSearch(query);
      return this.responseFormatter.formatSearchResults(response);
    } catch (error) {
      this.logger.error('Failed to get recipes by IDs:', error);
      return [];
    }
  }

  /**
   * 유사한 레시피 검색
   */
  async getSimilarRecipes(
    recipeId: string, 
    limit: number = 5,
    options: SearchOptions = {}
  ): Promise<ElasticsearchRecipe[]> {
    try {
      const baseRecipe = await this.getRecipeById(recipeId);
      if (!baseRecipe) {
        this.logger.warn(`Base recipe not found: ${recipeId}`);
        return [];
      }

      const query = this.queryBuilder.buildSimilarityQuery(baseRecipe, limit, options);
      const response = await this.executeSearch(query);
      
      return this.responseFormatter.formatSearchResults(response)
        .filter(recipe => recipe.id !== recipeId); // 자기 자신 제외

    } catch (error) {
      this.logger.error('Failed to get similar recipes:', error);
      return [];
    }
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
    try {
      const query = this.queryBuilder.buildRecommendationQuery(
        userId,
        userPreferences,
        userAllergies,
        limit
      );
      
      const response = await this.executeSearch(query);
      return this.responseFormatter.formatSearchResults(response);

    } catch (error) {
      this.logger.error('Failed to get recommended recipes:', error);
      return [];
    }
  }

  /**
   * 레시피 검색 자동완성
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      const suggestQuery = this.queryBuilder.buildSuggestionQuery(query, limit);
      const response = await this.executeSuggest(suggestQuery);
      return this.responseFormatter.formatSuggestions(response);
    } catch (error) {
      this.logger.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * 카테고리별 인기 레시피
   */
  async getPopularRecipesByCategory(
    category: string,
    limit: number = 10
  ): Promise<ElasticsearchRecipe[]> {
    try {
      const query = this.queryBuilder.buildCategoryPopularQuery(category, limit);
      const response = await this.executeSearch(query);
      return this.responseFormatter.formatSearchResults(response);
    } catch (error) {
      this.logger.error('Failed to get popular recipes by category:', error);
      return [];
    }
  }

  /**
   * 최근 추가된 레시피
   */
  async getRecentRecipes(limit: number = 10): Promise<ElasticsearchRecipe[]> {
    try {
      const query = this.queryBuilder.buildRecentRecipesQuery(limit);
      const response = await this.executeSearch(query);
      return this.responseFormatter.formatSearchResults(response);
    } catch (error) {
      this.logger.error('Failed to get recent recipes:', error);
      return [];
    }
  }

  /**
   * 평점 높은 레시피
   */
  async getTopRatedRecipes(limit: number = 10): Promise<ElasticsearchRecipe[]> {
    try {
      const query = this.queryBuilder.buildTopRatedQuery(limit);
      const response = await this.executeSearch(query);
      return this.responseFormatter.formatSearchResults(response);
    } catch (error) {
      this.logger.error('Failed to get top rated recipes:', error);
      return [];
    }
  }

  // ==================== Private Helper Methods ====================

  private async executeSearch(query: object): Promise<ElasticsearchResponse<ElasticsearchRecipe>> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        ...query,
      });
      
      return response as ElasticsearchResponse<ElasticsearchRecipe>;
    } catch (error) {
      this.logger.error('Elasticsearch search failed:', error);
      throw new Error(`Elasticsearch search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeGet(id: string): Promise<ElasticsearchHit<ElasticsearchRecipe> | null> {
    try {
      const response = await this.client.get({
        index: this.indexName,
        id: id,
      });
      
      return response as ElasticsearchHit<ElasticsearchRecipe>;
    } catch (error) {
      if ((error as any).statusCode === 404) {
        return null;
      }
      this.logger.error('Elasticsearch get failed:', error);
      throw new Error(`Elasticsearch get failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeSuggest(query: object): Promise<any> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        ...query,
      });
      
      return response.suggest || {};
    } catch (error) {
      this.logger.error('Elasticsearch suggest failed:', error);
      throw new Error(`Elasticsearch suggest failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private hasMoreResults(response: ElasticsearchResponse<any>, options: SearchOptions): boolean {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const totalResults = response.hits.total.value;
    
    return (page * limit) < totalResults;
  }
}