import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@/modules/elasticsearch/elasticsearch.service';
import { ElasticsearchRecipe } from '@/modules/elasticsearch/elasticsearch.service';
import { GraphState } from '../../types/workflow.types';

@Injectable()
export class SearchNode {
  private readonly logger = new Logger(SearchNode.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async searchRecipes(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`🔍 Searching recipes for: "${state.query}"`);

    // RAG 워크플로우 비활성화 체크
    if (process.env.DISABLE_RAG_WORKFLOW === 'true') {
      this.logger.log('🚫 RAG workflow is disabled, skipping recipe search');
      return {
        searchResults: [],
        currentStep: 'search_disabled',
        metadata: {
          ...state.metadata,
          searchTime: 0,
        },
      };
    }

    const startTime = Date.now();

    try {
      // 분석된 키워드를 사용하여 검색 쿼리 구성
      const searchQuery = this.buildSearchQuery(state);
      const searchOptions = this.buildSearchOptions(state);
      
      this.logger.log(`🔍 검색 쿼리: "${searchQuery}", 옵션: ${JSON.stringify(searchOptions)}`);
      
      const searchResult = await this.elasticsearchService.searchRecipes(searchQuery, searchOptions);

      const filteredRecipes = await this.filterSafeRecipes(
        searchResult.recipes || [],
        state.userAllergies
      );

      this.logger.log(`✅ Recipe search complete: ${filteredRecipes.length} recipes found`);

      return {
        searchResults: filteredRecipes,
        currentStep: 'search_complete',
        metadata: {
          ...state.metadata,
          searchTime: Date.now() - startTime,
        },
      };
    } catch (error: unknown) {
      this.logger.error('Recipe search failed:', error);
      return {
        searchResults: [],
        currentStep: 'search_failed',
        metadata: {
          ...state.metadata,
          searchTime: Date.now() - startTime,
        },
      };
    }
  }

  private async filterSafeRecipes(recipes: ElasticsearchRecipe[], allergies: string[]): Promise<ElasticsearchRecipe[]> {
    if (allergies.length === 0) return recipes;

    const safeRecipes: ElasticsearchRecipe[] = [];

    for (const recipe of recipes) {
      const isSafe = await this.checkRecipeSafety(recipe, allergies);
      if (isSafe) {
        safeRecipes.push(recipe);
      }
    }

    return safeRecipes;
  }

  private async checkRecipeSafety(recipe: ElasticsearchRecipe, allergies: string[]): Promise<boolean> {
    const ingredients = recipe.ingredients || [];

    for (const allergy of allergies) {
      for (const ingredient of ingredients) {
        if (typeof ingredient === 'string' &&
            ingredient.toLowerCase().includes(allergy.toLowerCase())) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 분석된 상태에서 검색 쿼리 구성
   */
  private buildSearchQuery(state: GraphState): string {
    // searchKeywords가 있으면 사용, 없으면 원본 쿼리 사용
    if (state.searchKeywords && state.searchKeywords.length > 0) {
      // 키워드들을 조합하여 검색 쿼리 생성
      return state.searchKeywords.join(' ');
    }
    
    // 키워드가 없으면 원본 쿼리에서 간단한 키워드 추출
    const fallbackKeywords = this.extractFallbackKeywords(state.query);
    return fallbackKeywords.length > 0 ? fallbackKeywords.join(' ') : state.query;
  }

  /**
   * 분석된 상태에서 검색 옵션 구성
   */
  private buildSearchOptions(state: GraphState): any {
    const options: any = {
      limit: 8, // 더 많은 결과 반환
      page: 1,
      allergies: state.userAllergies || [],
      preferences: [],
    };

    // 분석된 필터 적용
    if (state.searchFilters) {
      if (state.searchFilters.difficulty) {
        options.difficulty = state.searchFilters.difficulty;
      }
      if (state.searchFilters.maxCookingTime) {
        options.maxCookingTime = state.searchFilters.maxCookingTime;
      }
      if (state.searchFilters.servings) {
        options.servings = state.searchFilters.servings;
      }
    }

    // 기본 정렬: 관련성 또는 인기도
    options.sortBy = 'relevance';

    return options;
  }

  /**
   * 키워드 분석이 실패한 경우 대체 키워드 추출
   */
  private extractFallbackKeywords(query: string): string[] {
    const keywords: string[] = [];
    const queryLower = query.toLowerCase();

    // 간단한 단어 매칭
    const simplePatterns = [
      { pattern: /저녁/, keyword: '저녁' },
      { pattern: /아침/, keyword: '아침' },
      { pattern: /점심/, keyword: '점심' },
      { pattern: /간단/, keyword: '간단' },
      { pattern: /빠른/, keyword: '간단' },
      { pattern: /쉽/, keyword: '간단' },
      { pattern: /볶음/, keyword: '볶음' },
      { pattern: /찌개/, keyword: '찌개' },
      { pattern: /국/, keyword: '국' },
      { pattern: /샐러드/, keyword: '샐러드' },
      { pattern: /닭/, keyword: '닭고기' },
      { pattern: /돼지/, keyword: '돼지고기' },
      { pattern: /소고기/, keyword: '소고기' },
      { pattern: /생선/, keyword: '생선' },
      { pattern: /두부/, keyword: '두부' }
    ];

    for (const { pattern, keyword } of simplePatterns) {
      if (pattern.test(queryLower)) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }
}