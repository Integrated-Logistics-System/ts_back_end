import { Injectable, Logger } from '@nestjs/common';
import { RecipeService } from '../recipe/recipe.service';
import { IngredientService } from '../ingredient/ingredient.service';
import { UserService } from '../user/user.service';
import { OllamaService } from '../../shared/ollama/ollama.service';
import { LangGraphService } from '../langgraph/langgraph.service';

export interface RagResponse {
  answer: string;
  recipes: any[];
  safetyInfo: {
    safeIngredients: string[];
    unsafeIngredients: Array<{ name: string; allergens: string[] }>;
    safetyScore: number;
  };
  extractedIngredients: string[];
  suggestions: string[];
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly recipeService: RecipeService,
    private readonly ingredientService: IngredientService,
    private readonly userService: UserService,
    private readonly ollamaService: OllamaService,
    private readonly langGraphService: LangGraphService,
  ) {}

  async processQuery(userId: string, query: string): Promise<RagResponse> {
    try {
      this.logger.log(`사용자 ${userId}의 질의 처리 시작: ${query}`);

      // LangGraph 워크플로우 실행
      const workflowResult = await this.langGraphService.executeRecipeWorkflow({
        userId,
        query,
        step: 'start'
      });

      return workflowResult;

    } catch (error) {
      this.logger.error('RAG 질의 처리 실패:', error);
      
      // 폴백 응답
      return {
        answer: '죄송합니다. 일시적인 문제가 발생했습니다. 다시 시도해주세요.',
        recipes: [],
        safetyInfo: {
          safeIngredients: [],
          unsafeIngredients: [],
          safetyScore: 0
        },
        extractedIngredients: [],
        suggestions: [
          '간단한 파스타 레시피',
          '30분 요리',
          '닭고기 요리법',
          '건강한 샐러드'
        ]
      };
    }
  }

  async simpleRecipeSearch(query: string, userId?: string): Promise<RagResponse> {
    try {
      // 1. 재료 추출
      const extractedIngredients = await this.ollamaService.extractIngredients(query);
      
      // 2. 사용자 알레르기 정보 조회
      let userAllergies = [];
      if (userId) {
        try {
          const user = await this.userService.findByUserId(userId);
          userAllergies = user.allergies || [];
        } catch (error) {
          this.logger.warn(`사용자 ${userId} 정보 조회 실패`);
        }
      }

      // 3. 알레르기 안전성 체크
      const safetyInfo = await this.ingredientService.checkAllergies(
        extractedIngredients,
        userAllergies
      );

      // 4. 레시피 검색
      let recipes = [];
      if (extractedIngredients.length > 0) {
        recipes = await this.recipeService.findByIngredients({
          ingredients: extractedIngredients,
          excludeAllergens: userAllergies,
          limit: 10
        });
      } else {
        const searchResult = await this.recipeService.search({
          query,
          excludeAllergens: userAllergies,
          limit: 10
        });
        recipes = searchResult.recipes;
      }

      // 5. AI 응답 생성
      const answer = await this.ollamaService.generateRecipeResponse(
        query,
        recipes,
        userAllergies
      );

      // 6. 사용자 최근 재료 업데이트
      if (userId && extractedIngredients.length > 0) {
        try {
          await this.userService.updateRecentIngredients(userId, extractedIngredients);
        } catch (error) {
          this.logger.warn('최근 재료 업데이트 실패');
        }
      }

      return {
        answer,
        recipes: recipes.slice(0, 5),
        safetyInfo,
        extractedIngredients,
        suggestions: this.generateSuggestions(extractedIngredients, recipes.length)
      };

    } catch (error) {
      this.logger.error('간단 레시피 검색 실패:', error);
      throw error;
    }
  }

  private generateSuggestions(ingredients: string[], foundRecipes: number): string[] {
    const baseSuggestions = [
      '30분 안에 만들 수 있는 요리',
      '간단한 한식 레시피',
      '건강한 다이어트 요리',
      '초보자도 쉬운 요리'
    ];

    if (ingredients.length > 0) {
      return [
        `${ingredients[0]}을 활용한 다른 요리`,
        `${ingredients.join(', ')}로 만드는 간단 요리`,
        ...baseSuggestions.slice(0, 2)
      ];
    }

    if (foundRecipes === 0) {
      return [
        '다른 재료로 요리 찾기',
        '인기 레시피 보기',
        ...baseSuggestions.slice(0, 2)
      ];
    }

    return baseSuggestions;
  }
}