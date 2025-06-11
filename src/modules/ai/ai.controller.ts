import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { OllamaService } from './services/ollama.service';
import { RecipeRecommendationService } from './services/recipe-recommendation.service';
import { RecommendRecipeDto } from './dto/recommend-recipe.dto';
import { GenerateTextDto } from './dto/generate-text.dto';

@ApiTags('AI Services')
@Controller('ai')
export class AiController {
  constructor(
    private readonly ollamaService: OllamaService,
    private readonly recipeRecommendationService: RecipeRecommendationService,
  ) {}

  @Post('recommend')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI-powered recipe recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Recipe recommendations generated successfully',
  })
  async recommendRecipes(@Body() dto: RecommendRecipeDto) {
    if (!dto.ingredients || dto.ingredients.length === 0) {
      throw new BadRequestException('At least one ingredient is required');
    }

    const request = {
      ingredients: dto.ingredients,
      userPreferences: {
        dietaryRestrictions: dto.dietaryRestrictions,
        cuisineTypes: dto.cuisineTypes,
        cookingSkill: dto.cookingSkill,
        maxCookingTime: dto.maxCookingTime,
      },
      maxResults: dto.maxResults || 5,
    };

    return this.recipeRecommendationService.recommendRecipes(request);
  }

  @Post('generate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate text using Ollama' })
  @ApiResponse({
    status: 200,
    description: 'Text generated successfully',
  })
  async generateText(@Body() dto: GenerateTextDto) {
    const startTime = Date.now();

    const response = await this.ollamaService.generate(dto.prompt, {
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      model: dto.model,
    });

    const processingTime = Date.now() - startTime;

    return {
      response,
      model: dto.model || 'default',
      processingTime,
    };
  }

  @Post('embedding')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate embedding for text' })
  @ApiResponse({
    status: 200,
    description: 'Embedding generated successfully',
  })
  async generateEmbedding(@Body('text') text: string) {
    if (!text) {
      throw new BadRequestException(
        'Text is required for embedding generation',
      );
    }

    const embedding = await this.ollamaService.generateEmbedding(text);

    return {
      embedding,
      dimensions: embedding.length,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check Ollama service health' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  async checkHealth() {
    const isHealthy = await this.ollamaService.checkHealth();
    const models = await this.ollamaService.listModels();

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      models,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('models')
  @ApiOperation({ summary: 'List available Ollama models' })
  @ApiResponse({ status: 200, description: 'Models list retrieved' })
  async listModels() {
    const models = await this.ollamaService.listModels();
    return { models };
  }
}
