import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, Min, Max } from 'class-validator';

export class SearchRecipeDto {
    @ApiProperty({ example: 'pasta', description: 'Search query' })
    @IsString()
    query!: string;

    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({ required: false, default: 10 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(50)
    limit?: number = 10;

    @ApiProperty({ required: false, example: ['글루텐', '견과류'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allergies?: string[];

    @ApiProperty({ required: false, example: ['한식', '빠른요리'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    preferences?: string[];

    @ApiProperty({ required: false, example: 30 })
    @IsOptional()
    @IsNumber()
    maxCookingTime?: number;

    @ApiProperty({ required: false, example: '쉬움' })
    @IsOptional()
    @IsString()
    difficulty?: string;

    @ApiProperty({ required: false, example: ['한식', '간단'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @ApiProperty({ required: false, default: 'relevance' })
    @IsOptional()
    @IsString()
    sortBy?: 'relevance' | 'rating' | 'time' | 'popularity' = 'relevance';

    @ApiProperty({ required: false, default: 'desc' })
    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc' = 'desc';
}

export class RateRecipeDto {
    @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
    @IsNumber()
    @Min(1)
    @Max(5)
    rating!: number;
}

export class AddPersonalNoteDto {
    @ApiProperty({ example: '맛있었어요! 다음에는 소금을 좀 더 넣어봐야겠어요.' })
    @IsString()
    note!: string;
}

