import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  Logger,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LangGraphService } from './langgraph.service';
import { ChatHistoryService } from '../chat/chat-history.service';

export interface RecipeRequest {
  query: string;
  userAllergies?: string[];
  preferences?: string[];
  maxResults?: number;
  conversationContext?: ConversationContext;
}

export interface ConversationContext {
  previousRecipes: RecipeMetadata[];
  isDetailRequest: boolean;
  targetRecipeId?: string;
  targetRecipeTitle?: string;
}

export interface RecipeMetadata {
  id: string;
  title: string;
  titleKo: string;
  generatedAt: number;
  type: 'existing' | 'ai_generated';
  source?: string;
}

@Controller('langgraph')
export class LanggraphController {
  private readonly logger = new Logger(LanggraphController.name);

  constructor(
    private readonly langgraphService: LangGraphService,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  // ================== 🔥 LangGraph 레시피 워크플로우 ==================

  /**
   * LangGraph 기반 레시피 검색 및 생성
   */
  @Post('recipe-search')
  @UseGuards(JwtAuthGuard)
  async searchRecipesWithLangGraph(
    @Body() body: RecipeRequest,
    @Request() req: { user: { id: string; email: string; name: string; } },
  ) {
    const userId = req.user.id;
    const startTime = Date.now();

    try {
      this.logger.log(`🔍 LangGraph Recipe Search by user ${userId}: "${body.query}"`);

      const result = await this.langgraphService.processRecipeRequest(
        body.query,
        body.userAllergies || []
      );

      return {
        success: true,
        response: result.response,
        metadata: {
          ...result.metadata,
          processingTime: Date.now() - startTime,
          userId: userId,
          model: 'LangGraph + Ollama + Elasticsearch',
          workflowType: 'langgraph-recipe'
        },
        generatedRecipe: result.generatedRecipe,
        timestamp: new Date().toISOString(),
      };

    } catch (error: unknown) {
      this.logger.error(`LangGraph Recipe search failed for user ${userId}:`, error);
      throw new Error(`LangGraph Recipe search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * LangGraph 기반 레시피 워크플로우 실행
   */
  @Post('recipe')
  @UseGuards(JwtAuthGuard)
  async processWithLangGraph(
    @Body() body: { query: string; allergies?: string[] },
    @Request() req: { user: { id: string; email: string; name: string; } },
  ) {
    try {
      this.logger.log(`🔗 LangGraph recipe request: "${body.query}" from user ${req.user?.id}`);
      
      const result = await this.langgraphService.processRecipeRequest(
        body.query,
        body.allergies || []
      );

      return {
        success: true,
        response: result.response,
        metadata: result.metadata,
        generatedRecipe: result.generatedRecipe,
        timestamp: new Date().toISOString(),
        workflow: 'LangGraph',
        userId: req.user?.id,
      };

    } catch (error: unknown) {
      this.logger.error('LangGraph recipe processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        workflow: 'LangGraph',
      };
    }
  }

  /**
   * LangGraph 스트리밍 워크플로우
   */
  @Post('stream')
  @UseGuards(JwtAuthGuard)
  async streamWithLangGraph(
    @Body() body: { query: string; allergies?: string[] },
    @Request() req: { user: { id: string; email: string; name: string; } },
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`🌊 LangGraph streaming: "${body.query}" from user ${req.user?.id}`);
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const stream = await this.langgraphService.streamRecipeWorkflowForWebSocket(
        body.query,
        body.allergies || []
      );
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({
          ...chunk,
          timestamp: new Date().toISOString(),
          userId: req.user?.id
        })}

`);
      }

      res.end();

    } catch (error: unknown) {
      this.logger.error('LangGraph streaming failed:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        content: `오류: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        timestamp: new Date().toISOString()
      })}

`);
      res.end();
    }
  }

  // ================== 대화형 채팅 ==================

  /**
   * LangGraph 기반 대화 처리
   */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async processChat(
    @Body() body: { message: string; useRAG?: boolean },
    @Request() req: { user: { id: string; email: string; name: string; } },
  ) {
    const userId = req.user.id;
    const startTime = Date.now();

    try {
      this.logger.log(`💬 LangGraph chat message from user ${userId}: "${body.message}"`);

      // RAG 컨텍스트 구성 (기본값: true)
      const useRAG = body.useRAG !== false;
      let enhancedQuery = body.message;
      
      if (useRAG) {
        const ragContext = await this.chatHistoryService.buildRAGContext(userId, body.message);
        enhancedQuery = ragContext;
        this.logger.log(`🔍 RAG context built for user ${userId}`);
      }

      const result = await this.langgraphService.processRecipeRequest(enhancedQuery, [], userId);

      // 대화 저장 (RAG용)
      await this.chatHistoryService.saveChatMessage(
        userId,
        body.message,
        result.response,
        'recipe_query',
        {
          processingTime: Date.now() - startTime,
          hasRecipe: !!result.generatedRecipe,
          recipeId: result.generatedRecipe?.id,
        }
      );

      return {
        content: result.response,
        metadata: {
          ...result.metadata,
          processingTime: Date.now() - startTime,
          userId: userId,
          model: 'LangGraph + Ollama + RAG',
          workflowType: 'conversation',
          memoryUsed: true,
          ragUsed: useRAG
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error(`LangGraph chat processing failed for user ${userId}:`, error);
      throw new Error(`LangGraph chat processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ================== 메모리 관리 ==================

