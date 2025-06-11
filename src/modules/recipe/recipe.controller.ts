import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { RecipeService } from './recipe.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { SearchRecipeDto } from './dto/search-recipe.dto';

@ApiTags('Recipes')
@Controller('recipes')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new recipe' })
  @ApiResponse({ status: 201, description: 'Recipe created successfully' })
  create(@Body() createRecipeDto: CreateRecipeDto) {
    return this.recipeService.create(createRecipeDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Search and filter recipes',
    description:
      'Search recipes using traditional text search or semantic vector search',
  })
  @ApiResponse({ status: 200, description: 'Recipes retrieved successfully' })
  findAll(@Query() searchDto: SearchRecipeDto) {
    return this.recipeService.findAll(searchDto);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular recipes' })
  @ApiResponse({ status: 200, description: 'Popular recipes retrieved' })
  getPopular(@Query('limit') limit?: number) {
    return this.recipeService.getPopularRecipes(limit);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent recipes' })
  @ApiResponse({ status: 200, description: 'Recent recipes retrieved' })
  getRecent(@Query('limit') limit?: number) {
    return this.recipeService.getRecentRecipes(limit);
  }

  @Get('by-ingredients')
  @ApiOperation({
    summary: 'Find recipes by ingredients',
    description:
      'Uses semantic search to find recipes that contain the specified ingredients',
  })
  @ApiResponse({ status: 200, description: 'Recipes found by ingredients' })
  findByIngredients(@Query('ingredients') ingredients: string[]) {
    const ingredientList = Array.isArray(ingredients)
      ? ingredients
      : [ingredients];
    return this.recipeService.findByIngredients(ingredientList);
  }

  @Get(':id/similar')
  @ApiOperation({
    summary: 'Find similar recipes',
    description:
      'Uses vector similarity to find recipes similar to the specified recipe',
  })
  @ApiParam({
    name: 'id',
    description: 'Recipe ID to find similar recipes for',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of similar recipes to return',
    required: false,
    example: 5,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Similar recipes found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        message: { type: 'string', example: 'Similar recipes found' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Recipe not found' })
  async findSimilar(
    @Param('id') id: string,
    @Query('limit') limit: number = 5,
  ) {
    try {
      const similarRecipes = await this.recipeService.findSimilarRecipes(
        id,
        limit,
      );

      return {
        success: true,
        data: similarRecipes,
        message: 'Similar recipes found',
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('reindex')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reindex all recipes for vector search',
    description:
      'Recreates vector embeddings for all recipes. Use with caution as this operation takes time.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reindexing completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'All recipes reindexed successfully',
        },
      },
    },
  })
  async reindexRecipes() {
    try {
      await this.recipeService.reindexAllRecipes();

      return {
        success: true,
        message: 'All recipes reindexed successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recipe by ID' })
  @ApiResponse({ status: 200, description: 'Recipe retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Recipe not found' })
  findOne(@Param('id') id: string) {
    return this.recipeService.findById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update recipe' })
  @ApiResponse({ status: 200, description: 'Recipe updated successfully' })
  @ApiResponse({ status: 404, description: 'Recipe not found' })
  update(@Param('id') id: string, @Body() updateRecipeDto: UpdateRecipeDto) {
    return this.recipeService.update(id, updateRecipeDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete recipe' })
  @ApiResponse({ status: 200, description: 'Recipe deleted successfully' })
  @ApiResponse({ status: 404, description: 'Recipe not found' })
  remove(@Param('id') id: string) {
    return this.recipeService.remove(id);
  }

  @Patch(':id/rating')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update recipe rating' })
  @ApiResponse({ status: 200, description: 'Rating updated successfully' })
  updateRating(@Param('id') id: string, @Body('rating') rating: number) {
    return this.recipeService.updateRating(id, rating);
  }
}
