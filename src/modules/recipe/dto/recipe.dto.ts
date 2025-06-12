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