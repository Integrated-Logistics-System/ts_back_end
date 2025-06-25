import { Controller, Post, Get, Body, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RecipeService } from './recipe.service';

@ApiTags('Recipe')
@Controller('recipe')
export class RecipeController {
  private readonly logger = new Logger(RecipeController.name);
  
  constructor(private readonly recipeService: RecipeService) {}

  @Post('search')
  @ApiOperation({ summary: 'Search recipes' })
  @ApiResponse({ status: 200, description: 'Recipes found successfully' })
  async searchRecipes(
    @Body() body: { query: string; page?: number; limit?: number }
  ) {
    try {
      const result = await this.recipeService.searchRecipes(
        body.query,
        body.page || 1,
        body.limit || 10
      );
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Recipe search error: ${error.message}`);
      return {
        success: false,
        error: 'Recipe search failed',
        data: { recipes: [], total: 0 }
      };
    }
  }

  @Get('detail/:id')
  @ApiOperation({ summary: 'Get recipe details' })
  @ApiResponse({ status: 200, description: 'Recipe details retrieved successfully' })
  async getRecipeDetail(@Param('id') id: string) {
    this.logger.log(`Getting recipe details: ID = ${id}`);
    
    try {
      const recipe = await this.recipeService.getRecipeById(id);
      
      if (!recipe) {
        return {
          success: false,
          error: `Recipe with ID ${id} not found`,
          data: null
        };
      }
      
      this.logger.log(`Recipe details found: ${recipe.name}`);
      return {
        success: true,
        data: recipe
      };
    } catch (error) {
      this.logger.error(`Recipe detail error: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get recipe details',
        data: null
      };
    }
  }

  // ❌ 복잡한 기능들은 주석 처리 - LangChain으로 대체
  /*
  @Get('popular')
  @ApiOperation({ summary: 'Get popular recipes' })
  @ApiResponse({ status: 200, description: 'Popular recipes retrieved successfully' })
  async getPopularRecipes(@Query('limit') limit: number = 10) {
    try {
      const result = await this.recipeService.getPopularRecipes(limit);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Popular recipes error: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get popular recipes',
        data: { recipes: [] }
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get recipe statistics' })
  @ApiResponse({ status: 200, description: 'Recipe stats retrieved successfully' })
  async getRecipeStats() {
    try {
      const stats = await this.recipeService.getRecipeStats();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.logger.error(`Recipe stats error: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get recipe stats',
        data: { totalRecipes: 0 }
      };
    }
  }

  @Post('recommendations')
  @ApiOperation({ summary: 'Get personalized recipe recommendations' })
  @ApiResponse({ status: 200, description: 'Recommendations generated successfully' })
  async getRecommendations(
    @Body() body: { preferences?: string[]; allergies?: string[] }
  ) {
    try {
      const result = await this.recipeService.getRecommendedRecipes(
        body.preferences || [],
        body.allergies || []
      );
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Recipe recommendations error: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get recommendations',
        data: { recipes: [] }
      };
    }
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get recipes by category' })
  @ApiResponse({ status: 200, description: 'Category recipes retrieved successfully' })
  async getRecipesByCategory(
    @Param('category') category: string,
    @Query('limit') limit: number = 10
  ) {
    try {
      const result = await this.recipeService.getRecipesByCategory(category, limit);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Category recipes error: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get category recipes',
        data: { recipes: [] }
      };
    }
  }
  */
}
