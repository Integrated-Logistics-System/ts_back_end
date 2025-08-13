import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService, ElasticsearchRecipe } from '../../elasticsearch/elasticsearch.service';
import { ConversationContext, RecipeSearchResult, RecipeDetailResult } from '../types/langchain.types';

@Injectable()
export class RecipeSearchService {
  private readonly logger = new Logger(RecipeSearchService.name);

  constructor(private readonly elasticsearchService: ElasticsearchService) {
    this.logger.log('🔍 Recipe Search Service initialized');
  }

  /**
   * 레시피 검색 및 LLM 처리
   */
  async searchAndProcessRecipes(
    message: string,
    context?: ConversationContext,
    limit: number = 10
  ): Promise<RecipeSearchResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🔍 Searching recipes for: "${message.substring(0, 30)}..."`);
      
      // 1. 키워드 추출
      const keywords = this.extractSearchKeywords(message);
      this.logger.log(`🎯 Extracted keywords: ${keywords.join(', ')}`);
      
      // 2. Elasticsearch 검색
      const searchResults = await this.elasticsearchService.searchRecipes(
        keywords.join(' '),
        limit
      );

      // 3. 알레르기 필터링
      let filteredRecipes = searchResults;
      if (context?.allergies && context.allergies.length > 0) {
        filteredRecipes = this.filterRecipesByAllergies(searchResults, context.allergies);
        this.logger.log(`🚫 Filtered by allergies: ${searchResults.length} → ${filteredRecipes.length}`);
      }

      const processingTime = Date.now() - startTime;
      
      return {
        content: this.generateSearchSummary(filteredRecipes, message),
        metadata: {
          intent: 'recipe_list',
          confidence: 0.9,
          processingTime,
          searchResults: filteredRecipes.length
        },
        recipes: filteredRecipes
      };

    } catch (error) {
      this.logger.error('❌ Recipe search failed:', error);
      
      return {
        content: '죄송합니다. 레시피 검색 중 오류가 발생했습니다.',
        metadata: {
          intent: 'recipe_list',
          confidence: 0.5,
          processingTime: Date.now() - startTime,
          searchResults: 0
        },
        recipes: []
      };
    }
  }

  /**
   * 특정 레시피 상세 정보 조회 (LLM 처리 포함)
   */
  async getRecipeDetailWithLLM(
    recipeId: string,
    context?: ConversationContext
  ): Promise<RecipeDetailResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`📖 Getting recipe detail for ID: ${recipeId}`);
      
      // Elasticsearch에서 특정 레시피 조회
      const recipe = await this.elasticsearchService.getRecipeById(recipeId);
      
      if (!recipe) {
        return {
          content: '요청하신 레시피를 찾을 수 없습니다.',
          metadata: {
            intent: 'recipe_detail',
            confidence: 0.5,
            processingTime: Date.now() - startTime
          },
          recipe: null
        };
      }

      // 레시피 정보를 마크다운 형식으로 포맷
      const formattedContent = this.formatRecipeToMarkdown(recipe);

      return {
        content: formattedContent,
        metadata: {
          intent: 'recipe_detail',
          confidence: 0.95,
          processingTime: Date.now() - startTime
        },
        recipe
      };

    } catch (error) {
      this.logger.error('❌ Recipe detail retrieval failed:', error);
      
      return {
        content: '레시피 상세 정보를 가져오는 중 오류가 발생했습니다.',
        metadata: {
          intent: 'recipe_detail',
          confidence: 0.5,
          processingTime: Date.now() - startTime
        },
        recipe: null
      };
    }
  }

  /**
   * 메시지에서 검색 키워드 추출
   */
  private extractSearchKeywords(message: string): string[] {
    // 불용어 제거
    const stopWords = ['레시피', '요리', '만들기', '어떻게', '알려주세요', '해주세요', '추천', '좀', '그냥', '있나요'];
    
    // 기본 키워드 추출 (공백 기준 분리)
    const words = message
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)
      .filter(word => !stopWords.includes(word.toLowerCase()));

    // 음식 관련 키워드 우선순위
    const foodKeywords = words.filter(word => 
      /^(닭|돼지|소|생선|야채|김치|파스타|밥|국|찌개|볶음|구이|튀김|샐러드|디저트)/.test(word)
    );

    return foodKeywords.length > 0 ? foodKeywords : words.slice(0, 3);
  }

  /**
   * 검색 결과 요약 생성
   */
  private generateSearchSummary(recipes: ElasticsearchRecipe[], originalMessage: string): string {
    if (recipes.length === 0) {
      return `"${originalMessage}"와 관련된 레시피를 찾지 못했습니다. 다른 검색어로 시도해보세요.`;
    }

    const topRecipes = recipes.slice(0, 3).map(recipe => 
      recipe.nameKo || recipe.nameEn || '레시피'
    );

    return `"${originalMessage}" 관련 레시피 ${recipes.length}개를 찾았습니다! 추천 레시피: ${topRecipes.join(', ')} 등이 있습니다.`;
  }

  /**
   * 레시피를 마크다운 형식으로 포맷
   */
  private formatRecipeToMarkdown(recipe: ElasticsearchRecipe): string {
    const title = recipe.nameKo || recipe.nameEn || '레시피';
    const description = recipe.descriptionKo || recipe.descriptionEn || '';
    const cookingTime = recipe.cookingTime || 30;
    const servings = recipe.servings || 2;
    const difficulty = this.mapDifficultyToKorean(recipe.difficulty);
    const category = recipe.category || '일반';
    const ingredients = recipe.ingredientsKo || recipe.ingredientsEn || [];
    const steps = recipe.stepsKo || recipe.stepsEn || [];
    const tags = recipe.tags || [];

    let formatted = `# 🍳 ${title}\n\n`;
    
