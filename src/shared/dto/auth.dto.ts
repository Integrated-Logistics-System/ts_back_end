import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다.' })
  @IsNotEmpty({ message: '이메일은 필수 항목입니다.' })
  email!: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '비밀번호는 필수 항목입니다.' })
  @MinLength(6, { message: '비밀번호는 최소 6자 이상이어야 합니다.' })
  password!: string;

  @ApiProperty({ example: 'John Doe', description: 'User name', required: false })
  @IsOptional()
  @IsString({ message: '이름은 문자열이어야 합니다.' })
  name?: string;

  @ApiProperty({ example: '초급', description: 'User cooking level', required: false })
  @IsOptional()
  @IsString({ message: '요리 수준은 문자열이어야 합니다.' })
  cookingLevel?: string;

  @ApiProperty({ example: ['한식', '매운맛'], description: 'User preferences', required: false })
  @IsOptional()
  @IsArray({ message: '선호도는 배열이어야 합니다.' })
  @IsString({ each: true, message: '선호도 항목은 문자열이어야 합니다.' })
  preferences?: string[];
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다.' })
  @IsNotEmpty({ message: '이메일은 필수 항목입니다.' })
  email!: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '비밀번호는 필수 항목입니다.' })
  password!: string;
}
