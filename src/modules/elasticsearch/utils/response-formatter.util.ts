import { Injectable } from '@nestjs/common';
import {
  ElasticsearchRecipe,
  ElasticsearchResponse,
  ElasticsearchHit,
  ElasticsearchSuggestResponse,
} from '../types/elasticsearch.types';

@Injectable()
export class ResponseFormatter {
  /**
   * 검색 결과 포맷팅
   */
  formatSearchResults(response: ElasticsearchResponse<ElasticsearchRecipe>): ElasticsearchRecipe[] {
    return response.hits.hits.map(hit => this.formatSingleHit(hit));
  }

  /**
   * 단일 검색 결과 포맷팅
   */
  formatSingleResult(hit: ElasticsearchHit<ElasticsearchRecipe>): ElasticsearchRecipe {
    return this.formatSingleHit(hit);
  }

  /**
   * 자동완성 제안 포맷팅
   */
  formatSuggestions(response: ElasticsearchSuggestResponse): string[] {
    const suggestions: string[] = [];

    // Completion suggestions
    if (response.suggest?.recipe_suggest?.[0]?.options) {
      suggestions.push(
        ...response.suggest.recipe_suggest[0].options.map(option => option.text)
      );
    }

    // Term suggestions
    if (response.suggest?.name_suggest?.[0]?.options) {
      suggestions.push(
        ...response.suggest.name_suggest[0].options.map(option => option.text)
      );
    }

    // 중복 제거 및 정렬
    return [...new Set(suggestions)].slice(0, 10);
  }

  /**
   * 집계 결과 포맷팅
   */
  formatAggregations(aggregations: Record<string, any>): Record<string, any> {
    const formatted: Record<string, any> = {};

    for (const [key, agg] of Object.entries(aggregations)) {
      if (agg.buckets) {
        // Terms aggregation
        formatted[key] = agg.buckets.map((bucket: any) => ({
          key: bucket.key,
          count: bucket.doc_count,
        }));
      } else if (agg.value !== undefined) {
        // Metric aggregation
        formatted[key] = agg.value;
      } else {
        formatted[key] = agg;
      }
    }

    return formatted;
  }

  /**
   * 통계 데이터 포맷팅
   */
  formatStats(response: ElasticsearchResponse): any {
    const stats = {
      totalRecipes: response.hits.total.value,
      averageRating: 0,
      popularTags: [],
      difficultyDistribution: {},
      averageCookingTime: 0,
    };

    if (response.aggregations) {
      const aggs = this.formatAggregations(response.aggregations);
      
      stats.averageRating = aggs.average_rating || 0;
      stats.popularTags = aggs.popular_tags || [];
      stats.difficultyDistribution = this.formatDifficultyDistribution(aggs.difficulty_distribution);
      stats.averageCookingTime = aggs.average_time || 0;
    }

    return stats;
  }

  /**
   * 건강 상태 포맷팅
   */
  formatHealthStatus(clusterHealth: any, indexStats: any): any {
    const status = clusterHealth.status === 'green' ? 'healthy' : 
                   clusterHealth.status === 'yellow' ? 'degraded' : 'unhealthy';

    return {
      status,
      details: {
        connection: true,
        indexExists: indexStats !== null,
        docCount: indexStats?.total?.docs?.count || 0,
        lastUpdate: new Date().toISOString(),
        clusterStatus: clusterHealth.status,
        numberOfNodes: clusterHealth.number_of_nodes,
        numberOfDataNodes: clusterHealth.number_of_data_nodes,
      },
    };
  }

  /**
   * 검색 하이라이트 포맷팅
   */
  formatHighlights(highlight: Record<string, string[]>): Record<string, string> {
    const formatted: Record<string, string> = {};

    for (const [field, highlights] of Object.entries(highlight)) {
      formatted[field] = highlights.join(' ... ');
    }

    return formatted;
  }

