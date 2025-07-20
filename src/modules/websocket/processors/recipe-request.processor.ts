import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from '../../langgraph/langgraph.service';
import { AiService } from '../../ai/ai.service';
import {
  PersonalizedContext,
  ProcessingResult,
  ChatMessageMetadata,
  ResponseChunk,
  TimeContext,
} from '../interfaces/chat.interface';
import { RAGRecipeRequest, RecipeMetadata } from '../../../shared/interfaces/langgraph.interface';

@Injectable()
export class RecipeRequestProcessor {
  private readonly logger = new Logger(RecipeRequestProcessor.name);

  constructor(
    private readonly langGraphService: LangGraphService,
    private readonly aiService: AiService,
  ) {}

  /**
   * 레시피 요청 처리
   */
  async processRecipeRequest(
    message: string,
    context: PersonalizedContext,
    timeContext: TimeContext
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Processing recipe request: ${message.substring(0, 50)}...`);

      // RAG 요청 생성
      const ragRequest = this.buildRAGRequest(message, context, timeContext);
      
      // RAG 처리
      const ragResponse = await this.langGraphService.processRAGRequest(ragRequest);
      
      if (ragResponse?.response) {
        const enhancedResponse = this.enhanceRecipeResponse(ragResponse.response, context);
        const processingTime = Date.now() - startTime;
        
        return {
          success: true,
          response: enhancedResponse,
          metadata: this.createSuccessMetadata(this.convertToRecipeMetadata(ragResponse), processingTime),
          shouldSave: true,
          processingTime,
        };
      }

      // RAG 실패 시 일반 AI 응답
      return await this.fallbackToGeneralChat(message, context, startTime);

    } catch (error) {
      this.logger.error('Recipe request processing failed:', error);
      return await this.handleProcessingError(message, context, startTime, error);
    }
  }

  /**
   * 스트리밍 레시피 요청 처리
   */
  async *processRecipeRequestStream(
    message: string,
    context: PersonalizedContext,
    timeContext: TimeContext
  ): AsyncGenerator<ResponseChunk> {
    let chunkIndex = 0;
    const startTime = Date.now();

    try {
      this.logger.log(`Processing streaming recipe request: ${message.substring(0, 50)}...`);

      // 초기 응답
      yield {
        id: `recipe-${Date.now()}-${chunkIndex++}`,
        content: this.getInitialStreamMessage(timeContext),
        isComplete: false,
        metadata: {
          chunkIndex: 0,
          totalChunks: -1,
          processingTime: Date.now() - startTime,
        },
      };

      // RAG 요청 생성 및 처리
      const ragRequest = this.buildRAGRequest(message, context, timeContext);
      
      try {
        const ragStream = this.langGraphService.processRAGRequestStream(ragRequest);
        let hasContent = false;
        let recipeMetadata: RecipeMetadata | undefined;

        for await (const ragChunk of ragStream) {
          if (ragChunk.content?.trim()) {
            hasContent = true;
            yield {
              id: `recipe-${Date.now()}-${chunkIndex++}`,
              content: ragChunk.content,
              isComplete: false,
              metadata: {
                chunkIndex,
                totalChunks: -1,
                processingTime: Date.now() - startTime,
              },
            };
          }

          // 메타데이터 저장
          if (ragChunk.metadata) {
            recipeMetadata = this.convertToRecipeMetadata(ragChunk);
          }
        }

        // 추가 컨텍스트 정보 제공
        if (hasContent) {
          const contextualInfo = this.generateContextualInfo(context, timeContext);
          if (contextualInfo) {
            yield {
              id: `recipe-context-${Date.now()}-${chunkIndex++}`,
              content: contextualInfo,
              isComplete: false,
              metadata: {
                chunkIndex,
                totalChunks: -1,
                processingTime: Date.now() - startTime,
              },
            };
          }
        }

        // 완료 표시
        yield {
          id: `recipe-complete-${Date.now()}-${chunkIndex}`,
          content: '',
          isComplete: true,
          metadata: {
            chunkIndex,
            totalChunks: chunkIndex + 1,
            processingTime: Date.now() - startTime,
          },
        };

      } catch (ragError) {
        this.logger.warn('RAG streaming failed, using fallback:', ragError);
        
        // 폴백 응답
        const fallbackResponse = await this.generateFallbackRecipeResponse(message, context);
        
        yield {
          id: `recipe-fallback-${Date.now()}-${chunkIndex}`,
          content: fallbackResponse,
          isComplete: true,
          metadata: {
            chunkIndex,
            totalChunks: chunkIndex + 1,
            processingTime: Date.now() - startTime,
          },
        };
      }

    } catch (error) {
      this.logger.error('Streaming recipe request failed:', error);
      
      yield {
        id: `recipe-error-${Date.now()}`,
        content: this.getErrorRecipeResponse(),
        isComplete: true,
        metadata: {
          chunkIndex: 0,
          totalChunks: 1,
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * 사용자 맞춤 레시피 추천
   */
  async generatePersonalizedRecommendation(
    context: PersonalizedContext,
    timeContext: TimeContext
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const recommendationPrompt = this.buildRecommendationPrompt(context, timeContext);
      const response = await this.aiService.generateResponse(recommendationPrompt);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        response: response || this.getDefaultRecommendation(timeContext),
        metadata: this.createRecommendationMetadata(processingTime),
        shouldSave: true,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Personalized recommendation failed:', error);
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        response: this.getDefaultRecommendation(timeContext),
        metadata: this.createErrorMetadata(processingTime, error),
        shouldSave: false,
        processingTime,
      };
    }
  }

  // ==================== Private Helper Methods ====================

  private buildRAGRequest(
    message: string,
    context: PersonalizedContext,
    timeContext: TimeContext
  ): RAGRecipeRequest {
    return {
      query: message,
      userAllergies: context.allergies,
      preferences: context.preferences,
      conversationContext: {
        previousRecipes: [],
        isDetailRequest: false,
      },
      maxResults: 3,
    };
  }

  private enhanceRecipeResponse(response: string, context: PersonalizedContext): string {
    let enhanced = response;

    // 사용자 레벨에 따른 추가 정보
    if (context.cookingLevel === 'beginner') {
      enhanced += '\n\n🔰 **초보자를 위한 팁**: 재료 손질은 미리 해두시고, 불 조절에 주의하세요!';
    } else if (context.cookingLevel === 'advanced') {
      enhanced += '\n\n👨‍🍳 **고급 팁**: 플레이팅이나 특별한 소스 추가로 한 단계 업그레이드해보세요!';
    }

    // 알레르기 주의사항
    if (context.allergies.length > 0) {
      enhanced += `\n\n⚠️ **알레르기 주의**: ${context.allergies.join(', ')}을 피해주세요.`;
    }

    return enhanced;
  }

  private getInitialStreamMessage(timeContext: TimeContext): string {
    const mealTimeMessages = {
      breakfast: '아침 식사로 좋은 레시피를 찾고 있어요... ☀️',
      lunch: '점심으로 맛있는 요리를 준비하고 있어요... 🌞',
      dinner: '저녁 식사를 위한 레시피를 검색 중이에요... 🌙',
      snack: '간식으로 좋은 레시피를 찾고 있어요... 🍿',
    };

    return mealTimeMessages[timeContext.mealTime || 'breakfast'] || 
           '맛있는 레시피를 찾고 있어요... 🍳';
  }

  private generateContextualInfo(
    context: PersonalizedContext,
    timeContext: TimeContext
  ): string | null {
    const tips = [];

    // 시간대별 팁
    if (timeContext.mealTime === 'breakfast' && timeContext.timeOfDay === 'morning') {
      tips.push('아침 시간이니 간단하고 영양가 있는 요리가 좋겠어요! 🌅');
    }

    // 주말/평일 팁
    if (timeContext.isWeekend) {
      tips.push('주말이니 평소보다 시간을 들여 만들어보는 것도 좋겠네요! 🎉');
    } else {
      tips.push('평일이니 빠르고 간편한 조리법을 추천드려요! ⏰');
    }

    // 계절별 팁
    const seasonTips = {
      spring: '봄이니 신선한 채소를 활용해보세요! 🌸',
      summer: '여름이니 시원하고 상큼한 요리가 어떨까요? ☀️',
      fall: '가을이니 따뜻하고 든든한 요리를 추천해요! 🍂',
      winter: '겨울이니 몸을 따뜻하게 해주는 요리가 좋겠어요! ❄️',
    };

    if (seasonTips[timeContext.season]) {
      tips.push(seasonTips[timeContext.season]);
    }

    return tips.length > 0 ? `\n\n💡 **추가 팁**: ${tips.join(' ')}` : null;
  }

  private async fallbackToGeneralChat(
    message: string,
    context: PersonalizedContext,
    startTime: number
  ): Promise<ProcessingResult> {
    try {
      const fallbackPrompt = this.buildFallbackPrompt(message, context);
      const response = await this.aiService.generateResponse(fallbackPrompt);
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        response: response || this.getDefaultFallbackResponse(),
        metadata: this.createFallbackMetadata(processingTime),
        shouldSave: true,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Fallback chat failed:', error);
      return await this.handleProcessingError(message, context, startTime, error);
    }
  }

  private async handleProcessingError(
    message: string,
    context: PersonalizedContext,
    startTime: number,
    error: any
  ): Promise<ProcessingResult> {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      response: this.getErrorRecipeResponse(),
      metadata: this.createErrorMetadata(processingTime, error),
      shouldSave: false,
      processingTime,
    };
  }

  private async generateFallbackRecipeResponse(
    message: string,
    context: PersonalizedContext
  ): Promise<string> {
    try {
      const prompt = `사용자가 "${message}"라고 물어봤습니다. 
요리 수준: ${context.cookingLevel}, 알레르기: ${context.allergies.join(', ')}
간단한 레시피나 요리 조언을 해주세요.`;
      
      return await this.aiService.generateResponse(prompt) || this.getDefaultFallbackResponse();
    } catch (error) {
      this.logger.error('Fallback recipe response failed:', error);
      return this.getDefaultFallbackResponse();
    }
  }

  private buildRecommendationPrompt(
    context: PersonalizedContext,
    timeContext: TimeContext
  ): string {
    return `사용자 맞춤 레시피 추천:
- 요리 수준: ${context.cookingLevel}
- 알레르기: ${context.allergies.join(', ') || '없음'}
- 선호사항: ${context.preferences.join(', ') || '없음'}
- 현재 시간: ${timeContext.timeOfDay}
- 식사 시간: ${timeContext.mealTime || '미정'}
- 계절: ${timeContext.season}

이 정보를 바탕으로 적절한 레시피를 추천해주세요.`;
  }

  private buildFallbackPrompt(message: string, context: PersonalizedContext): string {
    return `요리 관련 질문: "${message}"
사용자 정보: 요리 수준 ${context.cookingLevel}, 알레르기 ${context.allergies.join(', ') || '없음'}
친근하게 요리 조언을 해주세요.`;
  }

  private getDefaultRecommendation(timeContext: TimeContext): string {
    const timeBasedRecommendations = {
      morning: '아침에는 간단한 토스트나 스크램블 에그는 어떨까요? 🍳',
      afternoon: '점심으로는 볶음밥이나 간단한 파스타를 추천해요! 🍝',
      evening: '저녁에는 따뜻한 찌개나 구이 요리가 좋겠어요! 🍲',
      night: '늦은 시간이니 가벼운 야식이나 차를 권해드려요! 🍵',
    };

    return timeBasedRecommendations[timeContext.timeOfDay] || 
           '맛있는 요리를 함께 만들어봐요! 어떤 요리가 궁금하신가요? 🍽️';
  }

  private getDefaultFallbackResponse(): string {
    return '요리에 대해 궁금한 것이 있으시면 언제든 물어보세요! 함께 맛있는 요리를 만들어봐요! 🍳';
  }

  private getErrorRecipeResponse(): string {
    return '죄송합니다. 레시피 처리 중 오류가 발생했어요. 😔 잠시 후 다시 시도해주세요!';
  }

  private createSuccessMetadata(
    recipeMetadata: RecipeMetadata | undefined,
    processingTime: number
  ): ChatMessageMetadata {
    return {
      messageType: 'recipe_request',
      recipeId: recipeMetadata?.id,
      recipeName: recipeMetadata?.title,
      processingTime,
      ragUsed: true,
      responseQuality: 0.9,
    };
  }

  private createFallbackMetadata(processingTime: number): ChatMessageMetadata {
    return {
      messageType: 'recipe_request',
      processingTime,
      ragUsed: false,
      responseQuality: 0.7,
    };
  }

  private createRecommendationMetadata(processingTime: number): ChatMessageMetadata {
    return {
      messageType: 'recipe_request',
      processingTime,
      ragUsed: false,
      responseQuality: 0.8,
    };
  }

  private createErrorMetadata(processingTime: number, error: any): ChatMessageMetadata {
    return {
      messageType: 'recipe_request',
      processingTime,
      ragUsed: false,
      responseQuality: 0.1,
      errorInfo: {
        code: 'RECIPE_PROCESSING_ERROR',
        message: error.message || 'Unknown error',
        retryCount: 0,
      },
    };
  }

  private convertToRecipeMetadata(ragResponse: any): RecipeMetadata | undefined {
    if (!ragResponse || !ragResponse.generatedRecipe) {
      return undefined;
    }

    const recipe = ragResponse.generatedRecipe;
    return {
      id: recipe.id || `generated-${Date.now()}`,
      title: recipe.name || recipe.nameKo || 'Generated Recipe',
      titleKo: recipe.nameKo || recipe.name || '생성된 레시피',
      generatedAt: Date.now(),
      type: 'ai_generated' as const,
      source: 'langgraph',
      workflowPath: ragResponse.metadata?.workflowPath || [],
    };
  }
}