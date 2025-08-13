import {
  Controller,
  Get,
  Query,
  Param,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RecipeService, Recipe } from './recipe.service';

@ApiTags('Recipes')
@Controller('recipes')
export class RecipeController {
  private readonly logger = new Logger(RecipeController.name);

  constructor(private readonly recipeService: RecipeService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search recipes' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchRecipes(@Query('q') query: string): Promise<Recipe[]> {
    try {
      if (!query) {
        return await this.recipeService.getAllRecipes();
      }
      return await this.recipeService.searchRecipes(query);
    } catch (error: unknown) {
      this.logger.error(`Recipe search error:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all recipes' })
  @ApiResponse({ status: 200, description: 'All recipes retrieved successfully' })
  async getAllRecipes(): Promise<Recipe[]> {
    try {
      return await this.recipeService.getAllRecipes();
    } catch (error: unknown) {
      this.logger.error(`Get all recipes error:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  @Get('recommended')
  @ApiOperation({ summary: 'Get recommended recipes' })
  @ApiResponse({ status: 200, description: 'Recommended recipes retrieved successfully' })
  async getRecommended(@Query('limit') limit: number = 5): Promise<Recipe[]> {
    try {
      return await this.recipeService.getRecommendedRecipes(limit);
    } catch (error: unknown) {
      this.logger.error(`Get recommended recipes error:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recipe by ID' })
  @ApiResponse({ status: 200, description: 'Recipe retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Recipe not found' })
  async findById(@Param('id') id: string): Promise<Recipe | null> {
    try {
      return await this.recipeService.getRecipeById(id);
    } catch (error: unknown) {
      this.logger.error(`Recipe retrieval error for ID ${id}:`, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }
}