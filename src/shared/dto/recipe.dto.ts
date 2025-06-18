/**
 * 레시피 관련 DTO 정의
 */

import { IsString, IsOptional, IsEnum, IsNotEmpty, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { UserAllergenProfileDto } from './allergen.dto';

export class RecipeSearchRequestDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserAllergenProfileDto)
  userAllergenProfile?: UserAllergenProfileDto;
}

export class RecipeChatRequestDto {
  @IsString()
  @IsNotEmpty()
  query: string;
}

export class RecipeDetailParamsDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class RecipeFilterDto {
  @IsOptional()
  @IsNumber()
  maxMinutes?: number;

  @IsOptional()
  @IsNumber()
  maxSteps?: number;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString({ each: true })
  excludeIngredients?: string[];

  @IsOptional()
  @IsString({ each: true })
  includeIngredients?: string[];
}

export class PaginationDto {
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
