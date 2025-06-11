import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { RecipeService } from '../recipe/recipe.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('data')
export class DataController {
  private readonly logger = new Logger(DataController.name);

  constructor(private readonly recipeService: RecipeService) {}

  @Post('load-recipes')
  async loadRecipes() {
    try {
      this.logger.log('Starting recipe data loading...');
      
      const dataPath = '/Users/choeseonghyeon/smart-recipe-chatbot/data/recipes_sample.json';
      
      if (!fs.existsSync(dataPath)) {
        throw new Error(`Recipe data file not found: ${dataPath}`);
      }

      const rawData = fs.readFileSync(dataPath, 'utf8');
      const recipes = JSON.parse(rawData);

      this.logger.log(`Loading ${recipes.length} recipes...`);

      const result = await this.recipeService.bulkInsertRecipes(recipes);

      this.logger.log(`Recipe loading completed: ${result.success} success, ${result.failed} failed`);

      return {
        success: true,
        message: `Successfully loaded ${result.success} recipes, ${result.failed} failed`,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to load recipes:', error);
      return {
        success: false,
        message: `Failed to load recipes: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Post('load-allergens')
  async loadAllergens() {
    try {
      this.logger.log('Starting allergen data loading...');
      
      const dataPath = '/Users/choeseonghyeon/smart-recipe-chatbot/data/allergens.json';
      
      if (!fs.existsSync(dataPath)) {
        throw new Error(`Allergen data file not found: ${dataPath}`);
      }

      const rawData = fs.readFileSync(dataPath, 'utf8');
      const allergens = JSON.parse(rawData);

      this.logger.log(`Loading ${allergens.length} allergen records...`);

      const result = await this.recipeService.bulkInsertAllergens(allergens);

      this.logger.log(`Allergen loading completed: ${result.success} success, ${result.failed} failed`);

      return {
        success: true,
        message: `Successfully loaded ${result.success} allergen records, ${result.failed} failed`,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to load allergens:', error);
      return {
        success: false,
        message: `Failed to load allergens: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Post('load-all')
  async loadAllData() {
    try {
      this.logger.log('Starting complete data loading...');

      const recipeResult = await this.loadRecipes();
      const allergenResult = await this.loadAllergens();

      return {
        success: recipeResult.success && allergenResult.success,
        message: 'Data loading completed',
        recipes: recipeResult.data,
        allergens: allergenResult.data,
      };
    } catch (error) {
      this.logger.error('Failed to load all data:', error);
      return {
        success: false,
        message: `Failed to load data: ${error.message}`,
        error: error.message,
      };
    }
  }
}
