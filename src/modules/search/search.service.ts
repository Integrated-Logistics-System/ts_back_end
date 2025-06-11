import { Injectable, Logger } from '@nestjs/common';
import { VectorService } from '../vector/services/vector.service';
import { VectorSourceType } from '../vector/dto/create-vector.dto';
import { RecipeService } from '../recipe/recipe.service';

export interface SearchResult {
  id: string;
  type: 'recipe' | 'ingredient' | 'user';
  title: string;
  description?: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  query: string;
  types?: ('recipe' | 'ingredient' | 'user')[];
  limit?: number;
  threshold?: number;
  useSemanticSearch?: boolean;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly vectorService: VectorService,
    private readonly recipeService: RecipeService,
  ) {}

  async globalSearch(options: SearchOptions): Promise<SearchResult[]> {
    const {
      query,
      types = ['recipe'],
      limit = 10,
      threshold = 0.5,
      useSemanticSearch = true,
    } = options;

    if (!useSemanticSearch) {
      return this.traditionalSearch(options);
    }

    return this.semanticSearch(options);
  }

  private async semanticSearch(
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    const { query, types = ['recipe'], limit, threshold } = options;
    const results: SearchResult[] = [];

    try {
      // Search in vector database
      if (types.includes('recipe')) {
        const vectorResults = await this.vectorService.searchVectors({
          query,
          topK: limit,
          threshold,
          filter: { sourceType: VectorSourceType.RECIPE },
          namespace: 'recipes',
          includeMetadata: true,
          includeContent: false,
        });

        for (const result of vectorResults) {
          if (result.sourceId) {
            try {
              const recipe = await this.recipeService.findById(result.sourceId);
              results.push({
                id: result.sourceId,
                type: 'recipe',
                title: recipe.name,
                description: recipe.description,
                score: result.score,
                metadata: {
                  cookingTime: recipe.cookingTime,
                  difficulty: recipe.difficulty,
                  averageRating: recipe.averageRating,
                  tags: recipe.tags,
                },
              });
            } catch (error) {
              this.logger.warn(`Recipe ${result.sourceId} not found`);
            }
          }
        }
      }

      // Sort by score
      results.sort((a, b) => b.score - a.score);

      return results.slice(0, limit);
    } catch (error) {
      this.logger.error(
        'Semantic search failed, falling back to traditional search',
        error,
      );
      return this.traditionalSearch(options);
    }
  }

  private async traditionalSearch(
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    const { query, types = ['recipe'], limit } = options;
    const results: SearchResult[] = [];

    try {
      if (types.includes('recipe')) {
        const recipeResults = await this.recipeService.findAll({
          query,
          limit,
          useSemanticSearch: false,
        });

        for (const recipe of recipeResults.recipes) {
          results.push({
            id: (recipe._id as any).toString(),
            type: 'recipe',
            title: recipe.name,
            description: recipe.description,
            score: 0.8, // Default score for traditional search
            metadata: {
              cookingTime: recipe.cookingTime,
              difficulty: recipe.difficulty,
              averageRating: recipe.averageRating,
              tags: recipe.tags,
            },
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Traditional search failed', error);
      return [];
    }
  }

  async suggestAutoComplete(
    query: string,
    type: 'recipe' | 'ingredient' = 'recipe',
  ): Promise<string[]> {
    if (type === 'recipe') {
      try {
        const results = await this.recipeService.findAll({
          query,
          limit: 5,
          useSemanticSearch: false,
        });

        return results.recipes.map((recipe) => recipe.name);
      } catch (error) {
        this.logger.error('Auto-complete suggestion failed', error);
        return [];
      }
    }

    return [];
  }
}
