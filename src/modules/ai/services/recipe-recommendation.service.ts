import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from './ollama.service';

export interface RecipeRecommendationState {
  ingredients: string[];
  userPreferences?: {
    dietaryRestrictions?: string[];
    cuisineTypes?: string[];
    cookingSkill?: string;
    maxCookingTime?: number;
  };
  parsedIngredients: string[];
  searchResults: any[];
  filteredResults: any[];
  rankedRecommendations: any[];
  explanation: string;
  currentStep: string;
}

export interface RecommendationRequest {
  ingredients: string[];
  userPreferences?: {
    dietaryRestrictions?: string[];
    cuisineTypes?: string[];
    cookingSkill?: string;
    maxCookingTime?: number;
  };
  maxResults?: number;
}

@Injectable()
export class RecipeRecommendationService {
  private readonly logger = new Logger(RecipeRecommendationService.name);

  constructor(private ollamaService: OllamaService) {}

  async recommendRecipes(request: RecommendationRequest): Promise<{
    recommendations: any[];
    explanation: string;
    processingSteps: string[];
  }> {
    const state: RecipeRecommendationState = {
      ingredients: request.ingredients,
      userPreferences: request.userPreferences,
      parsedIngredients: [],
      searchResults: [],
      filteredResults: [],
      rankedRecommendations: [],
      explanation: '',
      currentStep: 'parsing_ingredients',
    };

    const processingSteps: string[] = [];

    try {
      // Step 1: Parse and normalize ingredients
      processingSteps.push('재료 분석 및 정규화');
      state.parsedIngredients = await this.parseIngredients(state);

      // Step 2: Generate recipe suggestions based on ingredients
      processingSteps.push('재료 기반 레시피 검색');
      state.searchResults = await this.generateRecipeSuggestions(state);

      // Step 3: Apply user preference filters
      processingSteps.push('사용자 선호도 필터링');
      state.filteredResults = await this.applyPreferenceFilters(state);

      // Step 4: Rank recommendations
      processingSteps.push('레시피 순위 결정');
      state.rankedRecommendations = await this.rankRecommendations(state);

      // Step 5: Generate explanation
      processingSteps.push('추천 설명 생성');
      state.explanation = await this.generateExplanation(state);

      return {
        recommendations: state.rankedRecommendations.slice(
          0,
          request.maxResults || 5,
        ),
        explanation: state.explanation,
        processingSteps,
      };
    } catch (error) {
      this.logger.error('Error in recipe recommendation:', error.message);
      throw new Error(`Recipe recommendation failed: ${error.message}`);
    }
  }

  private async parseIngredients(
    state: RecipeRecommendationState,
  ): Promise<string[]> {
    const prompt = `
다음 재료 목록을 분석하고 정규화해주세요. 각 재료의 표준명을 제공하고, 유사한 재료들을 그룹화해주세요.

재료 목록: ${state.ingredients.join(', ')}

요구사항:
1. 각 재료의 표준 영문명과 한글명을 제공
2. 유사한 재료들은 대표 재료로 통합
3. 요리에 적합한 형태로 정리
4. JSON 형식으로 응답: {"ingredients": ["ingredient1", "ingredient2", ...]}

응답은 JSON 형식만 제공하세요.
`;

    try {
      const response = await this.ollamaService.generate(prompt, {
        temperature: 0.3,
      });
      const parsedResponse = JSON.parse(response);
      return parsedResponse.ingredients || state.ingredients;
    } catch (_error) {
      return state.ingredients;
    }
  }

  private async generateRecipeSuggestions(
    state: RecipeRecommendationState,
  ): Promise<any[]> {
    const prompt = `
다음 재료들을 사용해서 만들 수 있는 맛있는 레시피들을 추천해주세요.

사용 가능한 재료: ${state.parsedIngredients.join(', ')}

요구사항:
1. 주어진 재료들을 최대한 활용하는 레시피
2. 각 레시피에 대해 다음 정보 포함:
   - 레시피명 (한글, 영문)
   - 필요한 추가 재료 (있다면)
   - 예상 조리시간 (분)
   - 난이도 (easy/medium/hard)
   - 간단한 조리법 요약
   - 영양정보 추정치
3. 5-8개의 다양한 레시피 제안
4. JSON 형식으로 응답

JSON 형식:
{
  "recipes": [
    {
      "name": "레시피명",
      "nameEn": "Recipe Name",
      "additionalIngredients": ["ingredient1", "ingredient2"],
      "cookingTime": 30,
      "difficulty": "easy",
      "summary": "간단한 조리법 설명",
      "estimatedNutrition": {
        "calories": 350,
        "protein": 25,
        "carbs": 40,
        "fat": 10
      },
      "suitability": 0.9
    }
  ]
}
`;

    try {
      const response = await this.ollamaService.generate(prompt, {
        temperature: 0.7,
        maxTokens: 2000,
      });

      const parsedResponse = JSON.parse(response);
      return parsedResponse.recipes || [];
    } catch (error) {
      this.logger.error(
        'Failed to generate recipe suggestions:',
        error.message,
      );
      return [];
    }
  }

