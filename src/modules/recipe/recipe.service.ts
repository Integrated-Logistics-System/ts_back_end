import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@/modules/elasticsearch/elasticsearch.service';

@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async searchRecipes(query: string, page: number = 1, limit: number = 10) {
    try {
      this.logger.log(`Searching recipes: "${query}"`);
      
      if (!this.elasticsearchService.isReady()) {
        return {
          recipes: [],
          total: 0,
          message: 'Recipe search temporarily unavailable'
        };
      }

      const result = await this.elasticsearchService.searchRecipes(query, {}, limit);
      
      this.logger.log(`Found ${result.length} recipes`);
      return {
        recipes: result,
        total: result.length
      };
    } catch (error) {
      this.logger.error(`Recipe search failed: ${error.message}`);
      return {
        recipes: [],
        total: 0,
        error: 'Search failed'
      };
    }
  }

  async getRecipeById(id: string) {
    try {
      this.logger.log(`Getting recipe by ID: ${id}`);
      
      if (!this.elasticsearchService.isReady()) {
        return null;
      }

      const recipe = await this.elasticsearchService.getRecipeById(id);
      
      if (recipe) {
        // 기본적인 레시피 정보 정리
        return this.formatRecipe(recipe);
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Recipe fetch failed: ${error.message}`);
      return null;
    }
  }

  async getPopularRecipes(limit: number = 10) {
    try {
      this.logger.log(`Getting popular recipes (limit: ${limit})`);
      
      if (!this.elasticsearchService.isReady()) {
        return {
          recipes: [],
          message: 'Popular recipes temporarily unavailable'
        };
      }

      const result = await this.elasticsearchService.getPopularRecipes(limit);
      
      if (result.recipes) {
        result.recipes = result.recipes.map(recipe => this.formatRecipe(recipe));
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Popular recipes fetch failed: ${error.message}`);
      return {
        recipes: [],
        error: 'Failed to fetch popular recipes'
      };
    }
  }

  async getRecipeStats() {
    try {
      if (!this.elasticsearchService.isReady()) {
        return {
          totalRecipes: 0,
          message: 'Recipe stats temporarily unavailable'
        };
      }

      return await this.elasticsearchService.getRecipeStats();
    } catch (error) {
      this.logger.error(`Recipe stats failed: ${error.message}`);
      return {
        totalRecipes: 0,
        error: 'Failed to get stats'
      };
    }
  }

  private formatRecipe(recipe: any): any {
    if (!recipe) return null;

    return {
      id: recipe.id,
      name: recipe.name,
      name_ko: recipe.name_ko,
      description: recipe.description,
      ingredients: this.formatIngredients(recipe.ingredients),
      steps: this.formatSteps(recipe.steps),
      minutes: recipe.minutes || 30,
      tags: recipe.tags || [],
      difficulty: this.calculateDifficulty(recipe),
      servings: this.estimateServings(recipe),
    };
  }

  private formatIngredients(ingredients: any): string[] {
    if (!ingredients) return [];
    
    if (Array.isArray(ingredients)) {
      return ingredients.slice(0, 20); // 최대 20개 재료
    }
    
    if (typeof ingredients === 'string') {
      return ingredients.split(',').map(item => item.trim()).slice(0, 20);
    }
    
    return [];
  }

  private formatSteps(steps: any): string[] {
    if (!steps) return ['조리 방법 정보가 없습니다.'];
    
    if (Array.isArray(steps)) {
      return steps.filter(step => step && step.trim().length > 5);
    }
    
    if (typeof steps === 'string') {
      return steps
        .split(/\d+\.|\n|;/)
        .map(step => step.trim())
        .filter(step => step.length > 10)
        .slice(0, 15); // 최대 15단계
    }
    
    return ['조리 방법 정보가 없습니다.'];
  }

  private calculateDifficulty(recipe: any): string {
    const minutes = recipe.minutes || 30;
    const stepCount = Array.isArray(recipe.steps) ? recipe.steps.length : 5;
    const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 5;
    
    // 간단한 난이도 계산
    const complexity = (minutes / 30) + (stepCount / 10) + (ingredientCount / 10);
    
    if (complexity < 1.5) return '쉬움';
    if (complexity < 2.5) return '보통';
    return '어려움';
  }

  private estimateServings(recipe: any): number {
    // 재료 수를 기반으로 인분 추정
    const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 5;
    
    if (ingredientCount < 5) return 1;
    if (ingredientCount < 10) return 2;
    if (ingredientCount < 15) return 4;
    return 6;
  }

  // 간단한 레시피 추천 로직
  async getRecommendedRecipes(preferences: string[] = [], allergies: string[] = []): Promise<any> {
    try {
      if (!this.elasticsearchService.isReady()) {
        return {
          recipes: [],
          message: 'Recipe recommendations temporarily unavailable'
        };
      }

      // 선호도가 있으면 검색, 없으면 인기 레시피
      if (preferences.length > 0) {
        const query = preferences.join(' ');
        return await this.searchRecipes(query, 1, 5);
      } else {
        return await this.getPopularRecipes(5);
      }
    } catch (error) {
      this.logger.error(`Recipe recommendations failed: ${error.message}`);
      return {
        recipes: [],
        error: 'Failed to get recommendations'
      };
    }
  }

  // 카테고리별 레시피 조회
  async getRecipesByCategory(category: string, limit: number = 10): Promise<any> {
    try {
      const categoryMap: { [key: string]: string } = {
        '한식': 'korean',
        '중식': 'chinese',
        '일식': 'japanese',
        '양식': 'western',
        '디저트': 'dessert',
        '간식': 'snack',
        '국물': 'soup',
        '볶음': 'stir-fry',
        '찜': 'steamed',
      };

      const searchTerm = categoryMap[category] || category;
      return await this.searchRecipes(searchTerm, 1, limit);
    } catch (error) {
      this.logger.error(`Category recipes fetch failed: ${error.message}`);
      return {
        recipes: [],
        error: 'Failed to fetch category recipes'
      };
    }
  }
}
