import {
  Controller,
  Post,
  Body,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RAGService } from '../services/rag.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

export class RAGQueryDto {
  question: string;
  maxDocuments?: number = 5;
  relevanceThreshold?: number = 0.7;
  includeContext?: boolean = true;
  model?: string = 'llama3.1';
  temperature?: number = 0.7;
}

export class ConversationalRAGDto extends RAGQueryDto {
  conversationHistory?: Array<{
    question: string;
    answer: string;
  }> = [];
}

export class HybridSearchDto extends RAGQueryDto {
  keywordWeight?: number = 0.3;
  vectorWeight?: number = 0.7;
}

export class ExplainRecipeDto {
  recipeId?: string;
  question: string;
}

export class SuggestVariationsDto {
  recipeId?: string;
  baseIngredients: string[];
  dietaryRestrictions?: string[];
  availableIngredients?: string[];
}

export class CookingTipsDto {
  technique?: string;
  ingredient?: string;
  problem?: string;
  question: string;
}

@ApiTags('RAG (AI Question Answering)')
@Controller('rag')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RAGController {
  private readonly logger = new Logger(RAGController.name);

  constructor(private readonly ragService: RAGService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Ask a question using RAG',
    description:
      'Ask any question and get AI-powered answers based on your recipe knowledge base',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI-generated answer with source citations',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            answer: {
              type: 'string',
              example: '김치찌개를 만들려면 먼저 돼지고기를 볶고...',
            },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  relevanceScore: { type: 'number' },
                  snippet: { type: 'string' },
                },
              },
            },
            confidence: { type: 'number', example: 0.85 },
            context: {
              type: 'object',
              properties: {
                totalRetrieved: { type: 'number' },
                query: { type: 'string' },
              },
            },
          },
        },
        message: { type: 'string', example: 'Question answered successfully' },
      },
    },
  })
  async askQuestion(@Body() queryDto: RAGQueryDto) {
    try {
      const response = await this.ragService.askQuestion(queryDto.question, {
        maxDocuments: queryDto.maxDocuments,
        relevanceThreshold: queryDto.relevanceThreshold,
        includeContext: queryDto.includeContext,
        model: queryDto.model,
        temperature: queryDto.temperature,
      });

      return {
        success: true,
        data: response,
        message: 'Question answered successfully',
      };
    } catch (error) {
      this.logger.error('Failed to process RAG question', error);
      throw error;
    }
  }

  @Post('recipe/ask')
  @ApiOperation({
    summary: 'Ask recipe-specific questions',
    description: 'Ask questions specifically about recipes and cooking',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Recipe-focused AI answer',
  })
  async askRecipeQuestion(@Body() queryDto: RAGQueryDto) {
    try {
      const response = await this.ragService.askRecipeQuestion(
        queryDto.question,
        {
          maxDocuments: queryDto.maxDocuments,
          relevanceThreshold: queryDto.relevanceThreshold,
          includeContext: queryDto.includeContext,
          model: queryDto.model,
          temperature: queryDto.temperature,
        },
      );

      return {
        success: true,
        data: response,
        message: 'Recipe question answered successfully',
      };
    } catch (error) {
      this.logger.error('Failed to process recipe question', error);
      throw error;
    }
  }

  @Post('conversation')
  @ApiOperation({
    summary: 'Conversational RAG with history',
    description: 'Ask questions while maintaining conversation context',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contextual AI answer based on conversation history',
  })
  async conversationalRAG(@Body() queryDto: ConversationalRAGDto) {
    try {
      const response = await this.ragService.askWithConversationHistory(
        queryDto.question,
        queryDto.conversationHistory,
        {
          maxDocuments: queryDto.maxDocuments,
          relevanceThreshold: queryDto.relevanceThreshold,
          includeContext: queryDto.includeContext,
          model: queryDto.model,
          temperature: queryDto.temperature,
        },
      );

      return {
        success: true,
        data: response,
        message: 'Conversational question answered successfully',
      };
    } catch (error) {
      this.logger.error('Failed to process conversational RAG', error);
      throw error;
    }
  }

  @Post('hybrid-search')
  @ApiOperation({
    summary: 'Hybrid search (keyword + vector)',
    description:
      'Advanced search combining keyword matching and semantic similarity',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hybrid search results with AI-generated answer',
  })
  async hybridSearch(@Body() queryDto: HybridSearchDto) {
    try {
      const response = await this.ragService.hybridSearch(queryDto.question, {
        maxDocuments: queryDto.maxDocuments,
        relevanceThreshold: queryDto.relevanceThreshold,
        includeContext: queryDto.includeContext,
        model: queryDto.model,
        temperature: queryDto.temperature,
        keywordWeight: queryDto.keywordWeight,
        vectorWeight: queryDto.vectorWeight,
      });

      return {
        success: true,
        data: response,
        message: 'Hybrid search completed successfully',
      };
    } catch (error) {
      this.logger.error('Failed to process hybrid search', error);
      throw error;
    }
  }

  @Post('explain-recipe')
  @ApiOperation({
    summary: 'Get detailed recipe explanations',
    description:
      'Ask for detailed explanations about specific cooking techniques or ingredients',
  })
  async explainRecipe(@Body() body: ExplainRecipeDto) {
    try {
      let enhancedQuestion = body.question;

      if (body.recipeId) {
        enhancedQuestion = `레시피 ID ${body.recipeId}에 대한 질문: ${body.question}`;
      }

      const response = await this.ragService.askRecipeQuestion(
        enhancedQuestion,
        {
          maxDocuments: 3,
          relevanceThreshold: 0.6,
          temperature: 0.8,
        },
      );

      return {
        success: true,
        data: response,
        message: 'Recipe explanation generated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to explain recipe', error);
      throw error;
    }
  }

  @Post('suggest-variations')
  @ApiOperation({
    summary: 'Suggest recipe variations',
    description:
      'Get AI-powered suggestions for recipe modifications and variations',
  })
  async suggestVariations(@Body() body: SuggestVariationsDto) {
    try {
      const questionParts = [
        `${body.baseIngredients.join(', ')}를 사용한 레시피의 변형 버전을 제안해주세요.`,
      ];

      if (body.dietaryRestrictions?.length) {
        questionParts.push(
          `식단 제한사항: ${body.dietaryRestrictions.join(', ')}`,
        );
      }

      if (body.availableIngredients?.length) {
        questionParts.push(
          `현재 가지고 있는 재료: ${body.availableIngredients.join(', ')}`,
        );
      }

      const question = questionParts.join(' ');

      const response = await this.ragService.askRecipeQuestion(question, {
        maxDocuments: 8,
        relevanceThreshold: 0.5,
        temperature: 0.9,
      });

      return {
        success: true,
        data: response,
        message: 'Recipe variations suggested successfully',
      };
    } catch (error) {
      this.logger.error('Failed to suggest variations', error);
      throw error;
    }
  }

  @Post('cooking-tips')
  @ApiOperation({
    summary: 'Get cooking tips and techniques',
    description: 'Ask for cooking tips, techniques, and troubleshooting advice',
  })
  async getCookingTips(@Body() body: CookingTipsDto) {
    try {
      let enhancedQuestion = body.question;

      if (body.technique) {
        enhancedQuestion = `${body.technique} 조리법에 대한 질문: ${body.question}`;
      } else if (body.ingredient) {
        enhancedQuestion = `${body.ingredient} 재료에 대한 질문: ${body.question}`;
      } else if (body.problem) {
        enhancedQuestion = `요리 문제 해결: ${body.problem}. ${body.question}`;
      }

      const response = await this.ragService.askRecipeQuestion(
        enhancedQuestion,
        {
          maxDocuments: 6,
          relevanceThreshold: 0.6,
          temperature: 0.7,
        },
      );

      return {
        success: true,
        data: response,
        message: 'Cooking tips provided successfully',
      };
    } catch (error) {
      this.logger.error('Failed to provide cooking tips', error);
      throw error;
    }
  }
}
