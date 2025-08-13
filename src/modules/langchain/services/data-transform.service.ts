import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchRecipe } from '../../elasticsearch/elasticsearch.service';
import { TransformedRecipe, RecipeStep, NutritionInfo } from '../types/langchain.types';

@Injectable()
export class DataTransformService {
  private readonly logger = new Logger(DataTransformService.name);

  constructor() {
    this.logger.log('🔄 Data Transform Service initialized');
  }

  /**
   * Elasticsearch 레시피 배열을 프론트엔드 형식으로 변환
   */
  transformElasticsearchRecipes(elasticsearchRecipes: ElasticsearchRecipe[]): TransformedRecipe[] {
    this.logger.log(`🔄 Transforming ${elasticsearchRecipes.length} recipes`);
    return elasticsearchRecipes.map(recipe => this.transformElasticsearchRecipe(recipe));
  }

  /**
   * 단일 Elasticsearch 레시피를 프론트엔드 형식으로 변환
   */
  transformElasticsearchRecipe(elasticsearchRecipe: ElasticsearchRecipe): TransformedRecipe {
    const steps = this.transformRecipeSteps(
      elasticsearchRecipe.stepsKo || elasticsearchRecipe.stepsEn || []
    );

    const nutrition = this.transformNutritionInfo(elasticsearchRecipe.nutrition);

    return {
      id: elasticsearchRecipe.id,
      title: elasticsearchRecipe.nameKo || elasticsearchRecipe.nameEn || '레시피 이름 없음',
      description: elasticsearchRecipe.descriptionKo || elasticsearchRecipe.descriptionEn || '',
      ingredients: elasticsearchRecipe.ingredientsKo || elasticsearchRecipe.ingredientsEn || [],
      steps: steps,
      cookingTime: elasticsearchRecipe.cookingTime || 30,
      servings: elasticsearchRecipe.servings || 2,
      difficulty: this.mapDifficulty(elasticsearchRecipe.difficulty),
      tags: elasticsearchRecipe.tags || [],
      category: elasticsearchRecipe.category || '일반',
      nutrition: nutrition,
      author: 'Recipe Database',
      rating: this.calculateRating(elasticsearchRecipe),
      reviews: 0, // TODO: 실제 리뷰 수가 있다면 매핑
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Intent를 Conversation Type으로 매핑
   */
  mapIntentToConversationType(intent: string): string {
    const mapping: Record<string, string> = {
      'recipe_list': 'recipe_list',
      'recipe_detail': 'recipe_detail',
      'cooking_help': 'cooking_help',
      'general_chat': 'general_chat'
    };

    return mapping[intent] || 'general_chat';
  }

  /**
   * 스트리밍 메타데이터 구성
   */
  buildStreamingMetadata(params: {
    intent: string;
    confidence: number;
    processingTime: number;
    searchResults: number;
    recipes?: ElasticsearchRecipe[];
    recipeDetail?: ElasticsearchRecipe | null;
  }) {
    return {
      intent: params.intent,
      conversationType: this.mapIntentToConversationType(params.intent),
      confidence: params.confidence,
      processingTime: params.processingTime,
      searchResults: params.searchResults,
      recipes: params.recipes ? this.transformElasticsearchRecipes(params.recipes) : [],
      recipeData: params.recipes ? this.transformElasticsearchRecipes(params.recipes) : [],
      recipeDetail: params.recipeDetail ? this.transformElasticsearchRecipe(params.recipeDetail) : null,
    };
  }

  /**
   * 조리 단계 변환
   */
  private transformRecipeSteps(steps: string[]): RecipeStep[] {
    return steps.map((step, index) => ({
      step: index + 1,
      instruction: step,
      time: null, // TODO: 시간 정보가 있다면 파싱
      tip: null   // TODO: 팁 정보가 있다면 파싱
    }));
  }

  /**
   * 영양 정보 변환
   */
  private transformNutritionInfo(nutrition?: any): NutritionInfo {
    if (!nutrition) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      };
    }

    return {
      calories: this.parseNumber(nutrition.calories),
      protein: this.parseNumber(nutrition.protein),
      carbs: this.parseNumber(nutrition.carbs),
      fat: this.parseNumber(nutrition.fat)
    };
  }

  /**
   * 난이도 매핑
   */
  private mapDifficulty(difficulty?: string): 'easy' | 'medium' | 'hard' {
    if (!difficulty) return 'medium';
    
    const lower = difficulty.toLowerCase();
    
    if (lower.includes('쉬') || lower.includes('easy') || lower.includes('초급') || lower.includes('beginner')) {
      return 'easy';
    }
    
    if (lower.includes('어려') || lower.includes('hard') || lower.includes('고급') || lower.includes('advanced')) {
      return 'hard';
    }
    
    return 'medium';
  }

  /**
   * 레이팅 계산 (추후 실제 데이터 기반으로 개선)
   */
  private calculateRating(recipe: ElasticsearchRecipe): number {
    // 기본 레이팅 알고리즘 (임시)
    let rating = 4.0; // 기본값
    
    // 재료 개수에 따른 보정
    const ingredientCount = (recipe.ingredientsKo || recipe.ingredientsEn || []).length;
    if (ingredientCount > 10) rating += 0.3;
    if (ingredientCount < 3) rating -= 0.2;
    
    // 조리 시간에 따른 보정
    const cookingTime = recipe.cookingTime || 30;
    if (cookingTime <= 15) rating += 0.2; // 빠른 요리
    if (cookingTime >= 120) rating -= 0.1; // 오래 걸리는 요리
    
    // 영양 정보가 있으면 보정
    if (recipe.nutrition) rating += 0.3;
    
    // 태그가 많으면 보정
    if ((recipe.tags || []).length > 3) rating += 0.2;
    
    // 5점 만점으로 제한
    return Math.min(Math.max(rating, 1.0), 5.0);
  }

  /**
   * 숫자 파싱 유틸리티
   */
  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * 레시피 검색 결과 요약 통계 생성
   */
  generateSearchStatistics(recipes: ElasticsearchRecipe[]): {
    totalCount: number;
    averageCookingTime: number;
    difficultyDistribution: Record<string, number>;
    popularIngredients: string[];
  } {
    if (recipes.length === 0) {
      return {
        totalCount: 0,
        averageCookingTime: 0,
        difficultyDistribution: {},
        popularIngredients: []
      };
    }

    // 평균 조리 시간
    const totalTime = recipes.reduce((sum, recipe) => sum + (recipe.cookingTime || 0), 0);
    const averageCookingTime = Math.round(totalTime / recipes.length);

    // 난이도 분포
    const difficultyDistribution: Record<string, number> = {};
    recipes.forEach(recipe => {
      const difficulty = this.mapDifficulty(recipe.difficulty);
      difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1;
    });

    // 인기 재료 (상위 5개)
    const ingredientCount: Record<string, number> = {};
    recipes.forEach(recipe => {
      const ingredients = recipe.ingredientsKo || recipe.ingredientsEn || [];
      ingredients.forEach(ingredient => {
        const normalized = ingredient.toLowerCase().trim();
        ingredientCount[normalized] = (ingredientCount[normalized] || 0) + 1;
      });
    });

    const popularIngredients = Object.entries(ingredientCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([ingredient]) => ingredient);

    return {
      totalCount: recipes.length,
      averageCookingTime,
      difficultyDistribution,
      popularIngredients
    };
  }
}