  private async applyPreferenceFilters(
    state: RecipeRecommendationState,
  ): Promise<any[]> {
    if (!state.userPreferences || state.searchResults.length === 0) {
      return state.searchResults;
    }

    const preferences = state.userPreferences;
    const filteredRecipes = state.searchResults.filter((recipe) => {
      // Filter by cooking time
      if (
        preferences.maxCookingTime &&
        recipe.cookingTime > preferences.maxCookingTime
      ) {
        return false;
      }

      // Filter by dietary restrictions
      if (
        preferences.dietaryRestrictions &&
        preferences.dietaryRestrictions.length > 0
      ) {
        // This would need more sophisticated logic in a real implementation
        return true;
      }

      // Filter by cooking skill
      if (preferences.cookingSkill) {
        const skillLevels = { easy: 1, medium: 2, hard: 3 };
        const userSkill = skillLevels[preferences.cookingSkill] || 2;
        const recipeSkill = skillLevels[recipe.difficulty] || 2;

        if (recipeSkill > userSkill) {
          return false;
        }
      }

      return true;
    });

    return filteredRecipes;
  }

  private async rankRecommendations(
    state: RecipeRecommendationState,
  ): Promise<any[]> {
    if (state.filteredResults.length === 0) {
      return [];
    }

    const prompt = `
다음 레시피들을 사용자의 재료와 선호도를 고려하여 순위를 매겨주세요.

사용자 재료: ${state.parsedIngredients.join(', ')}
사용자 선호도: ${JSON.stringify(state.userPreferences)}

레시피 목록:
${state.filteredResults
  .map(
    (recipe, index) =>
      `${index + 1}. ${recipe.name} - 조리시간: ${recipe.cookingTime}분, 난이도: ${recipe.difficulty}`,
  )
  .join('\n')}

순위 기준:
1. 사용자 재료 활용도
2. 조리 시간 적합성
3. 난이도 적합성
4. 영양 균형
5. 맛과 인기도

응답 형식: JSON 배열로 순위대로 정렬된 레시피 인덱스
{"rankedIndices": [2, 0, 4, 1, 3]}
`;

    try {
      const response = await this.ollamaService.generate(prompt, {
        temperature: 0.5,
      });
      const parsedResponse = JSON.parse(response);
      const rankedIndices =
        parsedResponse.rankedIndices ||
        state.filteredResults.map((_, index) => index);

      return rankedIndices.map((index) => ({
        ...state.filteredResults[index],
        rank: rankedIndices.indexOf(index) + 1,
      }));
    } catch (_error) {
      return state.filteredResults.map((recipe, index) => ({
        ...recipe,
        rank: index + 1,
      }));
    }
  }

  private async generateExplanation(
    state: RecipeRecommendationState,
  ): Promise<string> {
    const topRecipes = state.rankedRecommendations.slice(0, 3);

    const prompt = `
사용자에게 다음 레시피들을 추천하는 이유를 친근하고 자세하게 설명해주세요.

사용자 재료: ${state.parsedIngredients.join(', ')}
추천 레시피:
${topRecipes
  .map((recipe, index) => `${index + 1}. ${recipe.name} - ${recipe.summary}`)
  .join('\n')}

설명 요구사항:
1. 왜 이 레시피들이 좋은지 설명
2. 사용자 재료를 어떻게 활용하는지 언급
3. 각 레시피의 특별한 장점 강조
4. 요리 초보자도 이해하기 쉽게 설명
5. 친근한 톤으로 작성

200-300자 정도의 자연스러운 한국어로 작성해주세요.
`;

    try {
      const explanation = await this.ollamaService.generate(prompt, {
        temperature: 0.8,
        maxTokens: 500,
      });
      return explanation.trim();
    } catch (_error) {
      return `${state.parsedIngredients.join(', ')}로 만들 수 있는 ${topRecipes.length}가지 맛있는 레시피를 추천드립니다. 각 레시피는 현재 가지고 계신 재료들을 최대한 활용하면서도 맛과 영양을 모두 고려하여 선별했습니다.`;
    }
  }
}
