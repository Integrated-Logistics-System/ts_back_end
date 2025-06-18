import { Controller, Post, Body, BadRequestException, Get, Param } from '@nestjs/common';
import { RAGService } from './rag.service';
import { 
  RecipeSearchResult, 
  RecipeDetailData 
} from '../../shared/interfaces';

export interface RAGChatRequest {
  query: string;
  language?: string;
  context?: string;
}

export interface RAGSearchRequest {
  query: string;
  language?: string;
  filters?: {
    maxTime?: number;
    tags?: string[];
    difficulty?: string;
  };
}

@Controller('rag')
export class RAGController {
  constructor(private readonly ragService: RAGService) {}

  @Post('chat')
  async chat(@Body() body: RAGChatRequest): Promise<RecipeSearchResult> {
    if (!body.query || body.query.trim().length === 0) {
      throw new BadRequestException('질문을 입력해주세요.');
    }

    try {
      return await this.ragService.findOptimalRecipe(body.query, body.language);
    } catch (error) {
      throw new BadRequestException(`RAG 채팅 처리 실패: ${error.message}`);
    }
  }

  @Post('search')
  async search(@Body() body: RAGSearchRequest): Promise<RecipeSearchResult> {
    if (!body.query || body.query.trim().length === 0) {
      throw new BadRequestException('검색어를 입력해주세요.');
    }

    try {
      return await this.ragService.findOptimalRecipe(body.query, body.language);
    } catch (error) {
      throw new BadRequestException(`RAG 검색 실패: ${error.message}`);
    }
  }

  @Get('recipe/:id')
  async getRecipeDetail(@Param('id') id: string): Promise<RecipeDetailData> {
    const recipeId = parseInt(id);
    
    if (isNaN(recipeId) || recipeId <= 0) {
      throw new BadRequestException('유효하지 않은 레시피 ID입니다.');
    }

    try {
      return await this.ragService.getRecipeDetail(recipeId);
    } catch (error) {
      throw new BadRequestException(`RAG 레시피 조회 실패: ${error.message}`);
    }
  }

  @Post('analyze')
  async analyzeQuery(@Body() body: { query: string }): Promise<{
    detectedLanguage: string;
    translatedQuery: string;
    extractedKeywords: string[];
    confidence: number;
  }> {
    if (!body.query || body.query.trim().length === 0) {
      throw new BadRequestException('분석할 텍스트를 입력해주세요.');
    }

    try {
      // RAG 서비스의 내부 번역 메서드를 활용한 분석
      const result = await this.ragService.findOptimalRecipe(body.query);
      
      return {
        detectedLanguage: result.detectedLanguage,
        translatedQuery: result.translatedQuery,
        extractedKeywords: result.recipes.flatMap(r => r.tags).slice(0, 10),
        confidence: 0.8
      };
    } catch (error) {
      throw new BadRequestException(`쿼리 분석 실패: ${error.message}`);
    }
  }
}