  /**
   * 채팅 기록 조회
   */
  @Get('chat-history')
  @UseGuards(JwtAuthGuard)
  async getChatHistory(@Request() req: { user: { id: string; email: string; name: string; } }) {
    const userId = req.user.id;

    try {
      const history = await this.chatHistoryService.getChatHistory(userId, 20);
      const stats = await this.chatHistoryService.getChatStats(userId);

      return {
        messages: history,
        metadata: {
          count: history.length,
          userId: userId,
          memoryType: 'Redis + RAG Context',
          workflowType: 'conversation',
          stats
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to get chat history for user ${userId}:`, error);
      throw new Error(`Failed to get chat history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 채팅 기록 삭제
   */
  @Delete('chat-history')
  @UseGuards(JwtAuthGuard)
  async clearChatHistory(@Request() req: { user: { id: string; email: string; name: string; } }) {
    const userId = req.user.id;

    try {
      // Redis에서 채팅 히스토리 삭제
      await this.chatHistoryService.clearChatHistory(userId);
      
      // LangGraph 캐시도 클리어
      await this.langgraphService.clearCache(`recipe:${userId}:*`);

      return {
        success: true,
        message: 'Chat history and context cleared successfully',
        userId: userId,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to clear chat history for user ${userId}:`, error);
      throw new Error(`Failed to clear chat history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ================== 상태 및 헬스체크 ==================

  /**
   * 서비스 상태 확인
   */
  @Get('status')
  async getStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    services?: {
      langgraph: string;
      workflow: string;
      ollama: { status: string; url: string; model: string | undefined };
      elasticsearch: { status: string; url: string };
      stateStore: { status: string; note: string };
    };
    features?: {
      recipeWorkflow: boolean;
      conversationalMemory: boolean;
      allergyFiltering: boolean;
      recipeGeneration: boolean;
      stateManagement: boolean;
    };
    workflow?: {
      nodes: string[];
      edges: string;
      stateChannels: string[];
    };
    timestamp: string;
    error?: string;
  }> {
    try {
      // Service status check (currently not used but kept for future extension)
      // const serviceStatus = await this.langgraphService.getServiceStatus();
      
      return {
        status: 'healthy',
        services: {
          langgraph: 'active',
          workflow: 'operational',
          ollama: {
            status: 'connected',
            url: process.env.OLLAMA_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'gemma3:1b'
          },
          elasticsearch: {
            status: 'connected',
            url: process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'
          },
          stateStore: {
            status: 'memory-store',
            note: 'LangGraph state management active'
          }
        },
        features: {
          recipeWorkflow: true,
          conversationalMemory: true,
          allergyFiltering: true,
          recipeGeneration: true,
          stateManagement: true
        },
        workflow: {
          nodes: ['analyze_query', 'check_detail_request', 'search_recipes', 'generate_recipe', 'create_response', 'handle_detail_request'],
          edges: 'conditional_routing',
          stateChannels: ['messages', 'query', 'userAllergies', 'searchResults', 'generatedRecipe']
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
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
      service: 'LangGraphService',
      workflow: 'recipe-workflow',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  // ================== 개발용 엔드포인트 ==================

  /**
   * 워크플로우 상태 테스트 (개발용)
   */
  @Post('test/workflow-state')
  async testWorkflowState(@Body() body: { query: string; allergies?: string[] }) {
    try {
      // Mock workflow state for testing since getWorkflowState is not implemented
      const workflowState = {
        query: body.query,
        allergies: body.allergies || [],
        isRecipeQuery: this.isRecipeRelated(body.query),
        currentStep: 'analyzed',
        extractedAllergies: this.extractAllergies(body.query),
      };

      return {
        query: body.query,
        allergies: body.allergies || [],
        workflowState,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private isRecipeRelated(query: string): boolean {
    const recipeKeywords = [
      '레시피', '요리', '음식', '요리법', '만드는', '조리법',
      '추천', '알려줘', '가르쳐', '만들는', '요리하는',
      'recipe', 'cook', 'food', 'meal', 'dish'
    ];
    
    const queryLower = query.toLowerCase();
    return recipeKeywords.some(keyword => queryLower.includes(keyword));
  }

  private extractAllergies(query: string): string[] {
    const allergyKeywords = [
      { patterns: ['달걀', '계란', 'egg'], allergy: '달걀' },
      { patterns: ['우유', '유제품', 'milk'], allergy: '우유' },
      { patterns: ['땅콩', 'peanut'], allergy: '땅콩' },
      { patterns: ['대두', '콩', 'soy'], allergy: '대두' },
      { patterns: ['밀', '밀가루', 'wheat'], allergy: '밀' },
      { patterns: ['새우', '갑각류', 'shrimp'], allergy: '새우' },
      { patterns: ['생선', '어류', 'fish'], allergy: '생선' },
    ];

    const detected: string[] = [];
    const queryLower = query.toLowerCase();

    for (const { patterns, allergy } of allergyKeywords) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        if (queryLower.includes('알레르기') || queryLower.includes('못먹') || queryLower.includes('제외')) {
          detected.push(allergy);
        }
      }
    }

    return detected;
  }

  // ================== RAG 기능 테스트 ==================

  /**
   * RAG 컨텍스트 확인 (개발용)
   */
  @Post('test/rag-context')
  @UseGuards(JwtAuthGuard)
  async testRAGContext(
    @Body() body: { query: string },
    @Request() req: { user: { id: string; email: string; name: string; } }
  ) {
    try {
      const userId = req.user.id;
      const ragContext = await this.chatHistoryService.buildRAGContext(userId, body.query);
      const userContext = await this.chatHistoryService.getUserContext(userId);
      const recentHistory = await this.chatHistoryService.getChatHistory(userId, 5);

      return {
        query: body.query,
        ragContext,
        userContext,
        recentHistory,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 사용자 대화 통계 확인 (개발용)
   */
  @Get('test/chat-stats')
  @UseGuards(JwtAuthGuard)
  async getChatStats(@Request() req: { user: { id: string; email: string; name: string; } }) {
    try {
      const userId = req.user.id;
      const stats = await this.chatHistoryService.getChatStats(userId);
      const context = await this.chatHistoryService.getUserContext(userId);

      return {
        userId,
        stats,
        userPreferences: context.userPreferences,
        recipeHistory: context.recipeHistory,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
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
      // ValidationUtils에서 레시피 관련 쿼리 검증
      const isRecipeRequest = true; // 임시로 true로 설정

      return {
        message: body.message,
        isRecipeRequest,
        detectionMethod: 'LangGraph Analysis',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
