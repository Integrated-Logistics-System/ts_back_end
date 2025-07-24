import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsArray, 
  Min, 
  Max, 
  ArrayMaxSize,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 벡터 검색 DTO (POST 요청용)
 */
export class VectorSearchDto {
  @ApiProperty({
    description: '검색 쿼리',
    example: '김치찌개 레시피',
    minLength: 1,
    maxLength: 500
  })
  @IsString()
  @Length(1, 500, { message: '검색 쿼리는 1-500자 사이여야 합니다' })
  query!: string;

  @ApiPropertyOptional({
    description: '반환할 결과 수',
    example: 10,
    minimum: 1,
    maximum: 50,
    default: 10
  })
  @IsOptional()
  @IsNumber({}, { message: 'k는 숫자여야 합니다' })
  @Type(() => Number)
  @Min(1, { message: 'k는 최소 1이어야 합니다' })
  @Max(50, { message: 'k는 최대 50이어야 합니다' })
  k?: number;

  @ApiPropertyOptional({
    description: '벡터 검색 가중치 (0.0 ~ 1.0)',
    example: 0.6,
    minimum: 0.0,
    maximum: 1.0,
    default: 0.6
  })
  @IsOptional()
  @IsNumber({}, { message: 'vectorWeight는 숫자여야 합니다' })
  @Type(() => Number)
  @Min(0.0, { message: 'vectorWeight는 최소 0.0이어야 합니다' })
  @Max(1.0, { message: 'vectorWeight는 최대 1.0이어야 합니다' })
  vectorWeight?: number;

  @ApiPropertyOptional({
    description: '텍스트 검색 가중치 (0.0 ~ 1.0)',
    example: 0.4,
    minimum: 0.0,
    maximum: 1.0,
    default: 0.4
  })
  @IsOptional()
  @IsNumber({}, { message: 'textWeight는 숫자여야 합니다' })
  @Type(() => Number)
  @Min(0.0, { message: 'textWeight는 최소 0.0이어야 합니다' })
  @Max(1.0, { message: 'textWeight는 최대 1.0이어야 합니다' })
  textWeight?: number;

