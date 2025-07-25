import { Injectable, Logger } from '@nestjs/common';
import { RecipeMetadataService } from './recipe-metadata.service';

@Injectable()
export class RecipeStatsService {
    private readonly logger = new Logger(RecipeStatsService.name);

    constructor(private readonly metadataService: RecipeMetadataService) {}

    async getRecipeStats(): Promise<{
        totalRecipes: number;
        totalViews: number;
        totalLikes: number;
        averageRating: number;
        topRatedRecipeIds: string[];
    }> {
        try {
            const stats = await this.metadataService.getAllMetadataStats();

            return {
                totalRecipes: stats.totalRecipes,
                totalViews: stats.totalViews,
                totalLikes: stats.totalLikes,
                averageRating: stats.avgRating,
                topRatedRecipeIds: stats.topRated.map(r => r.recipeId)
            };
        } catch (error: unknown) {
            this.logger.error('Recipe stats generation failed:', error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }
}