import { Injectable, Logger } from '@nestjs/common';

export interface RecipeStep {
  step: number;
  instruction: string;
  time?: number | null;
  tip?: string | null;
}

export interface RecipeNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  steps: RecipeStep[];
  cookingTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  category: string;
  imageUrl?: string | null;
  nutrition: RecipeNutrition;
  author: string;
  rating: number;
  reviews: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);
  
  // 임시 샘플 레시피 데이터
  private readonly sampleRecipes: Recipe[] = [
    {
      id: '1',
      title: '김치찌개',
      description: '한국의 대표적인 찌개 요리',
      ingredients: ['김치', '돼지고기', '두부', '대파', '마늘'],
      steps: [
        { step: 1, instruction: '김치를 볶는다', time: 5, tip: '김치는 충분히 볶아야 깊은 맛이 납니다' },
        { step: 2, instruction: '고기를 넣고 볶는다', time: 3, tip: null },
        { step: 3, instruction: '물을 넣고 끓인다', time: 15, tip: null },
        { step: 4, instruction: '두부와 대파를 넣는다', time: 7, tip: '두부는 마지막에 넣어야 부서지지 않습니다' }
      ],
      cookingTime: 30,
      servings: 2,
      difficulty: 'easy',
      tags: ['한식', '찌개', '매운맛', '간단'],
      category: '찌개',
      imageUrl: null,
      nutrition: { calories: 250, protein: 18, carbs: 12, fat: 15 },
      author: 'AI Chef',
      rating: 4.5,
      reviews: 123,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2', 
      title: '불고기',
      description: '달콤한 양념의 소고기 구이',
      ingredients: ['소고기', '양파', '당근', '간장', '설탕', '마늘', '배'],
      steps: [
        { step: 1, instruction: '고기를 양념에 재운다', time: 120, tip: '최소 2시간 이상 재워야 맛이 깊어집니다' },
        { step: 2, instruction: '야채를 썬다', time: 10, tip: null },
        { step: 3, instruction: '팬에 고기를 굽는다', time: 8, tip: '강불에서 빠르게 구워주세요' },
        { step: 4, instruction: '야채를 넣고 볶는다', time: 7, tip: null }
      ],
      cookingTime: 25,
      servings: 3,
      difficulty: 'medium',
      tags: ['한식', '구이', '달콤', '소고기'],
      category: '구이',
      imageUrl: null,
      nutrition: { calories: 320, protein: 28, carbs: 18, fat: 16 },
      author: 'AI Chef',
      rating: 4.7,
      reviews: 89,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  /**
   * 레시피 검색 (알레르기 필터링 포함)
   */
  async searchRecipes(query: string, allergies?: string[]): Promise<Recipe[]> {
    this.logger.log(`Searching recipes for: ${query}`);
    if (allergies && allergies.length > 0) {
      this.logger.log(`Filtering out allergies: ${allergies.join(', ')}`);
    }
    
    // TODO: 실제 검색 엔진(Elasticsearch) 연동
    let filteredRecipes = this.sampleRecipes.filter(recipe => 
      recipe.title.includes(query) || 
      recipe.description.includes(query) ||
      recipe.ingredients.some(ingredient => ingredient.includes(query))
    );
    
    // 알레르기 필터링
    if (allergies && allergies.length > 0) {
      filteredRecipes = filteredRecipes.filter(recipe => {
        // 레시피 재료에 알레르기 재료가 포함되지 않은 경우만 반환
        return !recipe.ingredients.some(ingredient => 
          allergies.some(allergy => 
            ingredient.toLowerCase().includes(allergy.toLowerCase()) ||
            allergy.toLowerCase().includes(ingredient.toLowerCase())
          )
        );
      });
    }
    
    return filteredRecipes;
  }

  /**
   * 레시피 상세 조회
   */
  async getRecipeById(id: string): Promise<Recipe | null> {
    this.logger.log(`Getting recipe by id: ${id}`);
    
    const recipe = this.sampleRecipes.find(r => r.id === id);
    return recipe || null;
  }

  /**
   * 모든 레시피 조회
   */
  async getAllRecipes(): Promise<Recipe[]> {
    this.logger.log('Getting all recipes');
    return this.sampleRecipes;
  }

  /**
   * 추천 레시피 조회 (알레르기 고려)
   */
  async getRecommendedRecipes(limit: number = 5, allergies?: string[]): Promise<Recipe[]> {
    this.logger.log(`Getting ${limit} recommended recipes`);
    if (allergies && allergies.length > 0) {
      this.logger.log(`Considering allergies: ${allergies.join(', ')}`);
    }
    
    let recipes = this.sampleRecipes;
    
    // 알레르기 필터링
    if (allergies && allergies.length > 0) {
      recipes = recipes.filter(recipe => {
        return !recipe.ingredients.some(ingredient => 
          allergies.some(allergy => 
            ingredient.toLowerCase().includes(allergy.toLowerCase()) ||
            allergy.toLowerCase().includes(ingredient.toLowerCase())
          )
        );
      });
    }
    
    return recipes.slice(0, limit);
  }
}