import { Injectable } from '@nestjs/common';
import { ElasticsearchRecipe } from '@/modules/elasticsearch/elasticsearch.service';

@Injectable()
export class RecipeUtils {

  /**
   * 알레르기 정보를 고려하여 안전한 레시피들만 필터링
   */
  async filterSafeRecipes(recipes: ElasticsearchRecipe[], allergies: string[]): Promise<ElasticsearchRecipe[]> {
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

  /**
   * 특정 레시피가 알레르기에 안전한지 확인
   */
  async checkRecipeSafety(recipe: ElasticsearchRecipe, allergies: string[]): Promise<boolean> {
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
   * 레시피 유효성 검증
   */
  isValidRecipe(recipe: unknown): recipe is ElasticsearchRecipe {
    if (!recipe || typeof recipe !== 'object') return false;

    const r = recipe as Record<string, unknown>;

    // 필수 필드 확인
    const requiredFields = ['name', 'nameKo', 'description', 'ingredients', 'steps'];
    const hasRequiredFields = requiredFields.every(field => field in r);

    if (!hasRequiredFields) return false;

    // 배열 필드 확인
    const arrayFields = ['ingredients', 'steps'];
    const hasArrayFields = arrayFields.every(field => Array.isArray(r[field]));

    if (!hasArrayFields) return false;

    // 기본 타입 확인
    const typeChecks = [
      typeof r.name === 'string',
      typeof r.nameKo === 'string',
      typeof r.description === 'string',
      typeof r.minutes === 'number' || r.minutes === undefined,
      typeof r.difficulty === 'string' || r.difficulty === undefined,
      typeof r.servings === 'number' || r.servings === undefined,
    ];

    return typeChecks.every(check => check);
  }

  /**
   * 레시피 정규화 (표준 형식으로 변환)
   */
  normalizeRecipe(recipe: Partial<ElasticsearchRecipe>): ElasticsearchRecipe {
    const now = new Date().toISOString();
    const id = recipe.id || `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      name: recipe.name || 'Unknown Recipe',
      nameKo: recipe.nameKo || recipe.name || '알 수 없는 레시피',
      nameEn: recipe.nameEn || recipe.name || 'Unknown Recipe',
      description: recipe.description || '레시피 설명이 없습니다.',
      descriptionKo: recipe.descriptionKo || recipe.description || '레시피 설명이 없습니다.',
      descriptionEn: recipe.descriptionEn || recipe.description || 'No description available.',
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
      ingredientsKo: Array.isArray(recipe.ingredientsKo) ? recipe.ingredientsKo : recipe.ingredients || [],
      ingredientsEn: Array.isArray(recipe.ingredientsEn) ? recipe.ingredientsEn : recipe.ingredients || [],
      steps: Array.isArray(recipe.steps) ? recipe.steps : [],
      stepsKo: Array.isArray(recipe.stepsKo) ? recipe.stepsKo : recipe.steps || [],
      stepsEn: Array.isArray(recipe.stepsEn) ? recipe.stepsEn : recipe.steps || [],
      minutes: recipe.minutes || 30,
      difficulty: recipe.difficulty || '보통',
      servings: recipe.servings || 2,
      nIngredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0,
      nSteps: Array.isArray(recipe.steps) ? recipe.steps.length : 0,
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      tagsKo: Array.isArray(recipe.tagsKo) ? recipe.tagsKo : recipe.tags || [],
      tagsEn: Array.isArray(recipe.tagsEn) ? recipe.tagsEn : recipe.tags || [],
      isAiGenerated: recipe.isAiGenerated || false,
      source: recipe.source || 'Unknown',
      generationTimestamp: recipe.generationTimestamp || now,
      safetyScore: recipe.safetyScore || 100,
      isSafeForAllergies: recipe.isSafeForAllergies || true,
      allergenInfo: recipe.allergenInfo,
      allergyRisk: recipe.allergyRisk || 'low',
    };
  }

  /**
   * 레시피 유사도 계산 (간단한 버전)
   */
  calculateSimilarity(recipe1: ElasticsearchRecipe, recipe2: ElasticsearchRecipe): number {
    let similarity = 0;
    let factors = 0;

    // 재료 유사도
    if (recipe1.ingredients && recipe2.ingredients) {
      const commonIngredients = recipe1.ingredients.filter(ing => 
        recipe2.ingredients?.some(ing2 => 
          ing.toLowerCase().includes(ing2.toLowerCase()) || 
          ing2.toLowerCase().includes(ing.toLowerCase())
        )
      );
      similarity += (commonIngredients.length / Math.max(recipe1.ingredients.length, recipe2.ingredients.length)) * 0.4;
      factors += 0.4;
    }

    // 조리 시간 유사도
    if (recipe1.minutes && recipe2.minutes) {
      const timeDiff = Math.abs(recipe1.minutes - recipe2.minutes);
      const timeSimilarity = Math.max(0, 1 - timeDiff / 120); // 2시간 차이를 최대로 봄
      similarity += timeSimilarity * 0.2;
      factors += 0.2;
    }

    // 난이도 유사도
    if (recipe1.difficulty && recipe2.difficulty) {
      const difficultyMatch = recipe1.difficulty === recipe2.difficulty ? 1 : 0;
      similarity += difficultyMatch * 0.2;
      factors += 0.2;
    }

    // 태그 유사도
    if (recipe1.tags && recipe2.tags) {
      const commonTags = recipe1.tags.filter(tag => recipe2.tags?.includes(tag));
      const tagSimilarity = commonTags.length / Math.max(recipe1.tags.length, recipe2.tags.length);
      similarity += tagSimilarity * 0.2;
      factors += 0.2;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * 레시피 검색 점수 계산
   */
  calculateSearchScore(recipe: ElasticsearchRecipe, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // 이름 매칭
    if (recipe.nameKo?.toLowerCase().includes(queryLower)) score += 0.4;
    if (recipe.name?.toLowerCase().includes(queryLower)) score += 0.3;

    // 설명 매칭
    if (recipe.description?.toLowerCase().includes(queryLower)) score += 0.1;

    // 재료 매칭
    if (recipe.ingredients?.some(ing => ing.toLowerCase().includes(queryLower))) score += 0.2;

    // 태그 매칭
    if (recipe.tags?.some(tag => tag.toLowerCase().includes(queryLower))) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * 레시피 복합성 계산 (재료 수 + 단계 수 기반)
   */
  calculateComplexity(recipe: ElasticsearchRecipe): 'simple' | 'medium' | 'complex' {
    const ingredientCount = recipe.ingredients?.length || 0;
    const stepCount = recipe.steps?.length || 0;
    const totalComplexity = ingredientCount + stepCount * 2; // 단계가 더 중요

    if (totalComplexity <= 8) return 'simple';
    if (totalComplexity <= 16) return 'medium';
    return 'complex';
  }

  /**
   * 레시피 요약 정보 생성
   */
  generateSummary(recipe: ElasticsearchRecipe): string {
    const ingredients = recipe.ingredients?.slice(0, 3) || [];
    const complexity = this.calculateComplexity(recipe);
    const complexityText = {
      simple: '간단',
      medium: '보통',
      complex: '복잡'
    }[complexity];

    return `${recipe.nameKo} - ${recipe.minutes}분, ${complexityText}, 재료: ${ingredients.join(', ')}${ingredients.length < (recipe.ingredients?.length || 0) ? ' 등' : ''}`;
  }

  /**
   * 레시피 영양 정보 추정 (기본적인 추정만)
   */
  estimateNutrition(recipe: ElasticsearchRecipe): Record<string, any> {
    // 실제 영양 계산은 복잡하므로 기본적인 추정만 구현
    const baseCalories = 200; // 기본 칼로리
    const ingredientCount = recipe.ingredients?.length || 0;
    const estimatedCalories = baseCalories + (ingredientCount * 50);

    return {
      estimatedCalories,
      ingredientCount,
      stepCount: recipe.steps?.length || 0,
      complexity: this.calculateComplexity(recipe),
      cookingTime: recipe.minutes || 30,
      servings: recipe.servings || 2,
      caloriesPerServing: Math.round(estimatedCalories / (recipe.servings || 2)),
    };
  }

  /**
   * 레시피 데이터 정리 (빈 값 제거, 중복 제거 등)
   */
  sanitizeRecipe(recipe: ElasticsearchRecipe): ElasticsearchRecipe {
    const sanitized = { ...recipe };

    // 빈 배열 정리
    if (sanitized.ingredients) {
      sanitized.ingredients = sanitized.ingredients.filter(ing => ing.trim().length > 0);
    }
    if (sanitized.steps) {
      sanitized.steps = sanitized.steps.filter(step => step.trim().length > 0);
    }
    if (sanitized.tags) {
      sanitized.tags = [...new Set(sanitized.tags.filter(tag => tag.trim().length > 0))];
    }

    // 문자열 정리
    if (sanitized.description) {
      sanitized.description = sanitized.description.trim();
    }
    if (sanitized.nameKo) {
      sanitized.nameKo = sanitized.nameKo.trim();
    }

    return sanitized;
  }
}