  @ApiPropertyOptional({
    description: '하이브리드 검색 사용 여부',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean({ message: 'useHybridSearch는 boolean이어야 합니다' })
  @Type(() => Boolean)
  useHybridSearch?: boolean;

  @ApiPropertyOptional({
    description: '최소 유사도 점수 (0.0 ~ 1.0)',
    example: 0.1,
    minimum: 0.0,
    maximum: 1.0,
    default: 0.1
  })
  @IsOptional()
  @IsNumber({}, { message: 'minScore는 숫자여야 합니다' })
  @Type(() => Number)
  @Min(0.0, { message: 'minScore는 최소 0.0이어야 합니다' })
  @Max(1.0, { message: 'minScore는 최대 1.0이어야 합니다' })
  minScore?: number;

  @ApiPropertyOptional({
    description: '알레르기 필터 목록',
    example: ['nuts', 'dairy', 'eggs'],
    maxItems: 20,
    type: [String]
  })
  @IsOptional()
  @IsArray({ message: 'allergies는 배열이어야 합니다' })
  @IsString({ each: true, message: '알레르기 항목은 문자열이어야 합니다' })
  @ArrayMaxSize(20, { message: '알레르기 필터는 최대 20개까지 가능합니다' })
  allergies?: string[];

  @ApiPropertyOptional({
    description: '사용자 선호도 목록',
    example: ['quick', 'healthy', 'spicy'],
    maxItems: 20,
    type: [String]
  })
  @IsOptional()
  @IsArray({ message: 'preferences는 배열이어야 합니다' })
  @IsString({ each: true, message: '선호도 항목은 문자열이어야 합니다' })
  @ArrayMaxSize(20, { message: '선호도 필터는 최대 20개까지 가능합니다' })
  preferences?: string[];
}

/**
 * 벡터 검색 쿼리 DTO (GET 요청용)
 */
export class VectorSearchQueryDto {
  @ApiProperty({
    description: '검색 쿼리',
    example: '김치찌개 레시피'
  })
  @IsString()
  @Length(1, 500, { message: '검색 쿼리는 1-500자 사이여야 합니다' })
  q!: string;

  @ApiPropertyOptional({
    description: '반환할 결과 수',
    example: 10,
    type: Number
  })
  @IsOptional()
  @Transform(({ value }: { value: any }) => parseInt(value))
  @IsNumber({}, { message: 'k는 숫자여야 합니다' })
  @Min(1, { message: 'k는 최소 1이어야 합니다' })
  @Max(50, { message: 'k는 최대 50이어야 합니다' })
  k?: number;

  @ApiPropertyOptional({
    description: '하이브리드 검색 사용 여부',
    example: true,
    type: Boolean
  })
  @IsOptional()
  @Transform(({ value }: { value: any }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'hybrid는 boolean이어야 합니다' })
  hybrid?: boolean;

  @ApiPropertyOptional({
    description: '알레르기 필터 (쉼표로 구분)',
    example: 'nuts,dairy,eggs'
  })
  @IsOptional()
  @IsString({ message: 'allergies는 문자열이어야 합니다' })
  allergies?: string;
}

/**
 * 개인화 추천 DTO
 */
export class PersonalizedRecommendationDto {
  @ApiProperty({
    description: '사용자 선호도',
    example: ['healthy', 'quick', 'korean'],
    type: [String]
  })
  @IsArray({ message: 'preferences는 배열이어야 합니다' })
  @IsString({ each: true, message: '선호도 항목은 문자열이어야 합니다' })
  @ArrayMaxSize(10, { message: '선호도는 최대 10개까지 가능합니다' })
  preferences!: string[];

  @ApiProperty({
    description: '알레르기 목록',
    example: ['nuts', 'dairy'],
    type: [String]
  })
  @IsArray({ message: 'allergies는 배열이어야 합니다' })
  @IsString({ each: true, message: '알레르기 항목은 문자열이어야 합니다' })
  @ArrayMaxSize(15, { message: '알레르기는 최대 15개까지 가능합니다' })
  allergies!: string[];

  @ApiPropertyOptional({
    description: '선호하는 재료들',
    example: ['chicken', 'vegetables', 'rice'],
    type: [String],
    maxItems: 10
  })
  @IsOptional()
  @IsArray({ message: 'favoriteIngredients는 배열이어야 합니다' })
  @IsString({ each: true, message: '재료명은 문자열이어야 합니다' })
  @ArrayMaxSize(10, { message: '선호 재료는 최대 10개까지 가능합니다' })
  favoriteIngredients?: string[];

  @ApiPropertyOptional({
    description: '식단 제한 사항',
    example: ['vegetarian', 'low-sodium'],
    type: [String],
    maxItems: 5
  })
  @IsOptional()
  @IsArray({ message: 'dietaryRestrictions는 배열이어야 합니다' })
  @IsString({ each: true, message: '식단 제한 항목은 문자열이어야 합니다' })
  @ArrayMaxSize(5, { message: '식단 제한은 최대 5개까지 가능합니다' })
  dietaryRestrictions?: string[];

  @ApiPropertyOptional({
    description: '요리 난이도',
    example: 'easy',
    enum: ['easy', 'medium', 'hard']
  })
  @IsOptional()
  @IsString({ message: 'difficulty는 문자열이어야 합니다' })
  difficulty?: 'easy' | 'medium' | 'hard';

  @ApiPropertyOptional({
    description: '최대 요리 시간 (분)',
    example: 30,
    minimum: 1,
    maximum: 480
  })
  @IsOptional()
  @IsNumber({}, { message: 'maxCookTime은 숫자여야 합니다' })
  @Type(() => Number)
  @Min(1, { message: 'maxCookTime은 최소 1분이어야 합니다' })
  @Max(480, { message: 'maxCookTime은 최대 480분(8시간)이어야 합니다' })
  maxCookTime?: number;

  @ApiPropertyOptional({
    description: '반환할 추천 레시피 수',
    example: 10,
    minimum: 1,
    maximum: 30,
    default: 10
  })
  @IsOptional()
  @IsNumber({}, { message: 'k는 숫자여야 합니다' })
  @Type(() => Number)
  @Min(1, { message: 'k는 최소 1이어야 합니다' })
  @Max(30, { message: 'k는 최대 30이어야 합니다' })
  k?: number;
}

/**
 * 벡터 검색 응답 DTO
 */
export class VectorSearchResponseDto {
  @ApiProperty({
    description: '검색 결과 레시피 목록',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '레시피 ID' },
        name: { type: 'string', description: '레시피명' },
        description: { type: 'string', description: '레시피 설명' },
        _score: { type: 'number', description: 'Elasticsearch 점수' },
        vectorSimilarity: { type: 'number', description: '벡터 유사도 점수' },
        combinedScore: { type: 'number', description: '최종 결합 점수' }
      }
    }
  })
  results!: any[];

  @ApiProperty({
    description: '총 검색 결과 수',
    example: 1520
  })
  total!: number;

  @ApiProperty({
    description: '최고 점수',
    example: 0.95
  })
  maxScore!: number;

  @ApiProperty({
    description: '검색 소요 시간 (ms)',
    example: 125
  })
  searchTime!: number;

  @ApiProperty({
    description: '사용된 검색 방법',
    example: 'hybrid',
    enum: ['vector', 'text', 'hybrid']
  })
  searchMethod!: string;

  @ApiProperty({
    description: '검색 메타데이터',
    type: 'object',
    properties: {
      vectorWeight: { type: 'number', description: '벡터 검색 가중치' },
      textWeight: { type: 'number', description: '텍스트 검색 가중치' },
      queryEmbeddingTime: { type: 'number', description: '임베딩 생성 시간 (ms)' },
      elasticsearchTime: { type: 'number', description: 'Elasticsearch 실행 시간 (ms)' },
      k: { type: 'number', description: '요청된 결과 수' }
    }
  })
  metadata: any;
}