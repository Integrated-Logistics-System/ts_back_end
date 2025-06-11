import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class CreateRecipeDto {
  @ApiProperty({
    description: 'Recipe ID',
    example: 123456,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  recipe_id?: number;

  @ApiProperty({
    description: 'Recipe name',
    example: 'Arriba Baked Winter Squash Mexican Style',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'List of ingredients',
    example: ['winter squash', 'mexican seasoning', 'honey'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ingredients: string[];

  @ApiProperty({
    description: 'Step-by-step cooking instructions',
    example: ['Preheat oven to 400°F', 'Cut squash in half'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  instructions: string[];

  @ApiProperty({
    description: 'Step-by-step cooking steps (legacy)',
    example: ['Preheat oven to 400°F', 'Cut squash in half'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  steps?: string[];

  @ApiProperty({
    description: 'Cooking time in minutes',
    example: 55,
  })
  @IsNumber()
  @Min(1)
  cookingTime: number;

  @ApiProperty({
    description: 'Cooking time in minutes (legacy)',
    example: 55,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minutes?: number;

  @ApiProperty({
    description: 'Number of steps',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  n_steps?: number;

  @ApiProperty({
    description: 'Number of ingredients',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  n_ingredients?: number;

  @ApiProperty({
    description: 'Contributor ID',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  contributor_id?: number;

  @ApiProperty({
    description: 'Contributor ID (legacy)',
    required: false,
  })
  @IsOptional()
  @IsString()
  contributorId?: string;

  @ApiProperty({
    description: 'Submitted date',
    required: false,
  })
  @IsOptional()
  @IsString()
  submitted?: string;

  @ApiProperty({
    description: 'Cuisine type',
    example: 'Korean',
    required: false,
  })
  @IsOptional()
  @IsString()
  cuisine?: string;

  @ApiProperty({
    description: 'Recipe tags',
    example: ['vegetarian', 'mexican', 'easy'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: 'Nutritional information',
    required: false,
  })
  @IsOptional()
  nutrition?: {
    calories?: number;
    fat?: number;
    sugar?: number;
    sodium?: number;
    protein?: number;
    saturatedFat?: number;
    carbohydrates?: number;
  };

  @ApiProperty({
    description: 'Recipe difficulty level',
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  })
  @IsOptional()
  @IsEnum(['easy', 'medium', 'hard'])
  difficulty?: string;

  @ApiProperty({
    description: 'Number of servings',
    example: 4,
  })
  @IsNumber()
  @Min(1)
  servings: number;

  @ApiProperty({
    description: 'Recipe description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Allergens present in recipe',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];

  @ApiProperty({
    description: 'Recipe image URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Dietary type',
    enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'none'],
    default: 'none',
  })
  @IsOptional()
  @IsEnum(['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'none'])
  dietaryType?: string;
}
