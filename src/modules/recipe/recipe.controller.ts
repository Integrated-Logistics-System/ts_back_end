import { Controller, Post, Body, Get, Param, BadRequestException, NotFoundException } from '@nestjs/common';
import { RAGService } from '../rag/rag.service';
import { 
  RecipeSearchResult, 
  RecipeDetailData 
} from '@/shared';
import { 
  RecipeSearchRequestDto,
  RecipeChatRequestDto
} from '@/shared';

@Controller('recipe')
export class RecipeController {
  constructor(private readonly ragService: RAGService) {}

  @Post('search')
  async searchRecipe(@Body() request: RecipeSearchRequestDto): Promise<RecipeSearchResult> {
    if (!request.query || request.query.trim().length === 0) {
      throw new BadRequestException('검색어를 입력해주세요.');
    }

    try {
      if (request.userAllergenProfile) {
        return await this.ragService.findOptimalRecipeWithAllergens(
          request.query, 
          request.language,
          request.userAllergenProfile
        );
      } else {
        return await this.ragService.findOptimalRecipe(request.query, request.language);
      }
    } catch (error) {
      throw new BadRequestException(`레시피 검색 실패: ${error.message}`);
    }
  }

  @Get('detail/:id')
  async getRecipeDetail(@Param('id') id: string): Promise<RecipeDetailData> {
    const recipeId = parseInt(id);
    
    if (isNaN(recipeId) || recipeId <= 0) {
      throw new BadRequestException('유효하지 않은 레시피 ID입니다.');
    }

    try {
      return await this.ragService.getRecipeDetail(recipeId);
    } catch (error) {
      throw new NotFoundException(`레시피를 찾을 수 없습니다: ${error.message}`);
    }
  }

  @Post('chat')
  async chatRecipe(@Body() body: RecipeChatRequestDto): Promise<{ response: string; recipes?: any[] }> {
    if (!body.query || body.query.trim().length === 0) {
      throw new BadRequestException('메시지를 입력해주세요.');
    }

    try {
      const result = await this.ragService.findOptimalRecipe(body.query);
      return {
        response: result.explanation,
        recipes: result.recipes
      };
    } catch (error) {
      throw new BadRequestException(`채팅 처리 실패: ${error.message}`);
    }
  }
}
