/**
 * 알레르기 관련 DTO 정의
 */

import { IsArray, IsString, IsOptional, IsEnum, IsNotEmpty, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class UserAllergenProfileDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsArray()
  @IsString({ each: true })
  allergies: string[];

  @IsObject()
  severity: Record<string, 'low' | 'medium' | 'high'>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customIngredients?: string[];
}

export class AllergenCheckRequestDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  ingredients: string[];

  @ValidateNested()
  @Type(() => UserAllergenProfileDto)
  @IsNotEmpty()
  userProfile: UserAllergenProfileDto;
}

export class AllergenSearchRequestDto {
  @IsString()
  @IsNotEmpty()
  allergenType: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class BatchIngredientsRequestDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  ingredients: string[];
}

export class AllergenProfileValidationDto {
  @IsArray()
  @IsString({ each: true })
  allergies: string[];

  @IsObject()
  severity: Record<string, 'low' | 'medium' | 'high'>;
}
