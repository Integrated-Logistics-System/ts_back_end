// Recipe DTO (사용 안함)
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class SearchRecipeDto {
  @ApiProperty({ example: 'pasta' })
  @IsString()
  query: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
