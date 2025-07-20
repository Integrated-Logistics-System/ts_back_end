import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RecipeService } from './recipe.service';
import { SearchRecipeDto, RateRecipeDto, AddPersonalNoteDto } from './dto/recipe.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ServiceResponse } from '../../shared/interfaces/common.interface';
import { ElasticsearchRecipe } from '../elasticsearch/elasticsearch.service';

@ApiTags('Recipes')
@Controller('recipes')
export class RecipeController {
  private readonly logger = new Logger(RecipeController.name);

  constructor(private readonly recipeService: RecipeService) {}

  @Post('search')
  @Public()
  @ApiOperation({ summary: 'Search recipes with filters' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchRecipes(
      @Body() searchDto: SearchRecipeDto,
      @Request() req?: { user?: { id: string; }; }
  ): Promise<ServiceResponse<{ recipes: ElasticsearchRecipe[]; total: number; page: number; limit: number; }>> {
    try {
      const userId = req?.user?.id;
      const result = await this.recipeService.searchRecipes(searchDto, userId);

      return {
        success: true,
        data: result
      };
    } catch (error: unknown) {
      this.logger.error(`Recipe search error:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          recipes: [],
          total: 0,
          page: searchDto.page || 1,
          limit: searchDto.limit || 10
        }
      };
    }
  }

  @Get('popular')
  @Public()
  @ApiOperation({ summary: 'Get popular recipes' })
  @ApiResponse({ status: 200, description: 'Popular recipes retrieved successfully' })
  async getPopular(
      @Query('limit') limit: number = 10,
      @Request() req?: { user?: { id: string; }; }
  ): Promise<ServiceResponse<ElasticsearchRecipe[]>> {
    try {
      const userId = req?.user?.id;
      const recipes = await this.recipeService.getPopularRecipes(limit, userId);
      return {
        success: true,
        data: recipes
      };
    } catch (error: unknown) {
      this.logger.error(`Popular recipes error:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to get popular recipes',
        data: []
      };
    }
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized recommendations' })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecommendations(
      @Request() req: { user: { id: string; }; },
      @Query('limit') limit: number = 10
  ): Promise<ServiceResponse<ElasticsearchRecipe[]>> {
    try {
      const userId = req.user.id;
      const recipes = await this.recipeService.getPersonalizedRecommendations(userId, limit);

      return {
        success: true,
        data: recipes,
        message: `Generated ${recipes.length} personalized recommendations`
      };
    } catch (error: unknown) {
      this.logger.error(`Recommendations error:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to get recommendations',
        data: []
      };
    }
  }

  @Get('suggestions')
  @Public()
  @ApiOperation({ summary: 'Get search suggestions' })
  @ApiResponse({ status: 200, description: 'Suggestions retrieved successfully' })
  async getSuggestions(
      @Query('q') query: string,
      @Query('limit') limit: number = 5
  ): Promise<ServiceResponse<string[]>> {
    try {
      if (!query || query.length < 2) {
        return {
          success: true,
          data: []
        };
      }

      const suggestions = await this.recipeService.getSuggestions(query, limit);

      return {
        success: true,
        data: suggestions
      };
    } catch (error: unknown) {
      this.logger.error(`Suggestions error:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to get suggestions',
        data: []
      };
    }
  }

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Get recipe statistics' })
  @ApiResponse({ status: 200, description: 'Stats retrieved successfully' })
  async getStats(): Promise<ServiceResponse<{ [key: string]: unknown }>> {
    try {
      const stats = await this.recipeService.getRecipeStats();
      return {
        success: true,
        data: stats
      };
    } catch (error: unknown) {
      this.logger.error(`Stats error:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to get stats',
        data: {}
      };
    }
  }

  @Get('bookmarks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user bookmarks' })
  @ApiResponse({ status: 200, description: 'Bookmarks retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserBookmarks(
      @Request() req: { user: { id: string; }; },
      @Query('page') page: number = 1,
      @Query('limit') limit: number = 10
  ): Promise<ServiceResponse<{ recipes: ElasticsearchRecipe[]; total: number; }>> {
    try {
      const userId = req.user.id;
      const result = await this.recipeService.getUserBookmarks(userId, page, limit);

      return {
        success: true,
        data: result
      };
    } catch (error: unknown) {
      this.logger.error(`Bookmarks error:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to get bookmarks',
        data: { recipes: [], total: 0 }
      };
    }
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get recipe by ID' })
  @ApiResponse({ status: 200, description: 'Recipe retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Recipe not found' })
  async findById(
      @Param('id') id: string,
      @Request() req?: { user?: { id: string; }; }
  ): Promise<ServiceResponse<ElasticsearchRecipe>> {
    try {
      const userId = req?.user?.id;
      const recipe = await this.recipeService.getRecipeById(id, userId);

      return {
        success: true,
        data: recipe || undefined
      };
    } catch (error: unknown) {
      this.logger.error(`Recipe retrieval error for ID ${id}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: (error instanceof Error ? error.message : 'Unknown error') || 'Recipe not found',
        data: undefined
      };
    }
  }

  @Get(':id/similar')
  @Public()
  @ApiOperation({ summary: 'Get similar recipes' })
  @ApiResponse({ status: 200, description: 'Similar recipes retrieved successfully' })
  async getSimilar(
      @Param('id') id: string,
      @Query('limit') limit: number = 5
  ): Promise<ServiceResponse<ElasticsearchRecipe[]>> {
    try {
      const recipes = await this.recipeService.getSimilarRecipes(id, limit);

      return {
        success: true,
        data: recipes
      };
    } catch (error: unknown) {
      this.logger.error(`Similar recipes error for ID ${id}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to get similar recipes',
        data: []
      };
    }
  }

  @Post(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bookmark/unbookmark a recipe' })
  @ApiResponse({ status: 200, description: 'Recipe bookmark status updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async toggleBookmark(
      @Param('id') id: string,
      @Request() req: { user: { id: string; }; }
  ): Promise<ServiceResponse<{ bookmarked: boolean; message: string; bookmarkCount?: number; }>> {
    try {
      const userId = req.user.id;
      const result = await this.recipeService.toggleBookmark(id, userId);

      return {
        success: true,
        data: result
      };
    } catch (error: unknown) {
      this.logger.error(`Toggle bookmark error for ID ${id}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to toggle bookmark'
      };
    }
  }

  @Post(':id/rate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate a recipe' })
  @ApiResponse({ status: 200, description: 'Recipe rated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async rateRecipe(
      @Param('id') id: string,
      @Body() rateDto: RateRecipeDto,
      @Request() req: { user: { id: string; }; }
  ): Promise<ServiceResponse<{ success: boolean; userRating: number; averageRating: number; ratingCount: number; previousRating?: number; }>> {
    try {
      const userId = req.user.id;
      const result = await this.recipeService.rateRecipe(id, userId, rateDto.rating);

      return {
        success: true,
        data: result
      };
    } catch (error: unknown) {
      this.logger.error(`Rate recipe error for ID ${id}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: (error instanceof Error ? error.message : 'Unknown error') || 'Failed to rate recipe'
      };
    }
  }

  @Post(':id/note')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add personal note to recipe' })
  @ApiResponse({ status: 200, description: 'Personal note added successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addPersonalNote(
      @Param('id') id: string,
      @Body() noteDto: AddPersonalNoteDto,
      @Request() req: { user: { id: string; }; }
  ): Promise<ServiceResponse<{ success: boolean; message: string; note: string; }>> {
    try {
      const userId = req.user.id;
      const result = await this.recipeService.addPersonalNote(id, userId, noteDto.note);

      return {
        success: true,
        data: result
      };
    } catch (error: unknown) {
      this.logger.error(`Add note error for ID ${id}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to add personal note'
      };
    }
  }

  @Post(':id/cooked')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark recipe as cooked' })
  @ApiResponse({ status: 200, description: 'Recipe marked as cooked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsCooked(
      @Param('id') id: string,
      @Request() req: { user: { id: string; }; }
  ): Promise<ServiceResponse<{ success: boolean; message: string; cookCount: number; lastCookedAt?: Date; }>> {
    try {
      const userId = req.user.id;
      const result = await this.recipeService.markAsCooked(id, userId);

      return {
        success: true,
        data: result
      };
    } catch (error: unknown) {
      this.logger.error(`Mark cooked error for ID ${id}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to mark recipe as cooked'
      };
    }
  }
}
