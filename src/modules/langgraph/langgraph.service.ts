import { Injectable, Logger } from '@nestjs/common';
import { RecipeService } from '../recipe/recipe.service';
import { IngredientService } from '../ingredient/ingredient.service';
import { UserService } from '../user/user.service';
import { OllamaService } from '../../shared/ollama/ollama.service';
import { RagResponse } from '../rag/rag.service';

export interface WorkflowState {
  userId: string;
  query: string;
  step: string;
  extractedIngredients?: string[];
  userAllergies?: string[];
  foundRecipes?: any[];
  safeRecipes?: any[];
  safetyInfo?: any;
  answer?: string;
  error?: string;
}

@Injectable()
export class LangGraphService {
  private readonly logger = new Logger(LangGraphService.name);

  constructor(
    private readonly recipeService: RecipeService,
    private readonly ingredientService: IngredientService,
    private readonly userService: UserService,
    private readonly ollamaService: OllamaService,
  ) {}

  async executeRecipeWorkflow(initialState: WorkflowState): Promise<RagResponse> {
    let state = { ...initialState };

    try {
      // 워크플로우 단계별 실행
      state = await this.extractIngredientsNode(state);
      state = await this.getUserAllergyNode(state);
      state = await this.checkSafetyNode(state);
      state = await this.searchRecipesNode(state);
      state = await this.filterSafeRecipesNode(state);
      state = await this.generateResponseNode(state);

      return this.buildFinalResponse(state);

    } catch (error) {
      this.logger.error('LangGraph 워크플로우 실행 실패:', error);
      throw error;
    }
  }

  private async extractIngredientsNode(state: WorkflowState): Promise<WorkflowState> {
    this.logger.log('단계 1: 재료 추출');
    
    try {
      const extractedIngredients = await this.ollamaService.extractIngredients(state.query);
      
      return {
        ...state,
        step: 'ingredients_extracted',
        extractedIngredients
      };
    } catch (error) {
      this.logger.error('재료 추출 실패:', error);
      return {
        ...state,
        step: 'error',
        error: '재료 추출 중 오류가 발생했습니다.'
      };
    }
  }

  private async getUserAllergyNode(state: WorkflowState): Promise<WorkflowState> {
    this.logger.log('단계 2: 사용자 알레르기 정보 조회');
    
    try {
      let userAllergies = [];
      
      if (state.userId) {
        const user = await this.userService.findByUserId(state.userId);
        userAllergies = user.allergies || [];
      }

      return {
        ...state,
        step: 'user_allergies_loaded',
        userAllergies
      };
    } catch (error) {
      this.logger.warn('사용자 알레르기 정보 조회 실패, 기본값 사용');
      return {
        ...state,
        step: 'user_allergies_loaded',
        userAllergies: []
      };
    }
  }

  private async checkSafetyNode(state: WorkflowState): Promise<WorkflowState> {
    this.logger.log('단계 3: 재료 안전성 검사');
    
    try {
      if (!state.extractedIngredients || state.extractedIngredients.length === 0) {
        return {
          ...state,
          step: 'safety_checked'
        };
      }

      const safetyInfo = await this.ingredientService.checkAllergies(
        state.extractedIngredients,
        state.userAllergies || []
      );

      return {
        ...state,
        step: 'safety_checked',
        safetyInfo
      };
    } catch (error) {
      this.logger.error('안전성 검사 실패:', error);
      return {
        ...state,
        step: 'safety_checked'
      };
    }
  }

  private async searchRecipesNode(state: WorkflowState): Promise<WorkflowState> {
    this.logger.log('단계 4: 레시피 검색');
    
    try {
      let foundRecipes = [];

      if (state.extractedIngredients && state.extractedIngredients.length > 0) {
        // 재료 기반 검색
        foundRecipes = await this.recipeService.findByIngredients({
          ingredients: state.extractedIngredients,
          limit: 20
        });
      } else {
        // 텍스트 기반 검색
        const searchResult = await this.recipeService.search({
          query: state.query,
          limit: 20
        });
        foundRecipes = searchResult.recipes;
      }

      return {
        ...state,
        step: 'recipes_found',
        foundRecipes
      };
    } catch (error) {
      this.logger.error('레시피 검색 실패:', error);
      return {
        ...state,
        step: 'recipes_found',
        foundRecipes: []
      };
    }
  }

  private async filterSafeRecipesNode(state: WorkflowState): Promise<WorkflowState> {
    this.logger.log('단계 5: 안전한 레시피 필터링');
    
    try {
      if (!state.userAllergies || state.userAllergies.length === 0) {
        return {
          ...state,
          step: 'recipes_filtered',
          safeRecipes: state.foundRecipes || []
        };
      }

      const safeRecipes = [];
      
      for (const recipe of state.foundRecipes || []) {
        if (recipe.ingredients) {
          const safetyCheck = await this.ingredientService.checkAllergies(
            recipe.ingredients,
            state.userAllergies
          );
          
          if (safetyCheck.safetyScore >= 80) { // 80% 이상 안전한 레시피만
            safeRecipes.push({
              ...recipe,
              safetyScore: safetyCheck.safetyScore
            });
          }
        }
      }

      return {
        ...state,
        step: 'recipes_filtered',
        safeRecipes: safeRecipes.sort((a, b) => b.safetyScore - a.safetyScore)
      };
    } catch (error) {
      this.logger.error('레시피 필터링 실패:', error);
      return {
        ...state,
        step: 'recipes_filtered',
        safeRecipes: state.foundRecipes || []
      };
    }
  }

  private async generateResponseNode(state: WorkflowState): Promise<WorkflowState> {
    this.logger.log('단계 6: AI 응답 생성');
    
    try {
      const answer = await this.ollamaService.generateRecipeResponse(
        state.query,
        state.safeRecipes || [],
        state.userAllergies || []
      );

      return {
        ...state,
        step: 'response_generated',
        answer
      };
    } catch (error) {
      this.logger.error('응답 생성 실패:', error);
      return {
        ...state,
        step: 'response_generated',
        answer: '레시피 정보를 바탕으로 요리를 추천드립니다.'
      };
    }
  }

  private buildFinalResponse(state: WorkflowState): RagResponse {
    return {
      answer: state.answer || '요청을 처리할 수 없습니다.',
      recipes: (state.safeRecipes || []).slice(0, 5),
      safetyInfo: state.safetyInfo || {
        safeIngredients: state.extractedIngredients || [],
        unsafeIngredients: [],
        safetyScore: 100
      },
      extractedIngredients: state.extractedIngredients || [],
      suggestions: [
        '다른 재료로 검색해보기',
        '인기 레시피 확인하기',
        '간단한 요리 추천받기',
        '건강한 레시피 찾기'
      ]
    };
  }
}