import { IsString, IsArray, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsString()
  userId: string;

  @IsString()
  name: string;

  @IsArray()
  @IsOptional()
  allergies?: string[];

  @IsOptional()
  preferences?: {
    cuisine?: string[];
    difficulty?: string;
    cookingTime?: number;
    dietaryRestrictions?: string[];
  };
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsOptional()
  allergies?: string[];

  @IsOptional()
  preferences?: {
    cuisine?: string[];
    difficulty?: string;
    cookingTime?: number;
    dietaryRestrictions?: string[];
  };
}

export class UpdateAllergiesDto {
  @IsArray()
  allergies: string[];
}

export class UpdatePreferencesDto {
  @IsArray()
  @IsOptional()
  cuisine?: string[];

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsNumber()
  @IsOptional()
  cookingTime?: number;

  @IsArray()
  @IsOptional()
  dietaryRestrictions?: string[];
}