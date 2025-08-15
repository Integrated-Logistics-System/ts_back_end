import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

export interface ElasticsearchRecipe {
  id: string;
  nameKo?: string;
  nameEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  ingredientsKo?: string[];
  ingredientsEn?: string[];
  stepsKo?: string[];
  stepsEn?: string[];
  cookingTime?: number;
  servings?: number;
  difficulty?: string;
  category?: string;
  tags?: string[];
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

@Injectable()
export class ElasticsearchService {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly client: Client;
  private readonly indexName = 'recipes_new';

  constructor() {
    // Elasticsearch URL 검증 및 기본값 설정
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    
    try {
      // URL 형식 검증
      new URL(elasticsearchUrl);
      
      // Elasticsearch 클라이언트 초기화
      this.client = new Client({
        node: elasticsearchUrl,
        requestTimeout: 10000,
        pingTimeout: 3000,
      });
      
      console.log(`✅ Elasticsearch client initialized with URL: ${elasticsearchUrl}`);
    } catch (error) {
      console.error(`❌ Invalid Elasticsearch URL: ${elasticsearchUrl}`);
      console.error('Using fallback configuration...');
      
      // 폴백 설정
      this.client = new Client({
        node: 'http://localhost:9200',
        requestTimeout: 10000,
        pingTimeout: 3000,
      });
    }

    this.logger.log('🔍 Elasticsearch 서비스 초기화 완료');
    this.checkConnection();
  }

  /**
   * Elasticsearch 연결 상태 확인
   */
  private async checkConnection() {
    try {
      const health = await this.client.cluster.health();
      this.logger.log(`✅ Elasticsearch 연결 성공 - Status: ${health.status}`);
    } catch (error) {
      this.logger.error('❌ Elasticsearch 연결 실패:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * 레시피 검색 (텍스트 기반)
   */
  async searchRecipes(query: string, size: number = 10): Promise<ElasticsearchRecipe[]> {
    try {
      this.logger.log(`🔎 Searching recipes for: "${query}"`);

      const searchBody = {
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query: query,
                  fields: [
                    'nameKo^3',
                    'nameEn^2',
                    'descriptionKo^2',
                    'descriptionEn',
                    'ingredientsKo^2',
                    'ingredientsEn',
                    'stepsKo',
                    'stepsEn',
                    'tags^1.5',
                    'category^1.5'
                  ],
                  type: 'best_fields' as const,
                  fuzziness: 'AUTO'
                }
              },
              {
                match: {
                  'ingredientsKo': {
                    query: query,
                    boost: 2
                  }
                }
              }
            ],
            minimum_should_match: 1
          }
        },
        size: size,
        _source: {
          excludes: ['@timestamp', '@version']
        }
      };

      const response = await this.client.search({
        index: this.indexName,
        body: searchBody,
      });

      const recipes: ElasticsearchRecipe[] = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));

      this.logger.log(`📋 Found ${recipes.length} recipes`);
      return recipes;

    } catch (error) {
      this.logger.error('❌ Recipe search error:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * 레시피 ID로 상세 조회
   */
  async getRecipeById(id: string): Promise<ElasticsearchRecipe | null> {
    try {
      this.logger.log(`🔍 Getting recipe by ID: ${id}`);

      const response = await this.client.get({
        index: this.indexName,
        id: id,
      });

      if (response.found) {
        const recipe: ElasticsearchRecipe = {
          id: response._id,
          ...response._source as any,
        };

        this.logger.log(`✅ Recipe found: ${recipe.nameKo || recipe.nameEn}`);
        return recipe;
      }

      this.logger.warn(`⚠️ Recipe not found for ID: ${id}`);
      return null;

    } catch (error) {
      this.logger.error('❌ Get recipe by ID error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * 카테고리별 레시피 조회
   */
  async getRecipesByCategory(category: string, size: number = 10): Promise<ElasticsearchRecipe[]> {
    try {
      this.logger.log(`🏷️ Getting recipes by category: ${category}`);

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            term: {
              'category.keyword': category
            }
          },
          size: size,
          sort: [
            { '_score': { order: 'desc' } }
          ]
        },
      });

      const recipes: ElasticsearchRecipe[] = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));

      this.logger.log(`📋 Found ${recipes.length} recipes in category: ${category}`);
      return recipes;

    } catch (error) {
      this.logger.error('❌ Get recipes by category error:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * 재료 기반 레시피 검색 (알레르기 필터링 포함)
   */
  async searchRecipesByIngredients(
    ingredients: string[], 
    excludeIngredients?: string[], 
    size: number = 10
  ): Promise<ElasticsearchRecipe[]> {
    try {
      this.logger.log(`🥘 Searching recipes with ingredients: ${ingredients.join(', ')}`);
      if (excludeIngredients && excludeIngredients.length > 0) {
        this.logger.log(`🚫 Excluding ingredients: ${excludeIngredients.join(', ')}`);
      }

      const mustClauses = ingredients.map(ingredient => ({
        multi_match: {
          query: ingredient,
          fields: ['ingredientsKo^2', 'ingredientsEn^2', 'nameKo', 'nameEn'],
          fuzziness: 'AUTO'
        }
      }));

      const mustNotClauses = excludeIngredients ? excludeIngredients.map(ingredient => ({
        multi_match: {
          query: ingredient,
          fields: ['ingredientsKo', 'ingredientsEn'],
          fuzziness: 'AUTO'
        }
      })) : [];

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              must: mustClauses,
              must_not: mustNotClauses
            }
          },
          size: size,
          sort: [
            { '_score': { order: 'desc' } }
          ]
        },
      });

      const recipes: ElasticsearchRecipe[] = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));

      this.logger.log(`📋 Found ${recipes.length} recipes matching ingredients`);
      return recipes;

    } catch (error) {
      this.logger.error('❌ Search recipes by ingredients error:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * 인기 레시피 조회
   */
  async getPopularRecipes(size: number = 10): Promise<ElasticsearchRecipe[]> {
    try {
      this.logger.log(`⭐ Getting ${size} popular recipes`);

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            match_all: {}
          },
          size: size,
          sort: [
            { '_score': { order: 'desc' } },
            { 'cookingTime': { order: 'asc' } }
          ]
        },
      });

      const recipes: ElasticsearchRecipe[] = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));

      this.logger.log(`📋 Retrieved ${recipes.length} popular recipes`);
      return recipes;

    } catch (error) {
      this.logger.error('❌ Get popular recipes error:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * 레시피 총 개수 조회
   */
  async getRecipeCount(): Promise<number> {
    try {
      const response = await this.client.count({
        index: this.indexName,
      });

      const count = response.count || 0;
      this.logger.log(`📊 Total recipes in index: ${count}`);
      return count;

    } catch (error) {
      this.logger.error('❌ Get recipe count error:', error instanceof Error ? error.message : error);
      return 0;
    }
  }

  /**
   * 레시피 카테고리 목록 조회
   */
  async getRecipeCategories(): Promise<string[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: 0,
          aggs: {
            categories: {
              terms: {
                field: 'category.keyword',
                size: 100
              }
            }
          }
        },
      });

      const aggregations = response.aggregations as Record<string, any>;
      const categories: string[] = aggregations?.categories?.buckets?.map(
        (bucket: any) => bucket.key
      ) || [];

      this.logger.log(`🏷️ Found categories: ${categories.join(', ')}`);
      return categories;

    } catch (error) {
      this.logger.error('❌ Get recipe categories error:', error instanceof Error ? error.message : error);
      return [];
    }
  }
}