  /**
   * 에러 응답 포맷팅
   */
  formatError(error: any): any {
    return {
      success: false,
      error: {
        type: error.type || 'elasticsearch_error',
        message: error.message || 'An error occurred',
        details: error.body || error.meta || {},
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 성공 응답 포맷팅
   */
  formatSuccessResponse(data: any, metadata: any = {}): any {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * 페이지네이션 메타데이터 포맷팅
   */
  formatPaginationMeta(
    total: number,
    page: number,
    limit: number,
    searchTime?: number
  ): any {
    const totalPages = Math.ceil(total / limit);
    
    return {
      pagination: {
        current: page,
        total: totalPages,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      results: {
        total,
        count: Math.min(limit, total - (page - 1) * limit),
      },
      performance: {
        searchTime: searchTime || 0,
      },
    };
  }

  // ==================== Private Helper Methods ====================

  private formatSingleHit(hit: ElasticsearchHit<ElasticsearchRecipe>): ElasticsearchRecipe {
    const recipe = { ...hit._source };
    
    // 한글 필드를 우선적으로 사용하도록 변경
    if (recipe.nameKo && recipe.nameKo.trim()) {
      recipe.name = recipe.nameKo;
    }
    if (recipe.descriptionKo && recipe.descriptionKo.trim()) {
      recipe.description = recipe.descriptionKo;
    }
    if (recipe.ingredientsKo && Array.isArray(recipe.ingredientsKo) && recipe.ingredientsKo.length > 0) {
      recipe.ingredients = recipe.ingredientsKo;
    }
    if (recipe.stepsKo && (
      (typeof recipe.stepsKo === 'string' && (recipe.stepsKo as string).trim()) ||
      (Array.isArray(recipe.stepsKo) && recipe.stepsKo.length > 0)
    )) {
      recipe.steps = recipe.stepsKo;
    }
    if (recipe.tagsKo && Array.isArray(recipe.tagsKo) && recipe.tagsKo.length > 0) {
      recipe.tags = recipe.tagsKo;
    }

    // 알레르기 정보 한글화
    if (recipe.allergenInfo && recipe.allergenInfo.contains_allergens) {
      recipe.allergenInfo.contains_allergens = this.translateAllergensToKorean(recipe.allergenInfo.contains_allergens);
    }
    if (recipe.allergenInfo && recipe.allergenInfo.high_risk_ingredients) {
      recipe.allergenInfo.high_risk_ingredients = this.translateIngredientsToKorean(recipe.allergenInfo.high_risk_ingredients);
    }
    if (recipe.allergenInfo && recipe.allergenInfo.safe_for) {
      recipe.allergenInfo.safe_for = this.translateAllergensToKorean(recipe.allergenInfo.safe_for);
    }

    // 난이도 한글화
    if (recipe.difficulty) {
      recipe.difficulty = this.translateDifficultyToKorean(recipe.difficulty);
    }
    
    // Elasticsearch 메타데이터 추가
    if (hit._score) {
      (recipe as any)._score = hit._score;
    }

    // 하이라이트 정보 추가
    if ((hit as any).highlight) {
      (recipe as any)._highlights = this.formatHighlights((hit as any).highlight);
    }

    // 날짜 필드 처리
    if (recipe.createdAt && typeof recipe.createdAt === 'string') {
      recipe.createdAt = recipe.createdAt;
    }
    if (recipe.updatedAt && typeof recipe.updatedAt === 'string') {
      recipe.updatedAt = recipe.updatedAt;
    }

    // 기본값 설정
    recipe.viewCount = recipe.viewCount || 0;
    recipe.likeCount = recipe.likeCount || 0;
    recipe.bookmarkCount = recipe.bookmarkCount || 0;
    recipe.averageRating = recipe.safetyScore || 0; // Use safetyScore as proxy
    recipe.ratingCount = recipe.ratingCount || 0;

    // 안전성 점수 계산 (클라이언트에서 사용)
    if (recipe.allergenInfo) {
      recipe.safetyScore = this.calculateSafetyScore(recipe.allergenInfo);
      recipe.isSafeForAllergies = recipe.allergenInfo.allergen_risk_score < 20;
    }

    return recipe;
  }

  /**
   * 알레르기 정보를 한글로 번역
   */
  private translateAllergensToKorean(allergens: string[]): string[] {
    const allergenMap: Record<string, string> = {
      'milk': '우유',
      'eggs': '달걀',
      'fish': '생선',
      'crustacean shellfish': '갑각류',
      'tree nuts': '견과류',
      'peanuts': '땅콩',
      'wheat': '밀',
      'soybeans': '대두',
      'sesame': '참깨',
      'sulfites': '아황산류',
      'shellfish': '조개류',
      'gluten': '글루텐',
      'nuts': '견과류',
      'soy': '대두',
      'dairy': '유제품'
    };

    return allergens.map(allergen => 
      allergenMap[allergen.toLowerCase()] || allergen
    );
  }

  /**
   * 재료명을 한글로 번역 (기본적인 재료들)
   */
  private translateIngredientsToKorean(ingredients: string[]): string[] {
    const ingredientMap: Record<string, string> = {
      'flour': '밀가루',
      'sugar': '설탕',
      'salt': '소금',
      'pepper': '후추',
      'oil': '기름',
      'butter': '버터',
      'milk': '우유',
      'eggs': '달걀',
      'onion': '양파',
      'garlic': '마늘',
      'ginger': '생강',
      'soy sauce': '간장',
      'sesame oil': '참기름',
      'rice': '쌀',
      'noodles': '면',
      'chicken': '닭고기',
      'beef': '소고기',
      'pork': '돼지고기',
      'fish': '생선',
      'shrimp': '새우',
      'tofu': '두부',
      'kimchi': '김치',
      'cucumber': '오이',
      'carrot': '당근',
      'potato': '감자',
      'tomato': '토마토',
      'cabbage': '양배추',
      'spinach': '시금치',
      'mushroom': '버섯',
      'green onion': '대파',
      'chili': '고추',
      'bean sprouts': '콩나물'
    };

    return ingredients.map(ingredient => 
      ingredientMap[ingredient.toLowerCase()] || ingredient
    );
  }

  /**
   * 난이도를 한글로 번역
   */
  private translateDifficultyToKorean(difficulty: string): string {
    const difficultyMap: Record<string, string> = {
      'easy': '쉬움',
      'medium': '보통',
      'hard': '어려움',
      'beginner': '초급',
      'intermediate': '중급',
      'advanced': '고급',
      'simple': '간단',
      'moderate': '보통',
      'complex': '복잡'
    };

    return difficultyMap[difficulty.toLowerCase()] || difficulty;
  }

  private formatDifficultyDistribution(difficultyAgg: any[]): Record<string, number> {
    const distribution: Record<string, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    if (difficultyAgg) {
      difficultyAgg.forEach(bucket => {
        distribution[bucket.key] = bucket.count;
      });
    }

    return distribution;
  }

  private calculateSafetyScore(allergenInfo: any): number {
    // 기본 점수 100에서 위험 요소에 따라 차감
    let score = 100;
    
    score -= allergenInfo.allergen_risk_score || 0;
    score -= (allergenInfo.high_risk_ingredients?.length || 0) * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private sanitizeText(text: string): string {
    // XSS 방지를 위한 기본적인 텍스트 정리
    return text
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  private truncateText(text: string, maxLength: number = 200): string {
    if (text.length <= maxLength) return text;
    
    return text.substring(0, maxLength).trim() + '...';
  }

  private formatNumber(num: number, decimals: number = 1): number {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}