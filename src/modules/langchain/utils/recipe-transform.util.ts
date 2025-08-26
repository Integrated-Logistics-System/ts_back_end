import { ElasticsearchRecipe } from '../../elasticsearch/elasticsearch.service';
import { TransformedRecipe } from '../types/langchain.types';

/**
 * 간단한 레시피 변환 유틸리티 함수들
 */
export class RecipeTransformUtil {
  
  static transformRecipes(recipes: ElasticsearchRecipe[]): TransformedRecipe[] {
    return recipes.map(recipe => this.transformRecipe(recipe));
  }

  static transformRecipe(recipe: ElasticsearchRecipe): TransformedRecipe {
    return {
      id: recipe.id,
      title: recipe.nameKo || recipe.nameEn || '레시피 이름 없음',
      description: recipe.descriptionKo || recipe.descriptionEn || '',
      ingredients: recipe.ingredientsKo || recipe.ingredientsEn || [],
      steps: this.transformSteps(recipe.stepsKo || recipe.stepsEn || []),
      cookingTime: recipe.cookingTime || 30,
      servings: recipe.servings || 2,
      difficulty: this.mapDifficulty(recipe.difficulty),
      tags: recipe.tags || [],
      category: recipe.category || '일반',
      nutrition: {
        calories: recipe.nutrition?.calories || 0,
        protein: recipe.nutrition?.protein || 0,
        carbs: recipe.nutrition?.carbs || 0,
        fat: recipe.nutrition?.fat || 0
      },
      author: 'Recipe Database',
      rating: Math.floor(Math.random() * 5) + 1, // 간단한 더미 평점
      reviews: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private static transformSteps(steps: string[]) {
    return steps.map((stepInstruction, index) => ({
      step: index + 1,
      instruction: stepInstruction,
      time: null,
      tip: null
    }));
  }

  private static mapDifficulty(difficulty?: string): 'easy' | 'medium' | 'hard' {
    const normalizedDifficulty = difficulty?.toLowerCase();
    
    if (normalizedDifficulty === 'easy') return 'easy';
    if (normalizedDifficulty === 'hard') return 'hard';
    return 'medium'; // 기본값
  }
}