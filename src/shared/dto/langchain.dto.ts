import { IsString, IsOptional, IsArray, IsNumber, Min, Max } from 'class-validator';

// ================== RAG 레시피 검색 DTO ==================

export class RAGRecipeRequestDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userAllergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferences?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxRecipes?: number;
}

// ================== 채팅 DTO ==================

export class ChatMessageDto {
  @IsString()
  message: string;
}

// ================== 레거시 DTO (하위 호환성) ==================

export class LangChainChatDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  chainType?: string;

  @IsOptional()
  model?: string;

  @IsOptional()
  temperature?: number;
}

export class RecipeChatDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ingredients?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsString()
  cookingLevel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferences?: string[];
}

export class RAGChatDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  searchQuery?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  context?: string[];
}

// ================== 설정 DTO ==================

export class ChainConfigDto {
  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4000)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  chainType?: 'conversation' | 'recipe' | 'rag';
}

export class MemoryConfigDto {
  @IsOptional()
  @IsString()
  memoryType?: 'buffer' | 'summary' | 'redis';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxMessages?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(7)
  retentionDays?: number;
}

export class ClearMemoryDto {
  @IsOptional()
  @IsString()
  chainType?: string;

  @IsOptional()
  @IsString()
  memoryType?: string;
}

// ================== 테스트 DTO ==================

export class TranslationTestDto {
  @IsString()
  text: string;
}

export class RecipeDetectionTestDto {
  @IsString()
  message: string;
}