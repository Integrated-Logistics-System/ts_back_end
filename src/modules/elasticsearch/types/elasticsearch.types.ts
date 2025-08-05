// Elasticsearch 관련 공통 타입 정의
export interface ElasticsearchRecipe {
  id: string;
  name: string;
  nameKo: string;
  nameEn: string;
  description: string;
  descriptionKo: string;
  descriptionEn: string;
  ingredients: string[];
  ingredientsKo: string[];
  ingredientsEn: string[];
  steps: string[];
  stepsKo: string[];
  stepsEn: string[];
  instructions?: string | string[];
  instructionsKo?: string | string[];
  instructionsEn?: string | string[];
  difficulty: string;
  tags: string[];
  tagsKo: string[];
  tagsEn: string[];
  minutes: number;
  nSteps: number;
  nIngredients: number;
  servings?: number;
  serves?: number;
  portions?: number;
  cookingTime?: string;
  totalTime?: string;
  prepTime?: string;
  calories?: string | number;
  protein?: string;
  carbs?: string;
  carbohydrates?: string;
  fat?: string;
  fats?: string;
  nutrition?: {
    calories?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  nutritionInfo?: {
    calories?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  tips?: string[];
  source?: string;
  viewCount?: number;
  likeCount?: number;
  bookmarkCount?: number;
  averageRating?: number;
  ratingCount?: number;
  isBookmarked?: boolean;
  userRating?: number;
  personalNote?: string;
  personalTags?: string[];
  cookCount?: number;
  lastCookedAt?: Date;
  allergenInfo?: AllergenInfo;
  allergyRisk?: string;
  allergies?: string[];
  isSafeForAllergies?: boolean;
  safetyScore?: number;
  createdAt?: string;
  updatedAt?: string;
  isAiGenerated?: boolean;
  generationTimestamp?: string;
  originalRecipeId?: string;
  
}

export interface AllergenInfo {
  allergen_risk_score: number;
  contains_allergens: string[];
  high_risk_ingredients: string[];
  safe_for: string[];
  total_allergen_count: number;
  ingredient_details: Array<{
    name: string;
    allergens: string[];
    risk_level: string;
  }>;
}

// Elasticsearch 응답 타입들
export interface ElasticsearchHit<T = Record<string, unknown>> {
  _index: string;
  _id: string;
  _score?: number;
  _source: T;
}

export interface ElasticsearchResponse<T = Record<string, unknown>> {
  hits: {
    total: {
      value: number;
      relation: string;
    };
    hits: ElasticsearchHit<T>[];
  };
  aggregations?: Record<string, unknown>;
  suggest?: Record<string, unknown>;
}

export interface ElasticsearchCountResponse {
  count: number;
}

export interface ElasticsearchSuggestOption {
  text: string;
  _score: number;
}

export interface ElasticsearchSuggestResponse {
  suggest: {
    [key: string]: [{
      options: ElasticsearchSuggestOption[];
    }];
  };
}

// 검색 옵션 타입들
export interface SearchOptions {
  allergies?: string[];
  preferences?: string[];
  difficulty?: string;
  maxTime?: number;
  maxCookingTime?: number;
  minRating?: number;
  tags?: string[];
  limit?: number;
  page?: number;
  sortBy?: 'relevance' | 'rating' | 'time' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface AdvancedSearchOptions extends SearchOptions {
  ingredients?: string[];
  excludeIngredients?: string[];
  servings?: number;
  calories?: { min?: number; max?: number };
  sortBy?: 'relevance' | 'rating' | 'time' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  recipes: ElasticsearchRecipe[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  searchTime: number;
  aggregations?: Record<string, unknown>;
}

// 저장/업데이트 관련 타입들
export interface RecipeCreateInput {
  recipe: Partial<ElasticsearchRecipe>;
  validate?: boolean;
}

export interface RecipeUpdateInput {
  id: string;
  updates: Partial<ElasticsearchRecipe>;
  upsert?: boolean;
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

// 통계 관련 타입들
export interface RecipeStats {
  totalRecipes: number;
  averageRating: number;
  popularTags: Array<{ tag: string; count: number }>;
  difficultyDistribution: Record<string, number>;
  averageCookingTime: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    connection: boolean;
    indexExists: boolean;
    docCount: number;
    lastUpdate: string;
  };
}

