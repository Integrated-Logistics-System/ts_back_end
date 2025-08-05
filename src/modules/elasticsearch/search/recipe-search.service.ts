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

@Injectable()
export class RecipeSearchService {
  private readonly logger = new Logger(RecipeSearchService.name);
  private readonly indexName = 'recipes';

  constructor(
    private readonly configService: ConfigService,
    @Inject('ELASTICSEARCH_CLIENT') private readonly client: Client,
  ) {}

  /**
   * 텍스트 기반 레시피 검색 (벡터 검색 제거됨)
   */
  async searchRecipes(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const startTime = Date.now();
    this.logger.log(`🔍 Text-only search: "${query}"`);
    
    try {
      // 핵심 재료 키워드 추출
      const ingredientKeywords = this.extractIngredientKeywords(query);
      
      const searchQuery: any = {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: [
                    'nameKo^4',          // 한국어 이름 최고 가중치
                    'name^3',            // 영어 이름 
                    'descriptionKo^3',   // 한국어 설명
                    'description^2',     // 영어 설명
                    'ingredientsKo^3',   // 한국어 재료 가중치 증가
                    'ingredients^2',     // 영어 재료 가중치 증가
                    'tagsKo^2',          // 한국어 태그
                    'tags'               // 영어 태그
                  ],
                  type: 'best_fields',
                  fuzziness: 'AUTO'
                }
              }
            ],
            // 핵심 재료가 있으면 boost 적용
            should: ingredientKeywords.length > 0 ? [
              {
                terms: {
                  'ingredientsKo': ingredientKeywords,
                  boost: 3.0
                }
              },
              {
                terms: {
                  'ingredients': ingredientKeywords.map(k => this.translateToEnglish(k)),
                  boost: 2.0
                }
              }
            ] : []
          }
        },
        size: options.limit || 10,
        _source: [
          'name', 'nameKo', 'description', 'descriptionKo',
          'ingredients', 'ingredientsKo', 'steps', 'stepsKo',
          'minutes', 'servings', 'difficulty', 'tags', 'tagsKo'
        ]
      };

      // 알레르기 필터 추가
      if (options.allergies && options.allergies.length > 0) {
        searchQuery.query.bool.must_not = [
          {
            terms: {
              'ingredients.keyword': options.allergies
            }
          }
        ];
      }

      // 최대 조리 시간 필터
      if (options.maxCookingTime) {
        searchQuery.query.bool.filter = [
          {
            range: {
              minutes: { lte: options.maxCookingTime }
            }
          }
        ];
      }

      const response = await this.client.search({
        index: this.indexName,
        body: searchQuery,
      });

      const searchTime = Date.now() - startTime;
      
      // 🔍 디버깅: Elasticsearch 원본 응답 확인
      this.logger.debug(`📊 Elasticsearch 원본 응답 - hits.total: ${typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value}, hits.hits.length: ${response.hits.hits.length}`);
      
      const recipes = this.formatSearchResults(response.hits.hits);

      this.logger.log(`✅ Found ${recipes.length} recipes in ${searchTime}ms`);

      // 📊 Elasticsearch 검색 결과 상세 로그
      if (recipes.length > 0) {
        this.logger.log(`🔍 Elasticsearch 검색 결과 ("${query}"):`);
        recipes.forEach((recipe, index) => {
          this.logger.log(`  ${index + 1}. ${recipe.nameKo || recipe.name || 'Unknown'} (${recipe.minutes || 0}분, ${recipe.difficulty || '보통'})`);
        });
      } else {
        this.logger.warn(`⚠️ Elasticsearch에서 "${query}"에 대한 레시피를 찾지 못했습니다!`);
      }

      const total = typeof response.hits.total === 'number' 
        ? response.hits.total 
        : response.hits.total?.value || 0;

      return {
        recipes,
        total,
        page: 1,
        limit: options.limit || 10,
        hasMore: false,
        searchTime,
      };

    } catch (error) {
      this.logger.error('Text search failed:', error);
      throw new Error(`레시피 검색 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 검색 결과 포맷팅
   */
  private formatSearchResults(hits: any[]): ElasticsearchRecipe[] {
    this.logger.debug(`🔧 formatSearchResults 호출됨 - hits 개수: ${hits.length}`);
    
    if (hits.length === 0) {
      this.logger.warn(`⚠️ formatSearchResults: hits 배열이 비어있음`);
      return [];
    }
    
    return hits.map((hit, index) => {
      const source = hit._source;
      
      this.logger.debug(`🔧 Processing hit ${index + 1}: id=${hit._id}, nameKo=${source?.nameKo}, name=${source?.name}`);
      
      return {
        id: hit._id,
        // 한글 우선, 없으면 영어, 없으면 원본
        name: source?.nameKo || source?.name || source?.nameEn || '',
        nameKo: source?.nameKo || '',
        nameEn: source?.nameEn || source?.name || '',
        description: source?.descriptionKo || source?.description || source?.descriptionEn || '',
        descriptionKo: source?.descriptionKo || '',
        descriptionEn: source?.descriptionEn || source?.description || '',
        // 재료는 한글 배열 우선
        ingredients: source?.ingredientsKo && source.ingredientsKo.length > 0 
          ? source.ingredientsKo 
          : source?.ingredients || [],
        ingredientsKo: source?.ingredientsKo || [],
        ingredientsEn: source?.ingredientsEn || source?.ingredients || [],
        // 조리법은 한글 배열 우선
        steps: source?.stepsKo && source.stepsKo.length > 0 
          ? source.stepsKo 
          : source?.steps || [],
        stepsKo: source?.stepsKo || [],
        stepsEn: source?.stepsEn || source?.steps || [],
        difficulty: this.getDifficultyInKorean(source?.difficulty) || '보통',
        // 태그는 한글 배열 우선  
        tags: source?.tagsKo && source.tagsKo.length > 0 
          ? source.tagsKo 
          : source?.tags || [],
        tagsKo: source?.tagsKo || [],
        tagsEn: source?.tagsEn || source?.tags || [],
        minutes: source?.minutes || 0,
        nSteps: source?.nSteps || 0,
        nIngredients: source?.nIngredients || 0,
        // 기타 필드들
        servings: source?.servings,
        source: source?.source,
        viewCount: source?.viewCount,
        likeCount: source?.likeCount,
        bookmarkCount: source?.bookmarkCount,
        averageRating: source?.averageRating,
        ratingCount: source?.ratingCount,
        isBookmarked: source?.isBookmarked,
        userRating: source?.userRating,
        personalNote: source?.personalNote,
        personalTags: source?.personalTags,
        cookCount: source?.cookCount,
        lastCookedAt: source?.lastCookedAt ? new Date(source.lastCookedAt) : undefined,
        allergenInfo: source?.allergenInfo,
        allergyRisk: source?.allergyRisk,
        allergies: source?.allergies,
        isSafeForAllergies: source?.isSafeForAllergies,
        safetyScore: source?.safetyScore,
        createdAt: source?.createdAt,
        updatedAt: source?.updatedAt,
        isAiGenerated: source?.isAiGenerated,
        generationTimestamp: source?.generationTimestamp,
      };
    });
  }

  /**
   * 인기 검색어 조회
   */
  async getPopularQueries(limit: number = 10): Promise<string[]> {
    try {
      // 실제 구현에서는 검색 로그를 분석하여 인기 검색어를 반환
      // 현재는 하드코딩된 예시
      return [
        '닭가슴살',
        '파스타',
        '샐러드',
        '볶음밥',
        '스테이크',
        '수프',
        '김치찌개',
        '된장찌개',
        '비빔밥',
        '떡볶이'
      ].slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get popular queries:', error);
      return [];
    }
  }

  /**
   * 검색 통계 조회
   */
  async getSearchStats(): Promise<any> {
    try {
      const response = await this.client.count({
        index: this.indexName,
      });

      return {
        totalRecipes: response.count || 0,
        indexName: this.indexName,
        searchMethod: 'text_only', // 벡터 검색 제거됨
      };
    } catch (error) {
      this.logger.error('Failed to get search stats:', error);
      return {
        totalRecipes: 0,
        indexName: this.indexName,
        searchMethod: 'text_only',
      };
    }
  }

  /**
   * 고급 레시피 검색 (텍스트 기반)
   */
  async advancedSearch(query: string, options: AdvancedSearchOptions): Promise<SearchResult> {
    // Advanced search는 기본 검색과 동일하게 처리 (벡터 검색 제거됨)
    return this.searchRecipes(query, options);
  }

  /**
   * ID로 레시피 조회
   */
  async getRecipeById(id: string): Promise<ElasticsearchRecipe | null> {
    try {
      const response = await this.client.get({
        index: this.indexName,
        id: id,
      });
      
      const source = response._source as any;
      return {
        id: response._id,
        // 한글 우선 처리
        name: source?.nameKo || source?.name || source?.nameEn || '',
        nameKo: source?.nameKo || '',
        nameEn: source?.nameEn || source?.name || '',
        description: source?.descriptionKo || source?.description || source?.descriptionEn || '',
        descriptionKo: source?.descriptionKo || '',
        descriptionEn: source?.descriptionEn || source?.description || '',
        ingredients: source?.ingredientsKo && source.ingredientsKo.length > 0 
          ? source.ingredientsKo 
          : source?.ingredients || [],
        ingredientsKo: source?.ingredientsKo || [],
        ingredientsEn: source?.ingredientsEn || source?.ingredients || [],
        steps: source?.stepsKo && source.stepsKo.length > 0 
          ? source.stepsKo 
          : source?.steps || [],
        stepsKo: source?.stepsKo || [],
        stepsEn: source?.stepsEn || source?.steps || [],
        difficulty: this.getDifficultyInKorean(source?.difficulty) || '보통',
        tags: source?.tagsKo && source.tagsKo.length > 0 
          ? source.tagsKo 
          : source?.tags || [],
        tagsKo: source?.tagsKo || [],
        tagsEn: source?.tagsEn || source?.tags || [],
        // 나머지 필드들
        ...source,
      };
    } catch (error) {
      this.logger.warn(`Recipe not found: ${id}`);
      return null;
    }
  }

  /**
   * 다중 ID로 레시피 조회
   */
  async getRecipesByIds(ids: string[]): Promise<ElasticsearchRecipe[]> {
    try {
      const response = await this.client.mget({
        index: this.indexName,
        body: {
          ids: ids
        }
      });

      return response.docs
        .filter((doc: any) => doc.found)
        .map((doc: any) => {
          const source = doc._source as any;
          return {
            id: doc._id,
            // 한글 우선 처리
            name: source?.nameKo || source?.name || source?.nameEn || '',
            nameKo: source?.nameKo || '',
            nameEn: source?.nameEn || source?.name || '',
            description: source?.descriptionKo || source?.description || source?.descriptionEn || '',
            descriptionKo: source?.descriptionKo || '',
            descriptionEn: source?.descriptionEn || source?.description || '',
            ingredients: source?.ingredientsKo && source.ingredientsKo.length > 0 
              ? source.ingredientsKo 
              : source?.ingredients || [],
            ingredientsKo: source?.ingredientsKo || [],
            ingredientsEn: source?.ingredientsEn || source?.ingredients || [],
            steps: source?.stepsKo && source.stepsKo.length > 0 
              ? source.stepsKo 
              : source?.steps || [],
            stepsKo: source?.stepsKo || [],
            stepsEn: source?.stepsEn || source?.steps || [],
            difficulty: this.getDifficultyInKorean(source?.difficulty) || '보통',
            tags: source?.tagsKo && source.tagsKo.length > 0 
              ? source.tagsKo 
              : source?.tags || [],
            tagsKo: source?.tagsKo || [],
            tagsEn: source?.tagsEn || source?.tags || [],
            // 나머지 필드들
            ...source,
          };
        });
    } catch (error) {
      this.logger.error(`Failed to get recipes by IDs: ${error}`);
      return [];
    }
  }

  /**
   * 유사한 레시피 검색 (텍스트 기반)
   */
  async getSimilarRecipes(
    recipeId: string, 
    limit: number = 5, 
    options: SearchOptions = {}
  ): Promise<ElasticsearchRecipe[]> {
    try {
      // 원본 레시피 조회
      const originalRecipe = await this.getRecipeById(recipeId);
      if (!originalRecipe) {
        return [];
      }

      // 레시피 이름으로 유사한 레시피 검색
      const searchQuery = originalRecipe.nameKo || originalRecipe.name || '';
      const result = await this.searchRecipes(searchQuery, { ...options, limit });
      
      // 원본 레시피 제외
      return result.recipes.filter(recipe => recipe.id !== recipeId);
    } catch (error) {
      this.logger.error(`Failed to get similar recipes: ${error}`);
      return [];
    }
  }

  /**
   * 추천 레시피 조회 (텍스트 기반)
   */
  async getRecommendedRecipes(
    userId: string,
    userPreferences: string[],
    userAllergies: string[],
    limit: number = 10
  ): Promise<ElasticsearchRecipe[]> {
    try {
      // 사용자 선호도 기반 검색
      const preferenceQuery = userPreferences.join(' ');
      const result = await this.searchRecipes(preferenceQuery, {
        limit,
        allergies: userAllergies
      });
      
      return result.recipes;
    } catch (error) {
      this.logger.error(`Failed to get recommended recipes: ${error}`);
      return [];
    }
  }

  /**
   * 검색 제안어 조회
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          suggest: {
            recipe_suggest: {
              prefix: query,
              completion: {
                field: 'nameKo.suggest',
                size: limit
              }
            }
          }
        }
      });

      const suggestions = response.suggest?.recipe_suggest?.[0]?.options;
      if (Array.isArray(suggestions)) {
        return suggestions.map((option: any) => option.text);
      }
      return [];
    } catch (error) {
      this.logger.error(`Failed to get search suggestions: ${error}`);
      return [];
    }
  }

  /**
   * 카테고리별 인기 레시피 조회
   */
  async getPopularRecipesByCategory(category: string, limit: number = 10): Promise<ElasticsearchRecipe[]> {
    try {
      const result = await this.searchRecipes(category, { limit });
      return result.recipes;
    } catch (error) {
      this.logger.error(`Failed to get popular recipes by category: ${error}`);
      return [];
    }
  }

  /**
   * 최신 레시피 조회
   */
  async getRecentRecipes(limit: number = 10): Promise<ElasticsearchRecipe[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          sort: [
            { createdAt: { order: 'desc' } }
          ],
          size: limit
        }
      });

      return this.formatSearchResults(response.hits.hits);
    } catch (error) {
      this.logger.error(`Failed to get recent recipes: ${error}`);
      return [];
    }
  }

  /**
   * 평점 높은 레시피 조회
   */
  async getTopRatedRecipes(limit: number = 10): Promise<ElasticsearchRecipe[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          sort: [
            { averageRating: { order: 'desc' } }
          ],
          size: limit
        }
      });

      return this.formatSearchResults(response.hits.hits);
    } catch (error) {
      this.logger.error(`Failed to get top rated recipes: ${error}`);
      return [];
    }
  }

  /**
   * 쿼리에서 핵심 재료 키워드 추출
   */
  private extractIngredientKeywords(query: string): string[] {
    const ingredientMap: { [key: string]: string } = {
      '닭가슴살': '닭가슴살',
      '닭고기': '닭고기', 
      '돼지고기': '돼지고기',
      '소고기': '소고기',
      '감자': '감자',
      '양파': '양파',
      '마늘': '마늘',
      '당근': '당근',
      '브로콜리': '브로콜리',
      '시금치': '시금치',
      '버섯': '버섯',
      '두부': '두부',
      '계란': '계란',
      '새우': '새우',
      '연어': '연어',
      '참치': '참치'
    };

    const extractedIngredients: string[] = [];
    for (const [korean, ingredient] of Object.entries(ingredientMap)) {
      if (query.includes(korean)) {
        extractedIngredients.push(ingredient);
      }
    }

    return extractedIngredients;
  }

  /**
   * 한국어 재료를 영어로 번역
   */
  private translateToEnglish(koreanIngredient: string): string {
    const translationMap: { [key: string]: string } = {
      '닭가슴살': 'chicken breast',
      '닭고기': 'chicken',
      '돼지고기': 'pork',
      '소고기': 'beef',
      '감자': 'potato',
      '양파': 'onion',
      '마늘': 'garlic',
      '당근': 'carrot',
      '브로콜리': 'broccoli',
      '시금치': 'spinach',
      '버섯': 'mushroom',
      '두부': 'tofu',
      '계란': 'egg',
      '새우': 'shrimp',
      '연어': 'salmon',
      '참치': 'tuna'
    };

    return translationMap[koreanIngredient] || koreanIngredient;
  }

  /**
   * 난이도를 한국어로 변환
   */
  private getDifficultyInKorean(difficulty: string): string {
    if (!difficulty) return '보통';
    
    const difficultyLower = difficulty.toLowerCase();
    
    // 이미 한국어인 경우 그대로 반환
    if (difficultyLower.includes('쉬움') || difficultyLower.includes('초급') || difficultyLower.includes('간단')) {
      return '쉬움';
    }
    if (difficultyLower.includes('어려움') || difficultyLower.includes('고급') || difficultyLower.includes('복잡')) {
      return '어려움';
    }
    if (difficultyLower.includes('보통') || difficultyLower.includes('중급')) {
      return '보통';
    }
    
    // 영어를 한국어로 변환
    if (difficultyLower.includes('easy') || difficultyLower.includes('beginner')) {
      return '쉬움';
    }
    if (difficultyLower.includes('hard') || difficultyLower.includes('difficult') || difficultyLower.includes('advanced')) {
      return '어려움';
    }
    if (difficultyLower.includes('medium') || difficultyLower.includes('intermediate')) {
      return '보통';
    }
    
    return '보통'; // 기본값
  }
}