import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsArray } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ 
    example: '초급',
    enum: ['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'])
  cookingLevel?: string;

  @ApiProperty({ 
    example: ['한식', '간단한 요리', '30분 이내'],
    required: false 
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferences?: string[];
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

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
