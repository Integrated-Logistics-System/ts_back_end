import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class VectorSearchDto {
  @ApiPropertyOptional({
    description: 'Query text to search for similar vectors',
    example: 'Korean spicy noodle soup recipe',
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({
    description: 'Vector array for direct vector search',
    example: [0.1, 0.2, 0.3],
  })
  @IsOptional()
  @IsArray()
  vector?: number[];

  @ApiPropertyOptional({
    description: 'Number of similar vectors to return',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  topK?: number = 10;

  @ApiPropertyOptional({
    description: 'Minimum similarity score threshold',
    example: 0.7,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.5;

  @ApiPropertyOptional({
    description: 'Filter metadata for more specific results',
    example: { sourceType: 'recipe', difficulty: 'medium' },
  })
  @IsOptional()
  @IsObject()
  filter?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Namespace to search within (optional)',
    example: 'recipes',
  })
  @IsOptional()
  @IsString()
  namespace?: string;

  @ApiPropertyOptional({
    description: 'Include metadata in response',
    example: true,
  })
  @IsOptional()
  includeMetadata?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include original content in response',
    example: true,
  })
  @IsOptional()
  includeContent?: boolean = true;
}

export class VectorSearchResult {
  @ApiProperty({
    description: 'Vector ID',
    example: 'vec_507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Similarity score',
    example: 0.85,
  })
  score: number;

  @ApiPropertyOptional({
    description: 'Vector metadata',
    example: { sourceType: 'recipe', difficulty: 'medium' },
  })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Original content',
    example: 'Delicious Korean bibimbap recipe...',
  })
  content?: string;

  @ApiPropertyOptional({
    description: 'Source document ID',
    example: '507f1f77bcf86cd799439011',
  })
  sourceId?: string;

  @ApiPropertyOptional({
    description: 'Source type',
    example: 'recipe',
  })
  sourceType?: string;
}
