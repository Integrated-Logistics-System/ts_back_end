import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';

export class UpdateProfileDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({
        example: ['글루텐', '견과류'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allergies?: string[];

    @ApiProperty({
        example: '중급',
        enum: ['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'],
        required: false
    })
    @IsOptional()
    @IsEnum(['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'])
    cookingLevel?: string;

    @ApiProperty({
        example: ['한식', '빠른 요리', '건강한 음식'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    preferences?: string[];
}

export class UpdateAllergiesDto {
    @ApiProperty({
        example: ['글루텐', '견과류', '새우'],
        description: '사용자의 알레르기 목록'
    })
    @IsArray()
    @IsString({ each: true })
    allergies!: string[];
}

export class UpdateCookingPreferencesDto {
    @ApiProperty({
        example: '중급',
        enum: ['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'],
        required: false
    })
    @IsOptional()
    @IsEnum(['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'])
    cookingLevel?: string;

    @ApiProperty({
        example: ['한식', '빠른 요리', '건강한 음식'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    preferences?: string[];
}