    if (description) {
      formatted += `**설명**: ${description}\n\n`;
    }
    
    formatted += `**⏱️ 조리시간**: ${cookingTime}분\n`;
    formatted += `**🍽️ 분량**: ${servings}인분\n`;
    formatted += `**📊 난이도**: ${difficulty}\n`;
    formatted += `**🏷️ 카테고리**: ${category}\n\n`;
    
    if (tags.length > 0) {
      formatted += `**🏷️ 태그**: ${tags.join(', ')}\n\n`;
    }
    
    if (ingredients.length > 0) {
      formatted += `## 🥘 재료\n\n`;
      ingredients.forEach((ingredient, idx) => {
        formatted += `${idx + 1}. ${ingredient}\n`;
      });
      formatted += '\n';
    }
    
    if (steps.length > 0) {
      formatted += `## 👨‍🍳 조리법\n\n`;
      steps.forEach((step, idx) => {
        formatted += `${idx + 1}. ${step}\n`;
      });
      formatted += '\n';
    }
    
    if (recipe.nutrition) {
      formatted += `## 🍎 영양정보\n\n`;
      if (recipe.nutrition.calories) formatted += `- 칼로리: ${recipe.nutrition.calories}kcal\n`;
      if (recipe.nutrition.protein) formatted += `- 단백질: ${recipe.nutrition.protein}g\n`;
      if (recipe.nutrition.carbs) formatted += `- 탄수화물: ${recipe.nutrition.carbs}g\n`;
      if (recipe.nutrition.fat) formatted += `- 지방: ${recipe.nutrition.fat}g\n`;
    }
    
    return formatted;
  }

  /**
   * 난이도를 한국어로 매핑
   */
  private mapDifficultyToKorean(difficulty?: string): string {
    if (!difficulty) return '보통';
    const lower = difficulty.toLowerCase();
    if (lower.includes('easy') || lower.includes('쉬')) return '쉬움';
    if (lower.includes('hard') || lower.includes('어려')) return '어려움';
    return '보통';
  }

  /**
   * 알레르기를 바탕으로 레시피 필터링
   */
  private filterRecipesByAllergies(
    recipes: ElasticsearchRecipe[], 
    allergies: string[]
  ): ElasticsearchRecipe[] {
    return recipes.filter(recipe => {
      const ingredients = [...(recipe.ingredientsKo || []), ...(recipe.ingredientsEn || [])];
      const title = `${recipe.nameKo || ''} ${recipe.nameEn || ''}`;
      const description = `${recipe.descriptionKo || ''} ${recipe.descriptionEn || ''}`;
      const allText = `${ingredients.join(' ')} ${title} ${description}`.toLowerCase();
      
      return !allergies.some(allergy => 
        allText.includes(allergy.toLowerCase()) ||
        allergy.toLowerCase().includes(allText)
      );
    });
  }
}