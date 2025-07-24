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
  VectorSearchOptions,
  VectorSearchResult,
  VectorSearchResponse,
} from '../types/elasticsearch.types';
import { QueryBuilder } from '../utils/query-builder.util';
import { ResponseFormatter } from '../utils/response-formatter.util';
import { EmbeddingService } from '../../embedding/embedding.service';

@Injectable()
export class RecipeSearchService {
  private readonly logger = new Logger(RecipeSearchService.name);
  private readonly indexName = 'recipes';

  constructor(
    private readonly configService: ConfigService,
    private readonly queryBuilder: QueryBuilder,
    private readonly responseFormatter: ResponseFormatter,
    private readonly embeddingService: EmbeddingService,
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

  /**
   * 벡터 검색 (의미적 유사도 기반)
   * 768차원 granite-embedding 벡터를 사용한 유사도 검색
   */
  async vectorSearch(options: VectorSearchOptions): Promise<VectorSearchResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🔍 Vector search for query: "${options.query}"`);
      
      // 기본값 설정
      const k = options.k || 10;
      const vectorWeight = options.vectorWeight || 0.6;
      const textWeight = options.textWeight || 0.4;
      const useHybridSearch = options.useHybridSearch !== false;
      const minScore = options.minScore || 0.1;

      // 쿼리 임베딩 생성
      const embeddingStartTime = Date.now();
      const queryEmbedding = await this.generateQueryEmbedding(options.query);
      const embeddingTime = Date.now() - embeddingStartTime;
      
      this.logger.log(`🧠 Query embedding generated in ${embeddingTime}ms`);

      // 검색 쿼리 구성
      const searchQuery = this.buildVectorSearchQuery(
        queryEmbedding,
        options,
        k,
        vectorWeight,
        textWeight,
        useHybridSearch,
        minScore
      );

      // Elasticsearch 실행
      const esStartTime = Date.now();
      const response = await this.executeSearch(searchQuery);
      const esTime = Date.now() - esStartTime;

      // 결과 포맷팅
      const results = this.formatVectorSearchResults(response, vectorWeight, textWeight);
      const totalTime = Date.now() - startTime;

      this.logger.log(`✅ Vector search completed: ${results.length} results in ${totalTime}ms`);

      return {
        results,
        total: response.hits.total.value,
        maxScore: response.hits.hits.length > 0 ? Math.max(...response.hits.hits.map(hit => hit._score || 0)) : 0,
        searchTime: totalTime,
        searchMethod: useHybridSearch ? 'hybrid' : 'vector',
        metadata: {
          vectorWeight,
          textWeight,
          queryEmbeddingTime: embeddingTime,
          elasticsearchTime: esTime,
          k,
        },
      };

    } catch (error) {
      this.logger.error('Vector search failed:', error);
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // ==================== Vector Search Helper Methods ====================

  /**
   * 쿼리 임베딩 생성 (EmbeddingService 사용)
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      // 실제 EmbeddingService를 사용하여 쿼리 임베딩 생성
      const embedding = await this.embeddingService.embedQuery(query);
      
      this.logger.log(`🧠 Generated ${embedding.length}-dimensional embedding for query`);
      return embedding;
      
    } catch (error) {
      this.logger.error('Failed to generate query embedding:', error);
      throw new Error('Query embedding generation failed');
    }
  }

  /**
   * 벡터 검색 쿼리 구성
   */
  private buildVectorSearchQuery(
    queryEmbedding: number[],
    options: VectorSearchOptions,
    k: number,
    vectorWeight: number,
    textWeight: number,
    useHybridSearch: boolean,
    minScore: number
  ): object {
    const vectorQuery = {
      script_score: {
        query: {
          bool: {
            filter: [
              { exists: { field: 'embedding' } },
              // 알레르기 필터
              ...(options.allergies && options.allergies.length > 0
                ? [{
                    bool: {
                      must_not: options.allergies.map(allergy => ({
                        term: { 'allergies.keyword': allergy }
                      }))
                    }
                  }]
                : [])
            ]
          }
        },
        script: {
          source: `cosineSimilarity(params.query_vector, 'embedding') + 1.0`,
          params: {
            query_vector: queryEmbedding
          }
        },
        min_score: minScore
      }
    };

    if (!useHybridSearch) {
      return {
        size: k,
        query: vectorQuery,
        _source: {
          excludes: ['embedding'] // 응답에서 임베딩 벡터 제외
        }
      };
    }

    // 하이브리드 검색 (벡터 + 텍스트) - 한글 필드 우선
    const textQuery = {
      bool: {
        should: [
          { match: { nameKo: { query: options.query, boost: 3.0 } } },
          { match: { name: { query: options.query, boost: 1.5 } } },
          { match: { descriptionKo: { query: options.query, boost: 2.0 } } },
          { match: { description: { query: options.query, boost: 1.0 } } },
          { match: { ingredientsKo: { query: options.query, boost: 1.8 } } },
          { match: { ingredients: { query: options.query, boost: 1.0 } } },
          { match: { tagsKo: { query: options.query, boost: 1.5 } } },
          { match: { tags: { query: options.query, boost: 0.8 } } }
        ]
      }
    };

    return {
      size: k,
      query: {
        bool: {
          should: [
            {
              constant_score: {
                query: vectorQuery,
                boost: vectorWeight
              }
            },
            {
              constant_score: {
                query: textQuery,
                boost: textWeight
              }
            }
          ],
          filter: [
            ...(options.allergies && options.allergies.length > 0
              ? [{
                  bool: {
                    must_not: options.allergies.map(allergy => ({
                      term: { 'allergies.keyword': allergy }
                    }))
                  }
                }]
              : [])
          ]
        }
      },
      _source: {
        excludes: ['embedding'] // 응답에서 임베딩 벡터 제외
      }
    };
  }

  /**
   * 벡터 검색 결과 포맷팅
   */
  private formatVectorSearchResults(
    response: ElasticsearchResponse<ElasticsearchRecipe>,
    vectorWeight: number,
    textWeight: number
  ): VectorSearchResult[] {
    return response.hits.hits.map(hit => {
      const recipe = hit._source as ElasticsearchRecipe;
      
      return {
        ...recipe,
        id: hit._id,
        _score: hit._score || 0,
        vectorSimilarity: hit._score ? hit._score * vectorWeight : undefined,
        textRelevance: hit._score ? hit._score * textWeight : undefined,
        combinedScore: hit._score || 0,
        searchMethod: vectorWeight > 0 && textWeight > 0 ? 'hybrid' : 'vector'
      } as VectorSearchResult;
    });
  }
}