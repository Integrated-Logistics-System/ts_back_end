import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LangchainService, RAGRecipeRequest } from './langchain.service';

@Controller('api/langchain')
export class LangchainController {
  private readonly logger = new Logger(LangchainController.name);

  constructor(private readonly langchainService: LangchainService) {}

  // ================== RAG 레시피 검색 ==================

  /**
   * 완전한 RAG 기반 레시피 검색
   */
  @Post('recipe-search')
  @UseGuards(JwtAuthGuard)
  async searchRecipesWithAI(
    @Body() body: RAGRecipeRequest,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const startTime = Date.now();

    try {
      this.logger.log(`🔍 RAG Recipe Search by user ${userId}: "${body.query}"`);

      const ragResponse = await this.langchainService.searchRecipesWithAI(body);

      return {
        ...ragResponse,
        metadata: {
          ...ragResponse.searchMetadata,
          processingTime: Date.now() - startTime,
          userId: userId,
          model: 'Ollama + Elasticsearch',
          chainType: 'rag-recipe'
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`RAG Recipe search failed for user ${userId}:`, error);
      throw new Error(`RAG Recipe search failed: ${error.message}`);
    }
  }

  // ================== 대화형 채팅 ==================

  /**
   * 메모리 기반 대화 처리
   */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async processChat(
    @Body() body: { message: string },
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const startTime = Date.now();

    try {
      this.logger.log(`💬 Chat message from user ${userId}: "${body.message}"`);

      const response = await this.langchainService.processWithMemory(userId, body.message);

      return {
        content: response,
        metadata: {
          processingTime: Date.now() - startTime,
          userId: userId,
          model: 'Ollama',
          chainType: 'conversation',
          memoryUsed: true
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Chat processing failed for user ${userId}:`, error);
      throw new Error(`Chat processing failed: ${error.message}`);
    }
  }

  // ================== 메모리 관리 ==================

  /**
   * 채팅 기록 조회
   */
  @Get('chat-history')
  @UseGuards(JwtAuthGuard)
  async getChatHistory(@Request() req: any) {
    const userId = req.user.id;

    try {
      const history = await this.langchainService.getChatHistory(userId);

      return {
        messages: history,
        metadata: {
          count: history.length,
          userId: userId,
          memoryType: 'Redis'
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get chat history for user ${userId}:`, error);
      throw new Error(`Failed to get chat history: ${error.message}`);
    }
  }

  /**
   * 채팅 기록 삭제
   */
  @Delete('chat-history')
  @UseGuards(JwtAuthGuard)
  async clearChatHistory(@Request() req: any) {
    const userId = req.user.id;

    try {
      await this.langchainService.clearMemory(userId);

      return {
        success: true,
        message: 'Chat history cleared successfully',
        userId: userId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to clear chat history for user ${userId}:`, error);
      throw new Error(`Failed to clear chat history: ${error.message}`);
    }
  }

  // ================== 상태 및 헬스체크 ==================

  /**
   * 서비스 상태 확인
   */
  @Get('status')
  async getStatus() {
    try {
      return {
        status: 'healthy',
        services: {
          langchain: 'active',
          ollama: {
            status: 'connected',
            url: process.env.OLLAMA_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'gemma3:1b'
          },
          elasticsearch: {
            status: 'connected',
            url: process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'
          },
          redis: {
            status: 'memory-store',
            note: 'Using in-memory storage'
          }
        },
        features: {
          ragSearch: true,
          conversationalMemory: true,
          allergyFiltering: true,
          translation: true
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 헬스체크
   */
  @Get('health')
  async healthCheck() {
    return {
      status: 'ok',
      service: 'LangchainService',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  // ================== 개발용 엔드포인트 ==================

  /**
   * 번역 테스트 (개발용)
   */
  @Post('test/translate')
  async testTranslation(@Body() body: { text: string }) {
    try {
      return {
        input: body.text,
        note: 'Translation testing is internal',
        suggestion: 'Use recipe-search endpoint to test full RAG pipeline',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 레시피 요청 감지 테스트 (개발용)
   */
  @Post('test/recipe-detection')
  async testRecipeDetection(@Body() body: { message: string }) {
    try {
      const isRecipeRequest = body.message.includes('요리') ||
        body.message.includes('레시피') ||
        body.message.includes('만들') ||
        body.message.includes('추천');

      return {
        message: body.message,
        isRecipeRequest,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}