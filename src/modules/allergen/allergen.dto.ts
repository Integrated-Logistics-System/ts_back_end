import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAllergenTypeDto {
  @ApiProperty({ example: '계란', description: '알레르기 타입 이름' })
  @IsString()
  name: string;

  @ApiProperty({ example: '닭달걀 및 달걀 제품', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateAllergenTypeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderAllergenTypesDto {
  @ApiProperty({
    example: [
      { id: '507f1f77bcf86cd799439011', order: 1 },
      { id: '507f1f77bcf86cd799439012', order: 2 }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderMapDto)
  orderMap: OrderMapDto[];
}

class OrderMapDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  id: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  order: number;
}

export class AllergenCheckDto {
  @ApiProperty({ 
    example: ['밀가루', '달걀', '우유'],
    description: '확인할 재료 목록'
  })
  @IsArray()
  @IsString({ each: true })
  ingredients: string[];

  @ApiProperty({ 
    example: ['글루텐', '계란', '유제품'],
    description: '사용자 알레르기 목록'
  })
  @IsArray()
  @IsString({ each: true })
  allergies: string[];
}
