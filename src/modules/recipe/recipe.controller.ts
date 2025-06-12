import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { CreateRecipeDto, SearchRecipeDto, RecipeByIngredientsDto } from './dto/recipe.dto';

@Controller('recipes')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Post()
  async create(@Body() createRecipeDto: CreateRecipeDto) {
    return this.recipeService.create(createRecipeDto);
  }

  @Get('search')
  async search(@Query() searchDto: SearchRecipeDto) {
    return this.recipeService.search(searchDto);
  }

  @Post('by-ingredients')
  async findByIngredients(@Body() dto: RecipeByIngredientsDto) {
    return this.recipeService.findByIngredients(dto);
  }

  @Get('popular')
  async getPopular(@Query('limit') limit?: string) {
    return this.recipeService.getPopular(limit ? parseInt(limit) : 10);
  }

  @Get('healthy')
  async getHealthy(@Query('limit') limit?: string) {
    return this.recipeService.getHealthyRecipes(limit ? parseInt(limit) : 10);
  }

  @Get('low-calorie')
  async getLowCalorie(
    @Query('maxCalories') maxCalories?: string,
    @Query('limit') limit?: string
  ) {
    return this.recipeService.getLowCalorieRecipes(
      maxCalories ? parseInt(maxCalories) : 300,
      limit ? parseInt(limit) : 10
    );
  }

  @Get('recommendations/:userId')
  async getRecommendations(
    @Param('userId') userId: string,
    @Query('allergies') allergies?: string,
  ) {
    const allergiesList = allergies ? allergies.split(',') : [];
    return this.recipeService.getRecommendations(userId, allergiesList);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.recipeService.findById(parseInt(id));
  }
}