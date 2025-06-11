import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchRecipeDto {
  @ApiProperty({
    description: 'Search query for recipe name or description',
    required: false,
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({
    description: 'Filter by ingredients',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ingredients?: string[];

  @ApiProperty({
    description: 'Filter by tags',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: 'Maximum cooking time in minutes',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxCookingTime?: number;

  @ApiProperty({
    description: 'Filter by difficulty',
    enum: ['easy', 'medium', 'hard'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['easy', 'medium', 'hard'])
  difficulty?: string;

  @ApiProperty({
    description: 'Filter by dietary type',
    enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'none'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'none'])
  dietaryType?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    default: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiProperty({
    description: 'Sort by field',
    enum: ['name', 'cookingTime', 'averageRating', 'createdAt'],
    default: 'createdAt',
    required: false,
  })
  @IsOptional()
  @IsEnum(['name', 'cookingTime', 'averageRating', 'createdAt'])
  sortBy?: string;

  @ApiProperty({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
    required: false,
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: string;

  @ApiProperty({
    description: 'Use semantic search powered by vector embeddings',
    default: false,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  useSemanticSearch?: boolean;
}
