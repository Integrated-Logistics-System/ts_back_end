import { IsString, IsArray, IsNumber, IsOptional, IsDate, IsBoolean } from 'class-validator';

// 영양소 정보 DTO
export class NutritionInfoDto {
  @IsNumber()
  calories: number;

  @IsNumber()
  fat: number;

  @IsNumber()
  saturatedFat: number;

  @IsNumber()
  cholesterol: number;

  @IsNumber()
  sodium: number;

  @IsNumber()
  carbohydrates: number;

  @IsNumber()
  fiber: number;

  @IsNumber()
  @IsOptional()
  sugar?: number;

  @IsNumber()
  @IsOptional()
  protein?: number;
}

export class CreateRecipeDto {
  @IsNumber()
  id: number;

  @IsString()
  name: string;

  @IsArray()
  ingredients: string[];

  @IsArray()
  steps: string[];

  @IsNumber()
  minutes: number;

  @IsNumber()
  n_steps: number;

  @IsNumber()
  n_ingredients: number;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  nutrition?: string; // 문자열로 변경

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  contributor_id?: number;

  @IsDate()
  @IsOptional()
  submitted?: Date;
}

export class SearchRecipeDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsArray()
  @IsOptional()
  ingredients?: string[];

  @IsArray()
  @IsOptional()
  excludeAllergens?: string[];

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsNumber()
  @IsOptional()
  maxMinutes?: number;

  @IsString()
  @IsOptional()
  difficulty?: string;

  // 영양소 필터 추가
  @IsNumber()
  @IsOptional()
  maxCalories?: number;

  @IsNumber()
  @IsOptional()
  minCalories?: number;

  @IsNumber()
  @IsOptional()
  maxFat?: number;

  @IsNumber()
  @IsOptional()
  maxSodium?: number;

  @IsString()
  @IsOptional()
  calorieLevel?: 'low' | 'medium' | 'high';

  @IsBoolean()
  @IsOptional()
  dietFriendly?: boolean;

  @IsNumber()
  @IsOptional()
  minHealthScore?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;

  @IsNumber()
  @IsOptional()
  offset?: number;
}

export class RecipeByIngredientsDto {
  @IsArray()
  ingredients: string[];

  @IsArray()
  @IsOptional()
  excludeAllergens?: string[];

  // 영양소 필터 추가
  @IsNumber()
  @IsOptional()
  maxCalories?: number;

  @IsBoolean()
  @IsOptional()
  dietFriendly?: boolean;

  @IsNumber()
  @IsOptional()
  limit?: number;
}

// 카드 형식의 레시피 응답 DTO
export class RecipeCardDto {
  @IsNumber()
  id: number;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  originalName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  originalDescription?: string;

  @IsArray()
  ingredients: string[];

  @IsNumber()
  minutes: number;

  @IsNumber()
  n_ingredients: number;

  @IsNumber()
  n_steps: number;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsOptional()
  nutrition?: {
    calories?: number;
    fat?: number;
    protein?: number;
    carbs?: number;
  };

  @IsNumber()
  @IsOptional()
  relevanceScore?: number;

  @IsBoolean()
  @IsOptional()
  isTranslated?: boolean;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsArray()
  @IsOptional()
  allergenInfo?: string[];

  @IsBoolean()
  @IsOptional()
  isSafeForUser?: boolean;
}

// 검색 응답 DTO
export class SearchResponseDto {
  @IsArray()
  recipes: RecipeCardDto[];

  @IsNumber()
  total: number;

  @IsArray()
  @IsOptional()
  workflow_steps?: string[];

  @IsString()
  @IsOptional()
  ai_response?: string;

  @IsString()
  @IsOptional()
  query_info?: {
    original: string;
    translated?: string;
    final: string;
    language: 'ko' | 'en' | 'other';
  };
}