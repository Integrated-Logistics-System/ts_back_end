import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ElasticsearchAgentService } from '../agent/search/elasticsearch-agent';
import { UserService } from '../user/user.service';
import { SearchRecipeDto } from './dto/recipe.dto';
import { ElasticsearchRecipe, SearchOptions, SearchResult } from '../elasticsearch/elasticsearch.service';

interface UserProfileForRecipeService {
  allergies: string[];
  preferences: string[];
  cookingLevel: string;
}

@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);

  constructor(
    private readonly elasticsearchAgent: ElasticsearchAgentService,
    private readonly userService: UserService,
  ) {}

  // ================== 레시피 조회 (ES + MongoDB 결합) ==================

  async getRecipeById(recipeId: string, userId?: string): Promise<ElasticsearchRecipe | null> {
    try {
      // 🤖 Elasticsearch Agent를 통한 레시피 데이터 조회
      const recipe = await this.elasticsearchAgent.getRecipeById(recipeId);
      if (!recipe) {
        throw new NotFoundException(`Recipe with ID ${recipeId} not found`);
      }

      return recipe;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Recipe fetch failed for ID ${recipeId}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async searchRecipes(searchDto: SearchRecipeDto, userId?: string): Promise<SearchResult> {
    try {
      const options: SearchOptions = {
        allergies: searchDto.allergies,
        preferences: searchDto.preferences,
        maxCookingTime: searchDto.maxCookingTime,
        difficulty: searchDto.difficulty,
        tags: searchDto.tags,
        page: searchDto.page,
        limit: searchDto.limit,
        sortBy: searchDto.sortBy,
        sortOrder: searchDto.sortOrder,
      };

      // 사용자 프로필 기반 검색 옵션 추가
      if (userId) {
        try {
          const userProfile = await this.userService.getProfile(userId);
          options.allergies = [...(options.allergies || []), ...(userProfile.allergies || [])];
          options.preferences = [...(options.preferences || []), ...(userProfile.preferences || [])];
        } catch (error: unknown) {
          this.logger.warn(`Failed to get user profile for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
          // 사용자 프로필을 가져오지 못해도 검색은 계속 진행
        }
      }

      return await this.elasticsearchAgent.searchRecipes(searchDto.query, options);
    } catch (error: unknown) {
      this.logger.error('Recipe search failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getPopularRecipes(limit: number = 10, _userId?: string): Promise<ElasticsearchRecipe[]> {
    try {
      // 🤖 Elasticsearch Agent를 통한 인기 레시피 조회
      return await this.elasticsearchAgent.getTopRatedRecipes(limit);
    } catch (error: unknown) {
      this.logger.error(`Popular recipes fetch failed:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getPersonalizedRecommendations(userId: string, limit: number = 10): Promise<ElasticsearchRecipe[]> {
    try {
      const userProfile = await this.userService.getProfile(userId);
      const userProfileForES: UserProfileForRecipeService = {
        allergies: userProfile.allergies || [],
        preferences: userProfile.preferences || [],
        cookingLevel: userProfile.cookingLevel || '초급',
      };
      return await this.elasticsearchAgent.getRecommendedRecipes(userId, userProfileForES.preferences, userProfileForES.allergies, limit);
    } catch (error: unknown) {
      this.logger.error('Personalized recommendations failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getSimilarRecipes(recipeId: string, limit: number = 5): Promise<ElasticsearchRecipe[]> {
    try {
      return await this.elasticsearchAgent.getSimilarRecipes(recipeId, limit);
    } catch (error: unknown) {
      this.logger.error(`Similar recipes search failed for ${recipeId}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      // Agent에는 별도 구현 없이 기본 검색어 제안 반환
      return ['간단한 요리', '빠른 요리', '쉬운 요리', '다이어트 요리', '건강한 요리'].slice(0, limit);
    } catch (error: unknown) {
      this.logger.error(`Suggestions failed for query "${query}":`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

}