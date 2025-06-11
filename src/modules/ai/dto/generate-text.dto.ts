import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class GenerateTextDto {
  @ApiProperty({
    description: 'Prompt for text generation',
    example: 'Explain how to cook pasta carbonara step by step',
  })
  @IsString()
  prompt: string;

  @ApiProperty({
    description: 'Temperature for generation (0.0 to 1.0)',
    default: 0.7,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiProperty({
    description: 'Maximum number of tokens to generate',
    default: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @ApiProperty({
    description: 'Specific model to use',
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string;
}
