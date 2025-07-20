import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RecipeMetadata, RecipeMetadataDocument } from './recipe-metadata.schema';
import { UserRecipe, UserRecipeDocument } from './user-recipe.schema';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
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
      @InjectModel(RecipeMetadata.name) private recipeMetadataModel: Model<RecipeMetadataDocument>,
      @InjectModel(UserRecipe.name) private userRecipeModel: Model<UserRecipeDocument>,
      private readonly elasticsearchService: ElasticsearchService,
      private readonly userService: UserService,
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
        this.getOrCreateMetadata(recipeId),
        userId ? this.getUserRecipe(userId, recipeId) : null
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
      void this.incrementViewCount(recipeId).catch(error =>
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
      const popularMetadata = await this.recipeMetadataModel
          .find({ isActive: true })
          .sort({ 'stats.l': -1, 'stats.v': -1 }) // stats.l (likeCount)와 stats.v (viewCount)로 정렬
          .limit(limit)
          .lean()
          .exec();

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

  // ================== 메타데이터 관리 ==================

  // TODO: MinimalMetadataSchema와 RecipeMetadataSchema 통합 또는 역할 명확화
  // 현재는 RecipeMetadataSchema가 사용되고 MinimalMetadataSchema는 사용되지 않는 것으로 보임.
  // 만약 MinimalMetadataSchema가 특정 목적(예: 통계 압축)으로 사용된다면, 그 역할을 명확히 하고 중복을 제거해야 함.
  // -> MinimalMetadataSchema는 삭제되었고, RecipeMetadataSchema로 통합되었음.
  async incrementViewCount(recipeId: string): Promise<void> {
    try {
      await this.recipeMetadataModel
          .findOneAndUpdate(
              { recipeId },
              {
                $inc: { 'stats.v': 1 },
                $setOnInsert: {
                  recipeId,
                  'stats.l': 0,
                  'stats.r': 0,
                  'stats.c': 0,
                  isActive: true
                }
              },
              { upsert: true, new: true }
          )
          .exec();
    } catch (error: unknown) {
      this.logger.warn(`View count increment failed for ${recipeId}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // TODO: 'like'와 'bookmark'의 의미를 명확히 하고, 필요시 별도의 메서드로 분리
  // 현재 likeRecipe 메서드가 isBookmarked 필드를 사용하고 있어 혼란의 여지가 있음.
  // '좋아요'와 '북마크'가 동일한 기능이라면 명칭을 'toggleBookmark' 등으로 통일하는 것이 좋음.
  // -> 현재는 likeCount와 bookmarkCount를 stats.l로 통합하여 관리하고 있음. 명칭은 유지하되, 내부 로직은 통합된 필드를 사용.
  async toggleBookmark(recipeId: string, userId: string): Promise<{
    bookmarked: boolean;
    message: string;
    bookmarkCount?: number;
  }> {
    try {
      // 1. 사용자가 이미 북마크를 눌렀는지 확인
      const userRecipe = await this.userRecipeModel.findOne({ userId, recipeId });

      if (userRecipe?.isBookmarked) {
        // 이미 북마크한 경우 취소
        await this.userRecipeModel.findOneAndUpdate(
            { userId, recipeId },
            { isBookmarked: false, updatedAt: new Date() }
        );

        await this.recipeMetadataModel.findOneAndUpdate(
            { recipeId },
            { $inc: { 'stats.l': -1 } } // stats.l 감소
        );

        return { bookmarked: false, message: 'Recipe unbookmarked', bookmarkCount: (await this.getOrCreateMetadata(recipeId)).stats.l };
      } else {
        // 북마크 추가
        await this.userRecipeModel.findOneAndUpdate(
            { userId, recipeId },
            {
              isBookmarked: true,
              updatedAt: new Date(),
              $setOnInsert: {
                userId,
                recipeId,
                personalTags: [],
                cookCount: 0
              }
            },
            { upsert: true }
        );

        const metadata = await this.recipeMetadataModel.findOneAndUpdate(
            { recipeId },
            {
              $inc: { 'stats.l': 1 }, // stats.l 증가
              $setOnInsert: {
                recipeId,
                'stats.v': 0,
                'stats.r': 0,
                'stats.c': 0,
                isActive: true
              }
            },
            { upsert: true, new: true }
        );

        return {
          bookmarked: true,
          message: 'Recipe bookmarked',
          bookmarkCount: metadata?.stats.l
        };
      }
    } catch (error: unknown) {
      this.logger.error(`Toggle bookmark failed for ${recipeId}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async rateRecipe(recipeId: string, userId: string, rating: number): Promise<{
    success: boolean;
    userRating: number;
    averageRating: number;
    ratingCount: number;
    previousRating?: number;
  }> {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      // 1. 사용자 평점 업데이트
      const previousUserRecipe = await this.userRecipeModel.findOne({ userId, recipeId });
      const previousRating = previousUserRecipe?.rating;

      await this.userRecipeModel.findOneAndUpdate(
          { userId, recipeId },
          {
            rating,
            updatedAt: new Date(),
            $setOnInsert: {
              userId,
              recipeId,
              isBookmarked: false,
              personalTags: [],
              cookCount: 0
            }
          },
          { upsert: true }
      );

      // 2. 전체 평점 재계산 (현재 미사용)

      // 3. 메타데이터 업데이트
      const metadata = await this.recipeMetadataModel.findOneAndUpdate(
          { recipeId },
          {
            $inc: { 'stats.r': rating - (previousRating || 0), 'stats.c': previousRating ? 0 : 1 }, // 평점 합계 업데이트, 새 평점이면 카운트 증가
            $setOnInsert: {
              recipeId,
              'stats.v': 0,
              'stats.l': 0,
              isActive: true
            }
          },
          { upsert: true, new: true }
      );

      const updatedAverageRating = metadata.stats.c > 0 ? Math.round((metadata.stats.r / metadata.stats.c) * 10) / 10 : 0;

      this.logger.log(`Recipe ${recipeId} rated ${rating} by user ${userId}`);
      return {
        success: true,
        userRating: rating,
        averageRating: updatedAverageRating,
        ratingCount: metadata.stats.c,
        previousRating
      };
    } catch (error: unknown) {
      this.logger.error(`Rate recipe failed for ${recipeId}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // ================== 사용자별 레시피 관리 ==================

  async getUserBookmarks(userId: string, page: number = 1, limit: number = 10): Promise<{
    recipes: ElasticsearchRecipe[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const skip = (page - 1) * limit;

      // 1. 사용자 북마크 조회
      const userRecipes = await this.userRecipeModel
          .find({ userId, isBookmarked: true })
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec();

      if (userRecipes.length === 0) {
        return { recipes: [], total: 0, page, limit };
      }

      // 2. ES에서 레시피 상세 정보 조회
      const recipeIds = userRecipes.map(ur => ur.recipeId);
      const recipes = await this.elasticsearchService.getRecipesByIds(recipeIds);

      // 3. 사용자 데이터와 결합
      const bookmarkedRecipes: ElasticsearchRecipe[] = recipes.map(recipe => {
        const userRecipe = userRecipes.find(ur => ur.recipeId === recipe.id);
        return {
          ...recipe,
          personalNote: userRecipe?.personalNote,
          personalTags: userRecipe?.personalTags || [],
          userRating: userRecipe?.rating,
          cookCount: userRecipe?.cookCount || 0,
          bookmarkedAt: userRecipe?.updatedAt,
        };
      });

      const total = await this.userRecipeModel.countDocuments({ userId, isBookmarked: true });

      return {
        recipes: bookmarkedRecipes,
        total,
        page,
        limit
      };
    } catch (error: unknown) {
      this.logger.error(`Get user bookmarks failed for ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async addPersonalNote(userId: string, recipeId: string, note: string): Promise<{
    success: boolean;
    message: string;
    note: string;
  }> {
    try {
      await this.userRecipeModel.findOneAndUpdate(
          { userId, recipeId },
          {
            personalNote: note,
            updatedAt: new Date(),
            $setOnInsert: {
              userId,
              recipeId,
              isBookmarked: false,
              personalTags: [],
              cookCount: 0
            }
          },
          { upsert: true }
      );

      return {
        success: true,
        message: 'Personal note added',
        note
      };
    } catch (error: unknown) {
      this.logger.error(`Add personal note failed:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async markAsCooked(userId: string, recipeId: string): Promise<{
    success: boolean;
    message: string;
    cookCount: number;
    lastCookedAt?: Date;
  }> {
    try {
      const userRecipe = await this.userRecipeModel.findOneAndUpdate(
          { userId, recipeId },
          {
            $inc: { cookCount: 1 },
            lastCookedAt: new Date(),
            updatedAt: new Date(),
            $setOnInsert: {
              userId,
              recipeId,
              isBookmarked: false,
              personalTags: []
            }
          },
          { upsert: true, new: true }
      );

      return {
        success: true,
        message: 'Recipe marked as cooked',
        cookCount: userRecipe?.cookCount || 0,
        lastCookedAt: userRecipe?.lastCookedAt
      };
    } catch (error: unknown) {
      this.logger.error(`Mark as cooked failed:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // ================== 보조 메서드 ==================

  private async getOrCreateMetadata(recipeId: string): Promise<RecipeMetadataDocument> {
    const metadata = await this.recipeMetadataModel.findOne({ recipeId }).lean().exec();

    if (!metadata) {
      // 메타데이터가 없으면 생성
      const newMetadata = await this.recipeMetadataModel.create({
        recipeId,
        stats: {
          v: 0,
          l: 0,
          r: 0,
          c: 0
        },
        isActive: true
      });
      return newMetadata.toObject() as RecipeMetadataDocument;
    }

    return metadata as RecipeMetadataDocument;
  }

  private async getUserRecipe(userId: string, recipeId: string): Promise<UserRecipeDocument | null> {
    return this.userRecipeModel.findOne({ userId, recipeId }).lean().exec();
  }

  // ================== 통계 ==================

  async getRecipeStats(): Promise<{
    totalRecipes: number;
    totalViews: number;
    totalLikes: number;
    averageRating: number;
    topRatedRecipeIds: string[];
  }> {
    try {
      const [
        totalRecipes,
        totalViews,
        totalLikes,
        avgRating,
        topRated
      ] = await Promise.all([
        this.recipeMetadataModel.countDocuments({ isActive: true }),

        this.recipeMetadataModel.aggregate([
          { $group: { _id: null, total: { $sum: '$stats.v' } } } // stats.v 사용
        ]),

        this.recipeMetadataModel.aggregate([
          { $group: { _id: null, total: { $sum: '$stats.l' } } } // stats.l 사용
        ]),

        this.recipeMetadataModel.aggregate([
          { $match: { 'stats.c': { $gt: 0 } } }, // stats.c 사용
          { $group: { _id: null, avg: { $avg: { $divide: ['$stats.r', '$stats.c'] } } } } // stats.r, stats.c 사용
        ]),

        this.recipeMetadataModel
            .find({ 'stats.c': { $gte: 5 } }) // stats.c 사용
            .sort({ 'stats.r': -1, 'stats.c': -1 }) // stats.r, stats.c 사용
            .limit(10)
            .lean()
      ]);

      return {
        totalRecipes: totalRecipes,
        totalViews: (totalViews[0] as { total?: number })?.total || 0,
        totalLikes: (totalLikes[0] as { total?: number })?.total || 0,
        averageRating: Math.round(((avgRating[0] as { avg?: number })?.avg || 0) * 10) / 10,
        topRatedRecipeIds: topRated.map(r => r.recipeId)
      };
    } catch (error: unknown) {
      this.logger.error('Recipe stats generation failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}
