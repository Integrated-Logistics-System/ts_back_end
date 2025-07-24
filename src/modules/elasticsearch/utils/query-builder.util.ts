import { Injectable } from '@nestjs/common';
import {
  ElasticsearchRecipe,
  SearchOptions,
  AdvancedSearchOptions,
} from '../types/elasticsearch.types';

@Injectable()
export class QueryBuilder {
  /**
   * 기본 검색 쿼리 생성
   */
  buildBasicSearchQuery(query: string, options: SearchOptions): object {
    const must: any[] = [];
    const filter: any[] = [];

    // 텍스트 검색 - 한글 필드 우선
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: [
            'nameKo^4',      // 한글 요리명 (최우선)
            'name^2',        // 영어 요리명
            'descriptionKo^3', // 한글 설명
            'description^1.5',  // 영어 설명
            'ingredientsKo^2.5', // 한글 재료
            'ingredients^1.2',   // 영어 재료
            'tagsKo^2',      // 한글 태그
            'tags^1',        // 영어 태그
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // 필터 적용
    this.applyFilters(filter, options);

    const searchQuery: any = {
      index: 'recipes',
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      size: options.limit || 10,
      from: ((options.page || 1) - 1) * (options.limit || 10),
      sort: this.buildSortOptions(options),
      highlight: {
        fields: {
          nameKo: {},
          name: {},
          descriptionKo: {},
          description: {},
          ingredientsKo: {},
          ingredients: {},
        },
      },
    };

    return searchQuery;
  }

  /**
   * 고급 검색 쿼리 생성
   */
  buildAdvancedSearchQuery(query: string, options: AdvancedSearchOptions): object {
    const must: any[] = [];
    const filter: any[] = [];
    const mustNot: any[] = [];

    // 기본 텍스트 검색 - 한글 필드 우선
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: [
            'nameKo^4',      // 한글 요리명 (최우선)
            'name^2',        // 영어 요리명
            'descriptionKo^3', // 한글 설명
            'description^1.5',  // 영어 설명
            'ingredientsKo^2.5', // 한글 재료
            'ingredients^1.2',   // 영어 재료
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // 포함할 재료 - 한글 재료 우선
    if (options.ingredients?.length) {
      must.push({
        bool: {
          should: options.ingredients.map(ingredient => ({
            multi_match: {
              query: ingredient,
              fields: ['ingredientsKo^2', 'ingredients'],
              type: 'phrase',
            },
          })),
          minimum_should_match: 1,
        },
      });
    }

    // 제외할 재료 - 한글/영어 모두 체크
    if (options.excludeIngredients?.length) {
      options.excludeIngredients.forEach(ingredient => {
        mustNot.push({
          multi_match: {
            query: ingredient,
            fields: ['ingredientsKo', 'ingredients'],
            type: 'phrase',
          },
        });
      });
    }

    // 서빙 사이즈
    if (options.servings) {
      filter.push({
        range: {
          servings: {
            gte: Math.max(1, options.servings - 2),
            lte: options.servings + 2,
          },
        },
      });
    }

    // 칼로리 범위
    if (options.calories?.min || options.calories?.max) {
      const calorieRange: any = {};
      if (options.calories.min) calorieRange.gte = options.calories.min;
      if (options.calories.max) calorieRange.lte = options.calories.max;
      
      filter.push({
        range: { calories: calorieRange },
      });
    }

    // 기본 필터 적용
    this.applyFilters(filter, options);

    const searchQuery: any = {
      index: 'recipes',
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
          must_not: mustNot,
        },
      },
      size: options.limit || 10,
      from: ((options.page || 1) - 1) * (options.limit || 10),
      sort: this.buildAdvancedSortOptions(options),
      highlight: {
        fields: {
          nameKo: {},
          name: {},
          descriptionKo: {},
          description: {},
          ingredientsKo: {},
          ingredients: {},
        },
      },
      aggs: {
        difficulty_distribution: {
          terms: { field: 'difficulty' },
        },
        average_time: {
          avg: { field: 'minutes' },
        },
        popular_tags: {
          terms: { field: 'tags', size: 10 },
        },
      },
    };

    return searchQuery;
  }

  /**
   * 다중 ID 조회 쿼리
   */
  buildMultiGetQuery(ids: string[]): object {
    return {
      index: 'recipes',
      query: {
        terms: { _id: ids },
      },
      size: ids.length,
    };
  }

  /**
   * 유사성 검색 쿼리
   */
  buildSimilarityQuery(
    baseRecipe: ElasticsearchRecipe,
    limit: number,
    options: SearchOptions
  ): object {
    const should: any[] = [];

    // 유사한 태그
    if (baseRecipe.tags?.length) {
      should.push({
        terms: {
          tags: baseRecipe.tags,
          boost: 2.0,
        },
      });
    }

    // 유사한 재료
    if (baseRecipe.ingredients?.length) {
      should.push({
        terms: {
          ingredients: baseRecipe.ingredients.slice(0, 5),
          boost: 1.5,
        },
      });
    }

    // 유사한 난이도
    should.push({
      term: {
        difficulty: {
          value: baseRecipe.difficulty,
          boost: 1.0,
        },
      },
    });

    // 유사한 조리 시간 (±30분)
    should.push({
      range: {
        minutes: {
          gte: Math.max(0, baseRecipe.minutes - 30),
          lte: baseRecipe.minutes + 30,
          boost: 0.5,
        },
      },
    });

    const filter: any[] = [];
    this.applyFilters(filter, options);

    return {
      index: 'recipes',
      query: {
        bool: {
          should,
          filter,
          minimum_should_match: 1,
        },
      },
      size: limit,
      sort: [{ _score: { order: 'desc' } }],
    };
  }

