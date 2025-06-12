import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { IngredientService } from './ingredient.service';

@Controller('ingredients')
export class IngredientController {
  constructor(private readonly ingredientService: IngredientService) {}

  @Post('check-allergies')
  async checkAllergies(@Body() body: { ingredients: string[]; allergies: string[] }) {
    return this.ingredientService.checkAllergies(body.ingredients, body.allergies);
  }

  @Get('allergies')
  async getAllergens() {
    return {
      allergens: await this.ingredientService.getAllAvailableAllergens()
    };
  }

  @Get('search')
  async search(@Query('q') query: string, @Query('limit') limit?: string) {
    return this.ingredientService.searchIngredients(query, limit ? parseInt(limit) : 20);
  }
}