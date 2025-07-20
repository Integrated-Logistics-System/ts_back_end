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
import { ConversationManagerService } from './conversation-manager.service';
import { PersonalizedResponseService } from './personalized-response.service';
import { ChatHistoryService } from '../chat/chat-history.service';

export interface ConversationalRequest {
  message: string;
  sessionId?: string;
  usePersonalization?: boolean;
}

@Controller('conversation')
export class ConversationalAssistantController {
  private readonly logger = new Logger(ConversationalAssistantController.name);

  constructor(
    private readonly conversationManager: ConversationManagerService,
    private readonly personalizedResponse: PersonalizedResponseService,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  // ================== 🎯 메인 대화형 엔드포인트 ==================

  /**
   * ChatGPT 스타일의 대화형 요리 어시스턴트
   */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Body() body: ConversationalRequest,
    @Request() req: { user: { id: string; email: string; name: string; } },
  ) {
    const userId = req.user.id;
    const startTime = Date.now();

    try {
      this.logger.log(`💬 Conversational chat from user ${userId}: "${body.message}"`);

      // 1. 대화 상태 가져오기 또는 생성
      const conversationState = await this.conversationManager.getOrCreateConversationState(
        userId, 
        body.sessionId
      );

      // 2. 사용자 의도 분석 및 상태 업데이트 (임시)
      conversationState.userIntent = this.classifyUserIntent(body.message);
      conversationState.currentStage = this.determineConversationStage(conversationState, body.message);

      // 3. 개인화된 응답 생성
      const personalizedResponse = await this.personalizedResponse.generatePersonalizedResponse(
        userId,
        body.message,
        conversationState
      );

      // 4. 대화 상태 업데이트
      await this.conversationManager.updateConversationState(
        conversationState.sessionId,
        body.message,
        personalizedResponse.content,
        personalizedResponse.recipeData as any[]
      );

      // 5. 대화 히스토리에 저장 (RAG용)
      if (body.usePersonalization !== false) {
        await this.chatHistoryService.saveChatMessage(
          userId,
          body.message,
          personalizedResponse.content,
          'recipe_query',
          {
            processingTime: Date.now() - startTime,
            hasRecipe: !!personalizedResponse.recipeData,
          }
        );
      }

      return {
        content: personalizedResponse.content,
        sessionId: conversationState.sessionId,
        metadata: {
          intent: conversationState.userIntent,
          stage: conversationState.currentStage,
          tone: personalizedResponse.tone,
          actionRequired: personalizedResponse.actionRequired,
          processingTime: Date.now() - startTime,
          userId: userId,
          model: 'Conversational AI Assistant v2.0',
          personalizationUsed: body.usePersonalization !== false
        },
        suggestedFollowups: personalizedResponse.suggestedFollowups,
        recipeData: personalizedResponse.recipeData,
        timestamp: new Date().toISOString(),
      };

    } catch (error: unknown) {
      this.logger.error(`Conversational chat failed for user ${userId}:`, error);
      
      // 친근한 에러 응답
      return {
        content: '죄송해요, 잠시 문제가 있었어요 😅 다시 한번 말씀해주시면 도와드릴게요!',
        sessionId: body.sessionId || `fallback_${Date.now()}`,
        metadata: {
          intent: 'error',
          stage: 'error',
          tone: 'apologetic',
          actionRequired: 'retry',
          processingTime: Date.now() - startTime,
          userId: userId,
          model: 'Conversational AI Assistant v2.0',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ================== 🌊 스트리밍 대화 ==================

  /**
   * 실시간 스트리밍 대화 (타이핑 효과)
   */
  @Post('stream')
  @UseGuards(JwtAuthGuard)
  async streamChat(
    @Body() body: ConversationalRequest,
    @Request() req: { user: { id: string; email: string; name: string; } },
    @Res() res: Response,
  ) {
    const userId = req.user.id;

    try {
      this.logger.log(`🌊 Streaming conversation from user ${userId}: "${body.message}"`);
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // 1. 대화 상태 준비
      const conversationState = await this.conversationManager.getOrCreateConversationState(
        userId, 
        body.sessionId
      );

      // 2. "타이핑 중" 표시
      res.write(`data: ${JSON.stringify({
        type: 'typing',
        content: '생각 중...',
        sessionId: conversationState.sessionId,
        timestamp: new Date().toISOString()
      })}

`);

      // 3. 개인화된 응답 생성
      const personalizedResponse = await this.personalizedResponse.generatePersonalizedResponse(
        userId,
        body.message,
        conversationState
      );

      // 4. 응답을 청크로 나누어 스트리밍
      const chunks = this.splitIntoChunks(personalizedResponse.content);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLast = i === chunks.length - 1;

        res.write(`data: ${JSON.stringify({
          type: 'content',
          content: chunk,
          sessionId: conversationState.sessionId,
          isComplete: isLast,
          metadata: isLast ? {
            intent: conversationState.userIntent,
            tone: personalizedResponse.tone,
            suggestedFollowups: personalizedResponse.suggestedFollowups
          } : undefined,
          timestamp: new Date().toISOString()
        })}

`);

        // 자연스러운 타이핑 속도 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
      }

      // 5. 상태 업데이트 및 저장
      await this.conversationManager.updateConversationState(
        conversationState.sessionId,
        body.message,
        personalizedResponse.content,
        personalizedResponse.recipeData as any[]
      );

      await this.chatHistoryService.saveChatMessage(
        userId,
        body.message,
        personalizedResponse.content,
        'recipe_query'
      );

      res.end();

    } catch (error: unknown) {
      this.logger.error('Streaming conversation failed:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        content: '죄송해요, 응답 생성 중 문제가 발생했어요. 다시 시도해주세요! 😅',
        timestamp: new Date().toISOString()
      })}

`);
      res.end();
    }
  }

  // ================== 📚 대화 관리 ==================

  /**
   * 대화 세션 정보 조회
   */
  @Get('session')
  @UseGuards(JwtAuthGuard)
  async getSessionInfo(
    @Request() req: { user: { id: string; email: string; name: string; } },
  ) {
    const userId = req.user.id;

    try {
      // 활성 세션들에서 해당 사용자의 세션 찾기
      const conversationState = await this.conversationManager.getOrCreateConversationState(userId);

      return {
        sessionId: conversationState.sessionId,
        currentStage: conversationState.currentStage,
        currentRecipes: conversationState.currentRecipes,
        selectedRecipe: conversationState.selectedRecipe,
        contextLength: conversationState.contextHistory.length,
        lastActivity: conversationState.contextHistory?.length > 0 
          ? conversationState.contextHistory?.[conversationState.contextHistory.length - 1]?.timestamp || Date.now()
          : Date.now(),
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get session info:', error);
      throw new Error(`Failed to get session info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 특정 세션의 대화 기록 조회
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getConversationHistory(
    @Request() req: { user: { id: string; email: string; name: string; } },
  ) {
    const userId = req.user.id;

    try {
      const history = await this.chatHistoryService.getChatHistory(userId, 20);
      this.logger.log(`📚 Backend: chatHistoryService.getChatHistory returned: ${JSON.stringify(history)}`);
      const context = await this.chatHistoryService.getUserContext(userId);
      this.logger.log(`📚 Backend: chatHistoryService.getUserContext returned: ${JSON.stringify(context)}`);

      const responsePayload = {
        conversations: history,
        userContext: context,
        metadata: {
          totalMessages: history.length,
          userId: userId,
          systemType: 'Conversational AI Assistant',
        },
        timestamp: new Date().toISOString(),
      };
      this.logger.log(`📚 Backend: getConversationHistory returning: ${JSON.stringify(responsePayload)}`);
      return responsePayload;
    } catch (error: unknown) {
      this.logger.error('Failed to get conversation history:', error);
      throw new Error(`Failed to get conversation history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 대화 세션 종료
   */
  @Delete('session')
  @UseGuards(JwtAuthGuard)
  async endSession(
    @Body() body: { sessionId: string },
    @Request() req: { user: { id: string; email: string; name: string; } },
  ) {
    const userId = req.user.id;

    try {
      this.conversationManager.clearConversationState(body.sessionId);

      return {
        success: true,
        message: '대화 세션이 종료되었습니다.',
        sessionId: body.sessionId,
        userId: userId,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error('Failed to end session:', error);
      throw new Error(`Failed to end session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 전체 대화 히스토리 삭제 (모든 캐시 포함)
   */
  @Delete('history')
  @UseGuards(JwtAuthGuard)
  async clearAllHistory(
    @Request() req: { user: { id: string; email: string; name: string; } },
  ) {
    const userId = req.user.id;

    try {
      // 1. ChatHistoryService - MongoDB + Redis 기반 히스토리
      await this.chatHistoryService.clearChatHistory(userId);
      
      // 2. ConversationManagerService - 메모리 기반 세션 상태들 삭제
      // 해당 사용자의 모든 활성 세션 찾아서 삭제
      const activeSession = await this.conversationManager.getOrCreateConversationState(userId);
      if (activeSession) {
        this.conversationManager.clearConversationState(activeSession.sessionId);
      }

      this.logger.log(`🗑️ All conversation history cleared for user ${userId}`);

      return {
        success: true,
        message: '모든 대화 히스토리가 삭제되었습니다.',
        userId: userId,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error('Failed to clear all history:', error);
      throw new Error(`Failed to clear all history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ================== 🔧 헬퍼 메서드 ==================

  private classifyUserIntent(message: string): 'search' | 'detail' | 'substitute' | 'help' | 'chat' {
    const msg = message.toLowerCase();

    // 상세 정보 요청 (우선순위 높음)
    if (msg.includes('자세히') || msg.includes('상세') || msg.includes('step') || msg.includes('단계')) {
      return 'detail';
    }

    // 참조 표현이 있고 상세 요청
    if ((msg.includes('첫') || msg.includes('번째') || msg.includes('그거') || msg.includes('이것')) 
        && (msg.includes('알려줘') || msg.includes('만들') || msg.includes('요리법'))) {
      return 'detail';
    }

    // 재료 대체
    if (msg.includes('대신') || msg.includes('바꿔') || msg.includes('없으면') || msg.includes('대체')) {
      return 'substitute';
    }

    // 요리 도움
    if (msg.includes('어떻게') || msg.includes('방법') || msg.includes('팁') || msg.includes('주의')) {
      return 'help';
    }

    // 레시피 검색 (우선순위 낮음)
    if (msg.includes('레시피') || msg.includes('요리') || msg.includes('만들') || msg.includes('추천')) {
      return 'search';
    }

    return 'chat';
  }

  private determineConversationStage(state: any, message: string): 'greeting' | 'exploring' | 'focused' | 'cooking' | 'clarifying' {
    const intent = this.classifyUserIntent(message);

    if (intent === 'search') return 'exploring';
    if (intent === 'detail' && state.currentRecipes?.length > 0) return 'focused';
    if (intent === 'help' || intent === 'substitute') return 'cooking';
    return 'greeting';
  }

  private splitIntoChunks(text: string): string[] {
    // 자연스러운 청크 분할 (문장 단위, 개행 단위)
    const sentences = text.split(/([.!?]|\n)/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (sentence.match(/[.!?]/) || sentence === '\n') {
        currentChunk += sentence;
        if (currentChunk.trim()) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk);
    }

    return chunks.filter(chunk => chunk.trim());
  }

  // ================== 📊 상태 및 통계 ==================

  /**
   * 시스템 상태 확인
   */
  @Get('status')
  async getSystemStatus() {
    const activeSessions = this.conversationManager.getActiveSessionsCount();

    return {
      status: 'healthy',
      system: 'Conversational AI Assistant',
      version: '2.0.0',
      features: {
        conversationalMemory: true,
        intentClassification: true,
        referenceResolution: true,
        personalizedResponses: true,
        streamingSupport: true,
        contextAwareSearch: true,
      },
      statistics: {
        activeSessions,
        supportedIntents: ['search', 'detail', 'substitute', 'help', 'chat'],
        supportedStages: ['greeting', 'exploring', 'focused', 'cooking', 'clarifying'],
      },
      timestamp: new Date().toISOString(),
    };
  }
}