  /**
   * 추천 쿼리 생성
   */
  buildRecommendationQuery(
    userId: string,
    userPreferences: string[],
    userAllergies: string[],
    limit: number
  ): object {
    const should: any[] = [];
    const mustNot: any[] = [];

    // 사용자 선호도 기반
    if (userPreferences.length) {
      should.push({
        terms: {
          tags: userPreferences,
          boost: 2.0,
        },
      });
    }

    // 알레르기 제외
    if (userAllergies.length) {
      userAllergies.forEach(allergy => {
        mustNot.push({
          match: {
            'allergenInfo.contains_allergens': allergy,
          },
        });
      });
    }

    // 인기도 기반 - use available fields
    should.push({
      function_score: {
        field_value_factor: {
          field: 'safetyScore',
          factor: 0.1,
          modifier: 'log1p',
          missing: 0,
        },
      },
    });

    should.push({
      function_score: {
        field_value_factor: {
          field: 'nIngredients',
          factor: 0.01,
          modifier: 'log1p',
          missing: 1,
        },
      },
    });

    return {
      index: 'recipes',
      query: {
        bool: {
          should,
          must_not: mustNot,
          minimum_should_match: 1,
        },
      },
      size: limit,
      sort: [{ _score: { order: 'desc' } }],
    };
  }

  /**
   * 자동완성 쿼리
   */
  buildSuggestionQuery(query: string, limit: number): object {
    // Ensure limit is valid and not null
    const validLimit = Math.max(1, Math.min(limit || 5, 10));
    
    return {
      index: 'recipes',
      suggest: {
        name_suggest: {
          text: query,
          term: {
            field: 'nameKo', // Use existing field
            size: validLimit,
          },
        },
      },
    };
  }

  /**
   * 카테고리별 인기 레시피 쿼리
   */
  buildCategoryPopularQuery(category: string, limit: number): object {
    return {
      index: 'recipes',
      query: {
        bool: {
          filter: [
            {
              term: { 'tags': category },
            },
          ],
        },
      },
      size: limit,
      sort: [
        { safetyScore: { order: 'desc' } },
        { nIngredients: { order: 'desc' } },
      ],
    };
  }

  /**
   * 최근 레시피 쿼리
   */
  buildRecentRecipesQuery(limit: number): object {
    return {
      index: 'recipes',
      query: { match_all: {} },
      size: limit,
      sort: [{ createdAt: { order: 'desc' } }],
    };
  }

  /**
   * 높은 평점 레시피 쿼리
   */
  buildTopRatedQuery(limit: number): object {
    return {
      index: 'recipes',
      query: {
        bool: {
          filter: [
            { range: { safetyScore: { gte: 0.5 } } }, // Use safetyScore instead of ratingCount
          ],
        },
      },
      size: limit,
      sort: [
        { safetyScore: { order: 'desc' } },
        { nIngredients: { order: 'asc' } }, // Sort by simplicity (fewer ingredients)
      ],
    };
  }

  // ==================== Private Helper Methods ====================

  private applyFilters(filter: any[], options: SearchOptions): void {
    // 알레르기 필터
    if (options.allergies?.length) {
      options.allergies.forEach(allergy => {
        filter.push({
          bool: {
            must_not: {
              match: {
                'allergenInfo.contains_allergens': allergy,
              },
            },
          },
        });
      });
    }

    // 난이도 필터
    if (options.difficulty) {
      filter.push({
        term: { difficulty: options.difficulty },
      });
    }

    // 최대 조리 시간
    if (options.maxTime) {
      filter.push({
        range: { minutes: { lte: options.maxTime } },
      });
    }

    // 최소 평점 - use safetyScore instead
    if (options.minRating) {
      filter.push({
        range: { safetyScore: { gte: options.minRating } },
      });
    }

    // 태그 필터
    if (options.tags?.length) {
      filter.push({
        terms: { tags: options.tags },
      });
    }
  }

  private buildSortOptions(options: SearchOptions): any[] {
    return [
      { _score: { order: 'desc' } },
      { createdAt: { order: 'desc' } }, // Use createdAt instead of averageRating
    ];
  }

  private buildAdvancedSortOptions(options: AdvancedSearchOptions): any[] {
    const sortOptions: any[] = [];

    switch (options.sortBy) {
      case 'rating':
        // Use safetyScore as a proxy for rating since averageRating doesn't exist
        sortOptions.push({ safetyScore: { order: options.sortOrder || 'desc' } });
        break;
      case 'time':
        sortOptions.push({ minutes: { order: options.sortOrder || 'asc' } });
        break;
      case 'popularity':
        // Use nIngredients as a proxy for popularity since viewCount doesn't exist
        sortOptions.push({ nIngredients: { order: options.sortOrder || 'desc' } });
        break;
      default:
        sortOptions.push({ _score: { order: 'desc' } });
    }

    // 기본 정렬 추가 - use createdAt instead of averageRating
    if (options.sortBy !== 'rating') {
      sortOptions.push({ createdAt: { order: 'desc' } });
    }

    return sortOptions;
  }
}