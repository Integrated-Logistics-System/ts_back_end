import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
} from 'class-validator';

export class RecommendRecipeDto {
  @ApiProperty({
    description: 'List of available ingredients',
    example: ['chicken breast', 'tomato', 'onion', 'garlic'],
  })
  @IsArray()
  @IsString({ each: true })
  ingredients: string[];

  @ApiProperty({
    description: 'User dietary restrictions',
    required: false,
    example: ['vegetarian', 'gluten-free'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryRestrictions?: string[];

  @ApiProperty({
    description: 'Preferred cuisine types',
    required: false,
    example: ['korean', 'italian', 'mexican'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisineTypes?: string[];

  @ApiProperty({
    description: 'User cooking skill level',
    enum: ['beginner', 'intermediate', 'advanced'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  cookingSkill?: string;

  @ApiProperty({
    description: 'Maximum cooking time in minutes',
    required: false,
    example: 60,
  })
  @IsOptional()
  @IsNumber()
  maxCookingTime?: number;

  @ApiProperty({
    description: 'Maximum number of recommendations',
    default: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maxResults?: number;
}
