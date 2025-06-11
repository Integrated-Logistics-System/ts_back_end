import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum VectorSourceType {
  RECIPE = 'recipe',
  INGREDIENT = 'ingredient',
  COOKING_METHOD = 'cooking_method',
  CUISINE = 'cuisine',
  USER_PREFERENCE = 'user_preference',
}

export class CreateVectorDto {
  @ApiProperty({
    description: 'Content to be vectorized',
    example: 'Delicious Korean bibimbap recipe with vegetables and rice',
  })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Type of the source content',
    enum: VectorSourceType,
    example: VectorSourceType.RECIPE,
  })
  @IsEnum(VectorSourceType)
  sourceType: VectorSourceType;

  @ApiProperty({
    description: 'ID of the source document',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  sourceId: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the vector',
    example: { difficulty: 'medium', cuisine: 'korean', cookingTime: 30 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Namespace for organizing vectors (optional)',
    example: 'recipes',
  })
  @IsOptional()
  @IsString()
  namespace?: string;
}
