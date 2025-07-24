import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KoreanRAGService } from './korean-rag.service';
import { RecipeTranslationService } from './recipe-translation.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';

@ApiTags('Recipe Display')
@Controller('api/recipes')
export class RecipeDisplayController {
  constructor(
    private readonly koreanRAGService: KoreanRAGService,
    private readonly recipeTranslationService: RecipeTranslationService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  @Post('search-with-display')
  @ApiOperation({ 
    summary: '한국어 레시피 검색 + 표시',
    description: 'AI 응답과 번역된 레시피들을 함께 반환합니다.'
  })
  async searchWithDisplay(@Body() body: { query: string; limit?: number }) {
    const { query, limit = 3 } = body;

    try {
      // 1. 벡터 검색으로 관련 레시피 찾기
      const searchResults = await this.koreanRAGService['vectorSearch'](query, limit);
      
      // 2. AI 응답 생성
      const aiResponse = await this.koreanRAGService.generateKoreanResponse(query);
      
      // 3. 레시피들 번역
      const recipes = searchResults.map((result: any) => result.recipe);
      const translatedRecipes = await this.recipeTranslationService.translateMultipleRecipes(recipes);
      
      return {
        query,
        aiResponse,
        recipesFound: translatedRecipes.length,
        recipes: translatedRecipes.map((recipe, index) => ({
          ...recipe,
          matchScore: searchResults[index].score,
          rank: index + 1
        })),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        query,
        error: error instanceof Error ? error.message : String(error),
        aiResponse: "죄송합니다. 레시피 검색 중 오류가 발생했습니다.",
        recipes: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('view/:id')
  @ApiOperation({ 
    summary: '단일 레시피 상세 보기',
    description: '특정 레시피를 한국어로 번역하여 상세 정보를 제공합니다.'
  })
  async getRecipeDetail(@Param('id') recipeId: string): Promise<any> {
    try {
      // Elasticsearch에서 레시피 조회
      const result = await (this.elasticsearchService as any).get({
        index: 'recipes',
        id: recipeId
      });

      if (!result.found) {
        return {
          success: false,
          message: '레시피를 찾을 수 없습니다.',
          recipeId
        };
      }

      // 레시피 번역
      const translatedRecipe = await this.recipeTranslationService.translateRecipe(result._source);

      return {
        success: true,
        recipe: translatedRecipe,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        message: '레시피 조회 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : String(error),
        recipeId
      };
    }
  }

  @Post('smart-recommendation')
  @ApiOperation({ 
    summary: '스마트 레시피 추천',
    description: 'AI 분석 + 번역된 레시피 + 추천 이유를 제공합니다.'
  })
  async getSmartRecommendation(@Body() body: { 
    query: string; 
    preferences?: string[]; 
    allergies?: string[];
    difficulty?: string;
  }) {
    const { query, preferences = [], allergies = [], difficulty } = body;

    try {
      // 1. 기본 검색
      const searchResults = await this.koreanRAGService['vectorSearch'](query, 5);
      
      // 2. 필터링 (알레르기, 난이도 등)
      const filteredResults = searchResults.filter((result: any) => {
        const recipe = result.recipe;
        
        // 난이도 필터
        if (difficulty && recipe.difficulty !== difficulty) {
          return false;
        }
        
        // 알레르기 필터 (간단 버전)
        if (allergies.length > 0) {
          const ingredientsText = recipe.ingredients_json?.toLowerCase() || '';
          const hasAllergen = allergies.some(allergen => 
            ingredientsText.includes(allergen.toLowerCase())
          );
          if (hasAllergen) return false;
        }
        
        return true;
      });

      // 3. 상위 3개 레시피 번역
      const topRecipes = filteredResults.slice(0, 3);
      const recipes = topRecipes.map((result: any) => result.recipe);
      const translatedRecipes = await this.recipeTranslationService.translateMultipleRecipes(recipes);

      // 4. AI 추천 이유 생성
      const recommendationPrompt = this.buildRecommendationPrompt(query, translatedRecipes, preferences);
      const aiRecommendation = await this.generateAIRecommendation(recommendationPrompt);

      return {
        query,
        preferences,
        allergies,
        difficulty,
        aiRecommendation,
        recommendedRecipes: translatedRecipes.map((recipe, index) => ({
          ...recipe,
          matchScore: topRecipes[index].score,
          rank: index + 1,
          whyRecommended: this.generateWhyRecommended(recipe, query, preferences)
        })),
        totalFound: filteredResults.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        query,
        error: error instanceof Error ? error.message : String(error),
        aiRecommendation: "추천 생성 중 오류가 발생했습니다.",
        recommendedRecipes: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  private buildRecommendationPrompt(query: string, recipes: any[], preferences: string[]): string {
    const recipesList = recipes.map((recipe, index) => 
      `${index + 1}. ${recipe.koreanName}\n   재료: ${recipe.ingredients.korean.slice(0, 5).join(', ')}\n   조리시간: ${recipe.cookingTime}분`
    ).join('\n');

    return `사용자가 "${query}"를 검색했고, 다음 선호사항이 있습니다: ${preferences.join(', ')}

추천 레시피들:
${recipesList}

위 레시피들을 왜 추천하는지 한국어로 친근하게 설명해주세요. 각 레시피의 장점과 사용자 질문과의 연관성을 포함해주세요.

답변:`;
  }

  private async generateAIRecommendation(prompt: string): Promise<string> {
    // KoreanRAGService의 generateAIResponse 메소드 재사용
    // 실제로는 private 메소드이므로 public으로 만들거나 별도 메소드 생성 필요
    return "AI 추천 이유를 생성하는 중입니다...";
  }

  private generateWhyRecommended(recipe: any, query: string, preferences: string[]): string {
    const reasons = [];
    
    // 조리 시간 기반
    if (recipe.cookingTime <= 30) {
      reasons.push("빠른 조리 시간");
    }
    
    // 난이도 기반
    if (recipe.difficulty === '초급') {
      reasons.push("초보자도 쉽게 만들 수 있음");
    }
    
    // 재료 수 기반
    if (recipe.ingredients.korean.length <= 5) {
      reasons.push("간단한 재료");
    }
    
    return reasons.length > 0 ? reasons.join(', ') : "사용자 질문과 높은 관련성";
  }
}