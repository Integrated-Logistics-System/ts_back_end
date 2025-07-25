import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RecipeMetadata, RecipeMetadataDocument } from '../recipe-metadata.schema';

@Injectable()
export class RecipeMetadataService {
    private readonly logger = new Logger(RecipeMetadataService.name);

    constructor(
        @InjectModel(RecipeMetadata.name) private recipeMetadataModel: Model<RecipeMetadataDocument>,
    ) {}

    async getOrCreateMetadata(recipeId: string): Promise<RecipeMetadataDocument> {
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

    async updateBookmarkCount(recipeId: string, increment: number): Promise<RecipeMetadataDocument | null> {
        return this.recipeMetadataModel.findOneAndUpdate(
            { recipeId },
            {
                $inc: { 'stats.l': increment },
                $setOnInsert: {
                    recipeId,
                    'stats.v': 0,
                    'stats.r': 0,
                    'stats.c': 0,
                    isActive: true
                }
            },
            { upsert: true, new: true }
        ).exec();
    }

    async updateRatingStats(recipeId: string, ratingDelta: number, countDelta: number): Promise<RecipeMetadataDocument | null> {
        return this.recipeMetadataModel.findOneAndUpdate(
            { recipeId },
            {
                $inc: { 'stats.r': ratingDelta, 'stats.c': countDelta },
                $setOnInsert: {
                    recipeId,
                    'stats.v': 0,
                    'stats.l': 0,
                    isActive: true
                }
            },
            { upsert: true, new: true }
        ).exec();
    }

    async getPopularMetadata(limit: number): Promise<RecipeMetadataDocument[]> {
        return this.recipeMetadataModel
            .find({ isActive: true })
            .sort({ 'stats.l': -1, 'stats.v': -1 }) // stats.l (likeCount)와 stats.v (viewCount)로 정렬
            .limit(limit)
            .lean()
            .exec() as Promise<RecipeMetadataDocument[]>;
    }

    async getAllMetadataStats(): Promise<{
        totalRecipes: number;
        totalViews: number;
        totalLikes: number;
        avgRating: number;
        topRated: RecipeMetadataDocument[];
    }> {
        const [
            totalRecipes,
            totalViews,
            totalLikes,
            avgRating,
            topRated
        ] = await Promise.all([
            this.recipeMetadataModel.countDocuments({ isActive: true }),

            this.recipeMetadataModel.aggregate([
                { $group: { _id: null, total: { $sum: '$stats.v' } } }
            ]),

            this.recipeMetadataModel.aggregate([
                { $group: { _id: null, total: { $sum: '$stats.l' } } }
            ]),

            this.recipeMetadataModel.aggregate([
                { $match: { 'stats.c': { $gt: 0 } } },
                { $group: { _id: null, avg: { $avg: { $divide: ['$stats.r', '$stats.c'] } } } }
            ]),

            this.recipeMetadataModel
                .find({ 'stats.c': { $gte: 5 } })
                .sort({ 'stats.r': -1, 'stats.c': -1 })
                .limit(10)
                .lean()
        ]);

        return {
            totalRecipes,
            totalViews: (totalViews[0] as { total?: number })?.total || 0,
            totalLikes: (totalLikes[0] as { total?: number })?.total || 0,
            avgRating: Math.round(((avgRating[0] as { avg?: number })?.avg || 0) * 10) / 10,
            topRated: topRated as RecipeMetadataDocument[]
        };
    }
}