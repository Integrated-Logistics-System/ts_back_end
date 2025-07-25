import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRecipe, UserRecipeDocument } from '../user-recipe.schema';
import { RecipeMetadataService } from './recipe-metadata.service';
import { ElasticsearchService, ElasticsearchRecipe } from '../../elasticsearch/elasticsearch.service';

@Injectable()
export class RecipeUserActionsService {
    private readonly logger = new Logger(RecipeUserActionsService.name);

    constructor(
        @InjectModel(UserRecipe.name) private userRecipeModel: Model<UserRecipeDocument>,
        private readonly metadataService: RecipeMetadataService,
        private readonly elasticsearchService: ElasticsearchService,
    ) {}

    async getUserRecipe(userId: string, recipeId: string): Promise<UserRecipeDocument | null> {
        return this.userRecipeModel.findOne({ userId, recipeId }).lean().exec();
    }

    async toggleBookmark(recipeId: string, userId: string): Promise<{
        bookmarked: boolean;
        message: string;
        bookmarkCount?: number;
    }> {
        try {
            const userRecipe = await this.userRecipeModel.findOne({ userId, recipeId });

            if (userRecipe?.isBookmarked) {
                // 이미 북마크한 경우 취소
                await this.userRecipeModel.findOneAndUpdate(
                    { userId, recipeId },
                    { isBookmarked: false, updatedAt: new Date() }
                );

                await this.metadataService.updateBookmarkCount(recipeId, -1);
                const metadata = await this.metadataService.getOrCreateMetadata(recipeId);

                return { 
                    bookmarked: false, 
                    message: 'Recipe unbookmarked', 
                    bookmarkCount: metadata.stats.l 
                };
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

                const metadata = await this.metadataService.updateBookmarkCount(recipeId, 1);

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

            // 2. 메타데이터 업데이트
            const ratingDelta = rating - (previousRating || 0);
            const countDelta = previousRating ? 0 : 1;
            const metadata = await this.metadataService.updateRatingStats(recipeId, ratingDelta, countDelta);

            if (!metadata) {
                throw new Error('Failed to update metadata');
            }

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
}