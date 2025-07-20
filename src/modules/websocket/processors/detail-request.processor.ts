import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from '../../langgraph/langgraph.service';
import { AiService } from '../../ai/ai.service';
import {
  PersonalizedContext,
  ProcessingResult,
  ChatMessageMetadata,
  ResponseChunk,
} from '../interfaces/chat.interface';

@Injectable()
export class DetailRequestProcessor {
  private readonly logger = new Logger(DetailRequestProcessor.name);

  constructor(
    private readonly langGraphService: LangGraphService,
    private readonly aiService: AiService,
  ) {}

  /**
   * 향상된 상세 요청 처리
   */
  async processDetailRequest(
    message: string,
    targetRecipe: string,
    context: PersonalizedContext
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Processing detail request for recipe: ${targetRecipe}`);

      // 기본 상세 정보 처리
      const detailResponse = await this.getRecipeDetails(targetRecipe, context);
      
      if (detailResponse) {
        const processingTime = Date.now() - startTime;
        
        return {
          success: true,
          response: detailResponse,
          metadata: this.createSuccessMetadata(targetRecipe, processingTime, true),
          shouldSave: true,
          processingTime,
        };
      }

      // 실패 시 대안 제안
      const alternativeResponse = await this.suggestAlternatives(targetRecipe, context);
      const processingTime = Date.now() - startTime;

      return {
        success: false,
        response: alternativeResponse,
        metadata: this.createFailureMetadata(targetRecipe, processingTime),
        shouldSave: true,
        processingTime,
      };

    } catch (error) {
      this.logger.error('Detail request processing failed:', error);
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        response: this.getErrorResponse(targetRecipe),
        metadata: this.createErrorMetadata(targetRecipe, processingTime, error),
        shouldSave: false,
        processingTime,
      };
    }
  }

  /**
   * 스트리밍 상세 요청 처리
   */
  async *processDetailRequestStream(
    message: string,
    targetRecipe: string,
    context: PersonalizedContext
  ): AsyncGenerator<ResponseChunk> {
    try {
      this.logger.log(`Processing streaming detail request for: ${targetRecipe}`);

      let chunkIndex = 0;
      const startTime = Date.now();

      // 초기 응답 청크
      yield {
        id: `detail-${Date.now()}-${chunkIndex++}`,
        content: `${targetRecipe}의 상세 레시피를 찾고 있습니다... 🍳`,
        isComplete: false,
        metadata: {
          chunkIndex: 0,
          totalChunks: -1,
          processingTime: Date.now() - startTime,
        },
      };

      // RAG 기반 상세 정보 검색
      const detailRequest = this.buildDetailRequest(targetRecipe, context);
      
      try {
        const ragStream = this.langGraphService.processRAGRequestStream(detailRequest);
        
        for await (const ragChunk of ragStream) {
          if (ragChunk.content.trim()) {
            yield {
              id: `detail-${Date.now()}-${chunkIndex++}`,
              content: ragChunk.content,
              isComplete: false,
              metadata: {
                chunkIndex,
                totalChunks: -1,
                processingTime: Date.now() - startTime,
              },
            };
          }
        }

        // 완료 청크
        yield {
          id: `detail-${Date.now()}-${chunkIndex}`,
          content: '',
          isComplete: true,
          metadata: {
            chunkIndex,
            totalChunks: chunkIndex + 1,
            processingTime: Date.now() - startTime,
          },
        };

      } catch (ragError) {
        this.logger.warn('RAG processing failed, using fallback:', ragError);
        
        // 대안 응답
        const fallbackResponse = await this.generateFallbackResponse(targetRecipe, context);
        
        yield {
          id: `detail-fallback-${Date.now()}`,
          content: fallbackResponse,
          isComplete: true,
          metadata: {
            chunkIndex: chunkIndex + 1,
            totalChunks: chunkIndex + 2,
            processingTime: Date.now() - startTime,
          },
        };
      }

    } catch (error) {
      this.logger.error('Streaming detail request failed:', error);
      
      yield {
        id: `detail-error-${Date.now()}`,
        content: this.getErrorResponse(targetRecipe),
        isComplete: true,
        metadata: {
          chunkIndex: 0,
          totalChunks: 1,
          processingTime: 0,
        },
      };
    }
  }

  /**
   * 레시피 상세 정보 조회
   */
  private async getRecipeDetails(
    targetRecipe: string,
    context: PersonalizedContext
  ): Promise<string | null> {
    try {
      const detailRequest = this.buildDetailRequest(targetRecipe, context);
      const ragResponse = await this.langGraphService.processRAGRequest(detailRequest);
      
      if (ragResponse?.response) {
        return this.enhanceDetailResponse(ragResponse.response, targetRecipe, context);
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get recipe details:', error);
      return null;
    }
  }

  /**
   * 대안 제안
   */
  private async suggestAlternatives(
    targetRecipe: string,
    context: PersonalizedContext
  ): Promise<string> {
    try {
      const prompt = this.buildAlternativePrompt(targetRecipe, context);
      const aiResponse = await this.aiService.generateResponse(prompt);
      
      return aiResponse || this.getDefaultAlternativeResponse(targetRecipe);
    } catch (error) {
      this.logger.error('Failed to suggest alternatives:', error);
      return this.getDefaultAlternativeResponse(targetRecipe);
    }
  }

  /**
   * 폴백 응답 생성
   */
  private async generateFallbackResponse(
    targetRecipe: string,
    context: PersonalizedContext
  ): Promise<string> {
    try {
      const fallbackPrompt = this.buildFallbackPrompt(targetRecipe, context);
      const response = await this.aiService.generateResponse(fallbackPrompt);
      
      return response || this.getDefaultFallbackResponse(targetRecipe);
    } catch (error) {
      this.logger.error('Fallback response generation failed:', error);
      return this.getDefaultFallbackResponse(targetRecipe);
    }
  }

  // ==================== Private Helper Methods ====================

  private buildDetailRequest(targetRecipe: string, context: PersonalizedContext): any {
    return {
      query: `${targetRecipe} 만드는 법 상세 레시피`,
      userId: context.userId,
      conversationContext: {
        targetRecipe,
        userLevel: context.cookingLevel,
        allergies: context.allergies,
        preferences: context.preferences,
      },
      options: {
        detailed: true,
        includeNutrition: true,
        includeTips: true,
      },
    };
  }

  private enhanceDetailResponse(
    response: string,
    targetRecipe: string,
    context: PersonalizedContext
  ): string {
    let enhanced = response;

    // 사용자 맞춤 정보 추가
    if (context.cookingLevel === 'beginner') {
      enhanced += '\n\n💡 **초보자 팁**: 처음 만들어보는 거라면 재료를 미리 모두 준비해두세요!';
    }

    // 알레르기 정보 확인
    if (context.allergies.length > 0) {
      enhanced += `\n\n⚠️ **알레르기 주의**: ${context.allergies.join(', ')}에 알레르기가 있으시니 재료를 확인해보세요.`;
    }

    return enhanced;
  }

  private buildAlternativePrompt(targetRecipe: string, context: PersonalizedContext): string {
    return `${targetRecipe}의 정확한 레시피를 찾을 수 없습니다. 
사용자 정보: 요리 수준 ${context.cookingLevel}, 알레르기: ${context.allergies.join(', ')}
비슷한 레시피나 대안을 추천해주고, 간단한 만드는 방법을 알려주세요.`;
  }

  private buildFallbackPrompt(targetRecipe: string, context: PersonalizedContext): string {
    return `${targetRecipe}에 대한 기본적인 요리 방법을 알려주세요. 
사용자는 ${context.cookingLevel} 수준이며, ${context.allergies.join(', ')} 알레르기가 있습니다.
간단하고 따라하기 쉬운 방법으로 설명해주세요.`;
  }

  private getDefaultAlternativeResponse(targetRecipe: string): string {
    return `죄송합니다. "${targetRecipe}"의 정확한 레시피를 찾을 수 없어요. 😅

하지만 걱정하지 마세요! 다음과 같은 방법을 시도해보세요:

1. **비슷한 요리**: ${targetRecipe}와 비슷한 다른 요리를 추천드릴 수 있어요
2. **기본 재료**: 일반적으로 사용되는 기본 재료들을 알려드릴게요
3. **요리법 검색**: 좀 더 구체적인 요리명으로 다시 물어보세요

어떤 방법을 원하시나요? 🍳`;
  }

  private getDefaultFallbackResponse(targetRecipe: string): string {
    return `${targetRecipe}에 대한 기본적인 정보를 준비 중입니다. 잠시만 기다려주세요! 🍽️`;
  }

  private getErrorResponse(targetRecipe: string): string {
    return `죄송합니다. "${targetRecipe}"에 대한 정보를 처리하는 중 오류가 발생했어요. 😔
잠시 후 다시 시도해주시거나, 다른 방식으로 질문해주세요!`;
  }

  private createSuccessMetadata(
    targetRecipe: string,
    processingTime: number,
    ragUsed: boolean
  ): ChatMessageMetadata {
    return {
      messageType: 'detail_request',
      recipeName: targetRecipe,
      processingTime,
      ragUsed,
      responseQuality: 0.9,
    };
  }

  private createFailureMetadata(
    targetRecipe: string,
    processingTime: number
  ): ChatMessageMetadata {
    return {
      messageType: 'detail_request',
      recipeName: targetRecipe,
      processingTime,
      ragUsed: false,
      responseQuality: 0.5,
    };
  }

  private createErrorMetadata(
    targetRecipe: string,
    processingTime: number,
    error: any
  ): ChatMessageMetadata {
    return {
      messageType: 'detail_request',
      recipeName: targetRecipe,
      processingTime,
      ragUsed: false,
      responseQuality: 0.1,
      errorInfo: {
        code: 'DETAIL_PROCESSING_ERROR',
        message: error.message || 'Unknown error',
        retryCount: 0,
      },
    };
  }
}