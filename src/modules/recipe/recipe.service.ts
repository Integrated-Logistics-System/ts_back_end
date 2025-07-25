import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { UserService } from '../user/user.service';
import { SearchRecipeDto } from './dto/recipe.dto';
import { ElasticsearchRecipe, SearchOptions, SearchResult } from '../elasticsearch/elasticsearch.service';
import { RecipeMetadataService } from './services/recipe-metadata.service';
import { RecipeUserActionsService } from './services/recipe-user-actions.service';
import { RecipeStatsService } from './services/recipe-stats.service';

interface UserProfileForRecipeService {
  allergies: string[];
  preferences: string[];
  cookingLevel: string;
}

@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly userService: UserService,
    private readonly metadataService: RecipeMetadataService,
    private readonly userActionsService: RecipeUserActionsService,
    private readonly statsService: RecipeStatsService,
  ) {}

  // ================== 레시피 조회 (ES + MongoDB 결합) ==================

  async getRecipeById(recipeId: string, userId?: string): Promise<ElasticsearchRecipe | null> {
    try {
      // 1. Elasticsearch에서 레시피 마스터 데이터 조회
      const esRecipe = await this.elasticsearchService.getRecipeById(recipeId);
      if (!esRecipe) {
        throw new NotFoundException(`Recipe with ID ${recipeId} not found`);
      }

      // 2. MongoDB에서 메타데이터 조회 (병렬)
      const [metadata, userRecipe] = await Promise.all([
        this.metadataService.getOrCreateMetadata(recipeId),
        userId ? this.userActionsService.getUserRecipe(userId, recipeId) : null
      ]);

      // 3. 데이터 결합
      const combinedRecipe: ElasticsearchRecipe = {
        ...esRecipe,
        // 메타데이터 추가
        viewCount: metadata.stats.v,
        likeCount: metadata.stats.l,
        bookmarkCount: metadata.stats.l, // likeCount와 동일하게 처리
        averageRating: metadata.stats.c > 0 ? Math.round((metadata.stats.r / metadata.stats.c) * 10) / 10 : 0,
        ratingCount: metadata.stats.c,
        // 사용자별 데이터 추가
        isBookmarked: userRecipe?.isBookmarked || false,
        userRating: userRecipe?.rating,
        personalNote: userRecipe?.personalNote,
        personalTags: userRecipe?.personalTags || [],
        cookCount: userRecipe?.cookCount || 0,
        lastCookedAt: userRecipe?.lastCookedAt,
      };

      // 4. 조회수 증가 (백그라운드)
      void this.metadataService.incrementViewCount(recipeId).catch(error =>
        this.logger.warn(`Failed to increment view count for ${recipeId}:`, error instanceof Error ? error.message : 'Unknown error')
      );

      return combinedRecipe;
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

      return await this.elasticsearchService.searchRecipes(searchDto.query, options);
    } catch (error: unknown) {
      this.logger.error('Recipe search failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getPopularRecipes(limit: number = 10, _userId?: string): Promise<ElasticsearchRecipe[]> {
    try {
      // 1. MongoDB에서 인기 레시피 ID 조회
      const popularMetadata = await this.metadataService.getPopularMetadata(limit);

      if (popularMetadata.length === 0) {
        // 메타데이터가 없으면 ES에서 직접 조회
        return this.elasticsearchService.getTopRatedRecipes(limit);
      }

      // 2. ES에서 레시피 상세 정보 조회
      const recipeIds = popularMetadata.map(meta => meta.recipeId);
      const recipes = await this.elasticsearchService.getRecipesByIds(recipeIds);

      // 3. 메타데이터와 결합
      const recipesWithMetadata: ElasticsearchRecipe[] = recipes.map(recipe => {
        const metadata = popularMetadata.find(meta => meta.recipeId === recipe.id);
        const averageRating = metadata?.stats?.c && metadata.stats.c > 0 ? Math.round((metadata.stats.r / metadata.stats.c) * 10) / 10 : 0;
        return {
          ...recipe,
          viewCount: metadata?.stats.v || 0,
          likeCount: metadata?.stats.l || 0,
          bookmarkCount: metadata?.stats.l || 0, // likeCount와 동일하게 처리
          averageRating: averageRating,
          ratingCount: metadata?.stats.c || 0,
        };
      });

      this.logger.log(`Fetched ${recipesWithMetadata.length} popular recipes`);
      return recipesWithMetadata;
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
      return await this.elasticsearchService.getRecommendedRecipes(userId, userProfileForES.preferences, userProfileForES.allergies, limit);
    } catch (error: unknown) {
      this.logger.error('Personalized recommendations failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getSimilarRecipes(recipeId: string, limit: number = 5): Promise<ElasticsearchRecipe[]> {
    try {
      return await this.elasticsearchService.getSimilarRecipes(recipeId, limit);
    } catch (error: unknown) {
      this.logger.error(`Similar recipes search failed for ${recipeId}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      return await this.elasticsearchService.getSearchSuggestions(query, limit);
    } catch (error: unknown) {
      this.logger.error(`Suggestions failed for query "${query}":`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  // ================== 위임된 메서드들 ==================

  async toggleBookmark(id: string, userId: string) {
    return this.userActionsService.toggleBookmark(id, userId);
  }

  async rateRecipe(id: string, userId: string, rating: number) {
    return this.userActionsService.rateRecipe(id, userId, rating);
  }

  async addPersonalNote(id: string, userId: string, note: string) {
    return this.userActionsService.addPersonalNote(userId, id, note);
  }

  async markAsCooked(id: string, userId: string) {
    return this.userActionsService.markAsCooked(userId, id);
  }

  async getUserBookmarks(userId: string, page: number, limit: number) {
    return this.userActionsService.getUserBookmarks(userId, page, limit);
  }

  async getRecipeStats() {
    return this.statsService.getRecipeStats();
  }
}