/**
 * 레시피 관련 인터페이스 정의
 */

import { AllergenCheckResult, UserAllergenProfile } from './allergen.interface';

export interface RecipeCardData {
  id: number;
  name: string;
  description?: string;
  minutes: number;
  n_steps: number;
  n_ingredients: number;
  tags: string[];
  allergyWarnings?: string[];
  allergenCheckResult?: AllergenCheckResult;
  score?: number;
}

export interface RecipeDetailData {
  id: number;
  name: string;
  description?: string;
  ingredients: string[];
  steps: string[];
  minutes: number;
  n_steps: number;
  n_ingredients: number;
  tags: string[];
  nutrition?: string;
  contributor_id?: number;
  submitted?: string;
  stepsWithTimers?: Array<{
    index: number;
    content: string;
    duration: number;
    hasTimer: boolean;
  }>;
}

export interface RecipeSearchResult {
  originalQuery: string;
  translatedQuery: string;
  detectedLanguage: string;
  recipes: RecipeCardData[];
  explanation: string;
  cookingTips?: string[];
}

export interface RecipeSearchRequest {
  query: string;
  language?: string;
  userAllergenProfile?: UserAllergenProfile;
}

export interface RecipeChatResponse {
  response: string;
  recipes?: RecipeCardData[];
}

export interface RecipeFilterCriteria {
  maxMinutes?: number;
  maxSteps?: number;
  tags?: string[];
  excludeIngredients?: string[];
  includeIngredients?: string[];
}

export interface RecipeNutrition {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}
