/**
 * LangChain 모듈의 공통 타입 정의
 */

export interface IntentAnalysis {
  intent: 'recipe_list' | 'recipe_detail' | 'cooking_help' | 'general_chat';
  confidence: number;
  reasoning: string;
  recipeKeywords?: string[];
  specificRecipe?: string;
}

export interface StreamingChunk {
  type: 'typing' | 'token' | 'content' | 'complete' | 'error';
  content?: string;
  isComplete?: boolean;
  metadata?: StreamingMetadata;
  sessionId?: string;
  timestamp?: number;
}

export interface StreamingMetadata {
  intent: string;
  conversationType: string;
  confidence: number;
  processingTime: number;
  searchResults: number;
  recipes?: any[];
  recipeData?: any[];
  recipeDetail?: any;
}

export interface ConversationContext {
  history?: Array<{ type: string; text: string; timestamp: string }>;
  allergies?: string[];
  cookingLevel?: string;
}

export interface RecipeSearchResult {
  content: string;
  metadata: {
    intent: string;
    confidence: number;
    processingTime: number;
    searchResults?: number;
  };
  recipes: any[];
}

export interface RecipeDetailResult {
  content: string;
  metadata: {
    intent: string;
    confidence: number;
    processingTime: number;
  };
  recipe: any;
}

export interface TransformedRecipe {
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
  nutrition: NutritionInfo;
  author: string;
  rating: number;
  reviews: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeStep {
  step: number;
  instruction: string;
  time: string | null;
  tip: string | null;
}

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}