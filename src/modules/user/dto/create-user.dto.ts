import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Username',
    example: 'cookingmaster',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'User password',
    example: 'hashedpassword123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'User preferences',
    required: false,
  })
  @IsOptional()
  preferences?: {
    dietaryRestrictions?: string[];
    favoriteIngredients?: string[];
    dislikedIngredients?: string[];
    cuisineTypes?: string[];
    cookingSkill?: string;
  };
}
