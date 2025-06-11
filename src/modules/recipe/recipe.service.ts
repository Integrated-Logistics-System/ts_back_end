import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Recipe, RecipeDocument } from './schemas/recipe.schema';
import { Allergen, AllergenDocument } from './schemas/allergen.schema';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { SearchRecipeDto } from './dto/search-recipe.dto';
import { VectorService } from '../vector/services/vector.service';
import { VectorSourceType } from '../vector/dto/create-vector.dto';

@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);

  constructor(
    @InjectModel(Recipe.name) private recipeModel: Model<RecipeDocument>,
    @InjectModel(Allergen.name) private allergenModel: Model<AllergenDocument>,
    private readonly vectorService: VectorService,
  ) {}

  async create(createRecipeDto: CreateRecipeDto): Promise<RecipeDocument> {
    try {
      // 새로운 데이터 구조에 맞게 필드 매핑
      const recipeData = {
        ...createRecipeDto,
        // 호환성을 위한 필드 복사
        cookingTime: createRecipeDto.minutes || createRecipeDto.cookingTime,
        instructions: createRecipeDto.steps || createRecipeDto.instructions,
        contributorId: createRecipeDto.contributor_id?.toString() || createRecipeDto.contributorId,
      };

      const recipe = new this.recipeModel(recipeData);
      const savedRecipe = await recipe.save();

      // Create vector embedding for the recipe
      await this.createRecipeVector(savedRecipe);

      this.logger.log(
        `Created recipe ${savedRecipe._id} with vector embedding`,
      );
      return savedRecipe;
    } catch (error) {
      this.logger.error('Failed to create recipe with vector', error);
      throw error;
    }
  }

  async findAll(searchDto: SearchRecipeDto = {}): Promise<{
    recipes: RecipeDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { useSemanticSearch = false, query } = searchDto;

    if (useSemanticSearch && query) {
      return this.semanticSearch(query, searchDto);
    }

    return this.traditionalSearch(searchDto);
  }

  private async traditionalSearch(searchDto: SearchRecipeDto): Promise<{
    recipes: RecipeDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      query,
      ingredients,
      tags,
      maxCookingTime,
      difficulty,
      dietaryType,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = searchDto;

    // Build filter query
    const filter: any = {};

    if (query) {
      filter.$text = { $search: query };
    }

    if (ingredients && ingredients.length > 0) {
      filter.ingredients = { $in: ingredients };
    }

    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    if (maxCookingTime) {
      filter.$or = [
        { minutes: { $lte: maxCookingTime } },
        { cookingTime: { $lte: maxCookingTime } }
      ];
    }

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (dietaryType && dietaryType !== 'none') {
      filter.dietaryType = dietaryType;
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [recipes, total] = await Promise.all([
      this.recipeModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.recipeModel.countDocuments(filter).exec(),
    ]);

    return {
      recipes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<RecipeDocument> {
    const recipe = await this.recipeModel.findById(id).exec();
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }
    return recipe;
  }

  async findByRecipeId(recipe_id: number): Promise<RecipeDocument> {
    const recipe = await this.recipeModel.findOne({ recipe_id }).exec();
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${recipe_id} not found`);
    }
    return recipe;
  }

  async checkAllergens(ingredients: string[]): Promise<{
    ingredient: string;
    allergens: Record<string, number>;
    note?: string;
  }[]> {
    const allergenResults = [];

    for (const ingredient of ingredients) {
      const allergenInfo = await this.allergenModel
        .findOne({ 
          ingredient_name: { $regex: new RegExp(ingredient, 'i') } 
        })
        .exec();

      if (allergenInfo) {
        allergenResults.push({
          ingredient: ingredient,
          allergens: allergenInfo.allergen_info || {},
          note: allergenInfo.note,
        });
      }
    }

    return allergenResults;
  }

  async getRecipeAllergens(recipeId: string): Promise<{
    ingredient: string;
    allergens: Record<string, number>;
    note?: string;
  }[]> {
    const recipe = await this.findById(recipeId);
    return this.checkAllergens(recipe.ingredients);
  }

  async findByIngredients(ingredients: string[]): Promise<RecipeDocument[]> {
    try {
      // Use semantic search to find recipes by ingredients
      const searchQuery = `Recipes with ingredients: ${ingredients.join(', ')}`;

      const vectorResults = await this.vectorService.searchVectors({
        query: searchQuery,
        topK: 20,
        threshold: 0.6,
        filter: {
          sourceType: VectorSourceType.RECIPE,
          'metadata.ingredients': { $in: ingredients },
        },
        namespace: 'recipes',
        includeMetadata: true,
        includeContent: false,
      });

      // Fetch recipes
      const recipes: RecipeDocument[] = [];
      for (const result of vectorResults) {
        if (result.sourceId) {
          try {
            const recipe = await this.recipeModel
              .findById(result.sourceId)
              .exec();
            if (recipe) {
              recipes.push(recipe);
            }
          } catch (error) {
            this.logger.warn(`Recipe ${result.sourceId} not found`);
          }
        }
      }

      return recipes;
    } catch (error) {
      this.logger.error(
        'Vector search failed for ingredients, using fallback',
        error,
      );
      // Fallback to traditional search
      return this.recipeModel
        .find({ ingredients: { $all: ingredients } })
        .sort({ averageRating: -1 })
        .limit(20)
        .exec();
    }
  }

  private async semanticSearch(
    query: string,
    filters: {
      ingredients?: string[];
      tags?: string[];
      maxCookingTime?: number;
      difficulty?: string;
      dietaryType?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    recipes: RecipeDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const { page = 1, limit = 10 } = filters;

      // Build vector search filter
      const vectorFilter: any = {
        sourceType: VectorSourceType.RECIPE,
      };

      // Add metadata filters
      if (filters.ingredients && filters.ingredients.length > 0) {
        vectorFilter['metadata.ingredients'] = { $in: filters.ingredients };
      }

      if (filters.tags && filters.tags.length > 0) {
        vectorFilter['metadata.tags'] = { $in: filters.tags };
      }

      if (filters.maxCookingTime) {
        vectorFilter['metadata.cookingTime'] = { $lte: filters.maxCookingTime };
      }

      if (filters.difficulty) {
        vectorFilter['metadata.difficulty'] = filters.difficulty;
      }

      if (filters.dietaryType && filters.dietaryType !== 'none') {
        vectorFilter['metadata.dietaryType'] = filters.dietaryType;
      }

      // Search vectors
      const vectorResults = await this.vectorService.searchVectors({
        query,
        topK: limit * 3, // Get more results to account for filtering
        threshold: 0.5,
        filter: vectorFilter,
        namespace: 'recipes',
        includeMetadata: true,
        includeContent: false,
      });

      // Extract recipe IDs
      const recipeIds = vectorResults
        .slice((page - 1) * limit, page * limit)
        .map((result) => result.sourceId)
        .filter((id) => id);

      // Fetch recipes maintaining order
      const recipes: RecipeDocument[] = [];
      for (const recipeId of recipeIds) {
        try {
          const recipe = await this.recipeModel.findById(recipeId).exec();
          if (recipe) {
            recipes.push(recipe);
          }
        } catch (error) {
          this.logger.warn(`Recipe ${recipeId} not found in database`);
        }
      }

      return {
        recipes,
        total: vectorResults.length,
        page,
        totalPages: Math.ceil(vectorResults.length / limit),
      };
    } catch (error) {
      this.logger.error(
        'Semantic search failed, falling back to traditional search',
        error,
      );
      return this.traditionalSearch({ query, ...filters });
    }
  }

  private buildRecipeSearchQuery(recipe: RecipeDocument): string {
    const parts = [
      recipe.name,
      recipe.description || '',
      `Cuisine: ${recipe.cuisine || 'general'}`,
      `Ingredients: ${recipe.ingredients?.join(', ') || ''}`,
      `Steps: ${(recipe.steps || recipe.instructions || []).join(' ')}`,
      `Tags: ${recipe.tags?.join(', ') || ''}`,
      `Difficulty: ${recipe.difficulty || 'medium'}`,
      `Cooking time: ${recipe.minutes || recipe.cookingTime || 0} minutes`,
    ];

    if (recipe.dietaryType && recipe.dietaryType !== 'none') {
      parts.push(`Dietary type: ${recipe.dietaryType}`);
    }

    return parts.filter(Boolean).join('. ');
  }

  private buildRecipeMetadata(recipe: RecipeDocument): Record<string, any> {
    return {
      title: recipe.name,
      cuisine: recipe.cuisine || 'general',
      difficulty: recipe.difficulty || 'medium',
      cookingTime: recipe.minutes || recipe.cookingTime || 0,
      servings: recipe.servings || 1,
      dietaryType: recipe.dietaryType || 'none',
      ingredients: recipe.ingredients || [],
      tags: recipe.tags || [],
      averageRating: recipe.averageRating || 0,
      reviewCount: recipe.reviewCount || 0,
      createdAt: recipe.createdAt || new Date(),
    };
  }

  private async createRecipeVector(recipe: RecipeDocument): Promise<void> {
    try {
      const content = this.buildRecipeSearchQuery(recipe);
      const metadata = this.buildRecipeMetadata(recipe);

      await this.vectorService.createVector({
        content,
        sourceType: VectorSourceType.RECIPE,
        sourceId: recipe._id.toString(),
        metadata,
        namespace: 'recipes',
      });
    } catch (error) {
      this.logger.error(
        `Failed to create vector for recipe ${recipe._id}`,
        error,
      );
      // Don't throw error to prevent recipe creation from failing
    }
  }

  async bulkInsertRecipes(recipes: any[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const recipeData of recipes) {
      try {
        // 데이터 정리 및 매핑
        const cleanedData = {
          recipe_id: recipeData.recipe_id,
          name: recipeData.name,
          description: recipeData.description || '',
          ingredients: recipeData.ingredients || [],
          steps: recipeData.steps || [],
          minutes: recipeData.minutes || 0,
          n_steps: recipeData.n_steps || 0,
          n_ingredients: recipeData.n_ingredients || 0,
          tags: recipeData.tags || [],
          nutrition: recipeData.nutrition || '',
          contributor_id: recipeData.contributor_id || 0,
          submitted: recipeData.submitted || '',
          // 호환성 필드
          cookingTime: recipeData.minutes || 0,
          instructions: recipeData.steps || [],
          contributorId: recipeData.contributor_id?.toString() || '',
          servings: 1,
          difficulty: 'medium',
          dietaryType: 'none',
        };

        const recipe = new this.recipeModel(cleanedData);
        const savedRecipe = await recipe.save();
        
        // 벡터 생성 (실패해도 레시피 저장은 성공으로 처리)
        try {
          await this.createRecipeVector(savedRecipe);
        } catch (vectorError) {
          this.logger.warn(`Vector creation failed for recipe ${savedRecipe._id}:`, vectorError);
        }

        success++;
      } catch (error) {
        this.logger.error(`Failed to insert recipe:`, error);
        failed++;
      }
    }

    this.logger.log(`Bulk insert completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  async bulkInsertAllergens(allergens: any[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const allergenData of allergens) {
      try {
        const allergen = new this.allergenModel(allergenData);
        await allergen.save();
        success++;
      } catch (error) {
        this.logger.error(`Failed to insert allergen:`, error);
        failed++;
      }
    }

    this.logger.log(`Allergen bulk insert completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }
}
