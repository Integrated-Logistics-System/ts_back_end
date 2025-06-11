import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RAGQueryDto {
  @ApiProperty({
    description: 'Question to ask the AI',
    example: '김치찌개 만드는 방법을 알려주세요',
  })
  @IsString()
  question: string;

  @ApiPropertyOptional({
    description: 'Maximum number of documents to retrieve',
    example: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  maxDocuments?: number = 5;

  @ApiPropertyOptional({
    description: 'Minimum relevance threshold',
    example: 0.7,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  relevanceThreshold?: number = 0.7;

  @ApiPropertyOptional({
    description: 'Include context in response',
    example: true,
  })
  @IsOptional()
  includeContext?: boolean = true;

  @ApiPropertyOptional({
    description: 'LLM model to use',
    example: 'llama3.1',
  })
  @IsOptional()
  @IsString()
  model?: string = 'llama3.1';

  @ApiPropertyOptional({
    description: 'Temperature for text generation',
    example: 0.7,
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number = 0.7;
}

export class ConversationalRAGDto extends RAGQueryDto {
  @ApiPropertyOptional({
    description: 'Previous conversation history',
    example: [
      {
        question: '김치찌개 만드는 방법을 알려주세요',
        answer: '김치찌개를 만들려면...',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  conversationHistory?: Array<{
    question: string;
    answer: string;
  }> = [];
}

export class HybridSearchDto extends RAGQueryDto {
  @ApiPropertyOptional({
    description: 'Weight for keyword search',
    example: 0.3,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  keywordWeight?: number = 0.3;

  @ApiPropertyOptional({
    description: 'Weight for vector search',
    example: 0.7,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  vectorWeight?: number = 0.7;
}

export class ExplainRecipeDto {
  @ApiPropertyOptional({
    description: 'Recipe ID to explain',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  recipeId?: string;

  @ApiProperty({
    description: 'Question about the recipe',
    example: '이 레시피에서 가장 중요한 포인트는?',
  })
  @IsString()
  question: string;
}

export class SuggestVariationsDto {
  @ApiPropertyOptional({
    description: 'Base recipe ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  recipeId?: string;

  @ApiProperty({
    description: 'Base ingredients to use',
    example: ['닭가슴살', '브로콜리', '현미'],
  })
  @IsArray()
  @IsString({ each: true })
  baseIngredients: string[];

  @ApiPropertyOptional({
    description: 'Dietary restrictions',
    example: ['비건', '저염식'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryRestrictions?: string[];

  @ApiPropertyOptional({
    description: 'Available ingredients',
    example: ['올리브오일', '마늘', '레몬'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableIngredients?: string[];
}

export class CookingTipsDto {
  @ApiPropertyOptional({
    description: 'Cooking technique',
    example: '볶음',
  })
  @IsOptional()
  @IsString()
  technique?: string;

  @ApiPropertyOptional({
    description: 'Specific ingredient',
    example: '닭가슴살',
  })
  @IsOptional()
  @IsString()
  ingredient?: string;

  @ApiPropertyOptional({
    description: 'Cooking problem',
    example: '고기가 질겨요',
  })
  @IsOptional()
  @IsString()
  problem?: string;

  @ApiProperty({
    description: 'Question about cooking',
    example: '부드럽게 조리하는 방법은?',
  })
  @IsString()
  question: string;
}
