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

    // 텍스트 검색
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: [
            'name^3',
            'name_ko^3',
            'description^2',
            'description_ko^2',
            'ingredients^1.5',
            'tags',
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
          name: {},
          name_ko: {},
          description: {},
          description_ko: {},
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

    // 기본 텍스트 검색
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: [
            'name^3',
            'name_ko^3',
            'description^2',
            'description_ko^2',
            'ingredients^1.5',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // 포함할 재료
    if (options.ingredients?.length) {
      must.push({
        bool: {
          should: options.ingredients.map(ingredient => ({
            multi_match: {
              query: ingredient,
              fields: ['ingredients'],
              type: 'phrase',
            },
          })),
          minimum_should_match: 1,
        },
      });
    }

    // 제외할 재료
    if (options.excludeIngredients?.length) {
      options.excludeIngredients.forEach(ingredient => {
        mustNot.push({
          multi_match: {
            query: ingredient,
            fields: ['ingredients'],
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
          name: {},
          name_ko: {},
          description: {},
          description_ko: {},
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

    // 인기도 기반
    should.push({
      function_score: {
        field_value_factor: {
          field: 'averageRating',
          factor: 0.1,
          modifier: 'log1p',
          missing: 0,
        },
      },
    });

    should.push({
      function_score: {
        field_value_factor: {
          field: 'viewCount',
          factor: 0.01,
          modifier: 'log1p',
          missing: 0,
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
    return {
      index: 'recipes',
      suggest: {
        recipe_suggest: {
          prefix: query,
          completion: {
            field: 'suggest',
            size: limit,
          },
        },
        name_suggest: {
          text: query,
          term: {
            field: 'name_ko',
            size: limit,
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
        { averageRating: { order: 'desc' } },
        { viewCount: { order: 'desc' } },
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
      sort: [{ created_at: { order: 'desc' } }],
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
            { range: { ratingCount: { gte: 5 } } },
          ],
        },
      },
      size: limit,
      sort: [
        { averageRating: { order: 'desc' } },
        { ratingCount: { order: 'desc' } },
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

    // 최소 평점
    if (options.minRating) {
      filter.push({
        range: { averageRating: { gte: options.minRating } },
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
      { averageRating: { order: 'desc' } },
    ];
  }

  private buildAdvancedSortOptions(options: AdvancedSearchOptions): any[] {
    const sortOptions: any[] = [];

    switch (options.sortBy) {
      case 'rating':
        sortOptions.push({ averageRating: { order: options.sortOrder || 'desc' } });
        break;
      case 'time':
        sortOptions.push({ minutes: { order: options.sortOrder || 'asc' } });
        break;
      case 'popularity':
        sortOptions.push({ viewCount: { order: options.sortOrder || 'desc' } });
        break;
      default:
        sortOptions.push({ _score: { order: 'desc' } });
    }

    // 기본 정렬 추가
    if (options.sortBy !== 'rating') {
      sortOptions.push({ averageRating: { order: 'desc' } });
    }

    return sortOptions;
  }
}