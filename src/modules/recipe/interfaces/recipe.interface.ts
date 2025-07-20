// Recipe domain interface definitions

export interface RecipeMetrics {
  viewCount: number;
  likeCount: number;
  bookmarkCount: number;
  averageRating: number;
  ratingCount: number;
}

export interface UserRecipeInteraction {
  isBookmarked: boolean;
  userRating?: number;
  personalNote?: string;
  personalTags: string[];
  cookCount: number;
  lastCookedAt?: Date;
}

export interface RecipeSearchFilters {
  allergies?: string[];
  preferences?: string[];
  difficulty?: string;
  maxCookingTime?: number;
  tags?: string[];
  minRating?: number;
  sortBy?: 'relevance' | 'rating' | 'popularity' | 'newest';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedRecipeResponse<T = any> {
  recipes: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  totalPages: number;
}

export interface BookmarkResult {
  bookmarked: boolean;
  message: string;
  bookmarkCount?: number;
  totalBookmarks?: number;
}

export interface RatingResult {
  success: boolean;
  userRating: number;
  averageRating: number;
  ratingCount: number;
  previousRating?: number;
  message: string;
}

export interface CookingResult {
  success: boolean;
  message: string;
  cookCount: number;
  lastCookedAt?: Date;
  totalCookCount?: number;
}

export interface PersonalNoteResult {
  success: boolean;
  message: string;
  note: string;
  updatedAt: Date;
}

export interface SystemStats {
  totalRecipes: number;
  totalViews: number;
  totalLikes: number;
  totalBookmarks: number;
  averageRating: number;
  totalRatings: number;
  topRatedRecipeIds: string[];
  mostViewedRecipeIds: string[];
  recentlyAddedRecipeIds: string[];
}

export interface UserProfileForRecipeService {
  allergies: string[];
  preferences: string[];
  cookingLevel: string;
  id: string;
  email: string;
}

export interface RecipeSearchRequest {
  query?: string;
  filters?: RecipeSearchFilters;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface RecipeRecommendationRequest {
  userId: string;
  limit?: number;
  excludeRecipeIds?: string[];
  basedOn?: 'preferences' | 'history' | 'similar_users' | 'trending';
}

export interface SimilarRecipeRequest {
  recipeId: string;
  limit?: number;
  excludeRecipeIds?: string[];
  similarityType?: 'ingredients' | 'tags' | 'cuisine' | 'all';
}

export interface RecipeValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

export interface RecipeInteractionEvent {
  userId: string;
  recipeId: string;
  action: 'view' | 'bookmark' | 'unbookmark' | 'rate' | 'cook' | 'note';
  value?: number | string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PopularRecipeOptions {
  timeframe?: 'day' | 'week' | 'month' | 'all';
  limit?: number;
  category?: string;
  includeUserData?: boolean;
}

export interface RecipeAggregationResult {
  byCategory: Array<{ category: string; count: number; avgRating: number }>;
  byDifficulty: Array<{ difficulty: string; count: number; avgRating: number }>;
  byCookingTime: Array<{ range: string; count: number; avgRating: number }>;
  topIngredients: Array<{ ingredient: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
}