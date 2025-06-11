import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateVectorDto {
  @ApiPropertyOptional({
    description: 'Updated content to be re-vectorized',
    example: 'Updated Korean bibimbap recipe with new ingredients',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Updated metadata for the vector',
    example: { difficulty: 'easy', cuisine: 'korean', cookingTime: 25 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Updated namespace for the vector',
    example: 'updated-recipes',
  })
  @IsOptional()
  @IsString()
  namespace?: string;
}
