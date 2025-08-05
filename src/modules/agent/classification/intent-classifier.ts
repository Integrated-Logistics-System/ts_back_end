import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { ConversationContext } from '../context/context-analyzer';
import { TcreiPromptLoaderService } from '../../prompt-templates/tcrei/tcrei-prompt-loader.service';

export enum UserIntent {
  RECIPE_LIST = 'recipe_list',                 // 레시피 목록/추천 요청
  RECIPE_DETAIL = 'recipe_detail',             // 특정 레시피 상세 정보 요청
  ALTERNATIVE_RECIPE = 'alternative_recipe',   // 대체 레시피 생성 필요
  GENERAL_CHAT = 'general_chat'                // 일반 대화
}

export interface IntentAnalysis {
  intent: UserIntent;
  confidence: number;
  reasoning: string;
  needsAlternative: boolean;
  missingItems?: string[];
  relatedRecipe?: string;
}

@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly tcreiPromptLoader: TcreiPromptLoaderService
  ) {}

  /**
   * 사용자 의도 분류 (LLM 기반)
   */
  async classifyIntent(
    message: string, 
    conversationContext?: ConversationContext
  ): Promise<IntentAnalysis> {
    try {
      const intentPrompt = await this.tcreiPromptLoader.getIntentClassificationPrompt({
        message,
        hasContext: conversationContext?.hasContext || false,
        lastRecipes: conversationContext?.lastRecipes || [],
        userReferences: conversationContext?.userReferences || []
      });
      
      const llmResponse = await this.aiService.generateResponse(intentPrompt, {
        temperature: 0.1
      });

      if (llmResponse) {
        try {
          // 마크다운 코드 블록 제거 후 JSON 파싱
          const cleanedResponse = this.cleanJsonResponse(llmResponse);
          const parsed = JSON.parse(cleanedResponse);
          const analysis: IntentAnalysis = {
            intent: this.mapIntent(parsed.intent),
            confidence: parsed.confidence || 0.7,
            reasoning: parsed.reasoning || '의도 분석 완료',
            needsAlternative: parsed.needsAlternative || false,
            missingItems: parsed.missingItems || [],
            relatedRecipe: parsed.relatedRecipe
          };

          this.logger.log(`🎯 의도 분류: "${message}" → ${analysis.intent} (신뢰도: ${analysis.confidence})`);
          return analysis;
        } catch (parseError) {
          this.logger.warn('LLM 의도 분류 파싱 실패:', parseError instanceof Error ? parseError.message : 'Unknown error');
          this.logger.warn('원본 응답:', llmResponse.substring(0, 200) + '...');
        }
      }
    } catch (llmError) {
      this.logger.warn('LLM 의도 분류 실패:', llmError);
    }

    // 폴백: LLM 기반 분류
    return await this.fallbackClassification(message, conversationContext);
  }


  /**
   * JSON 응답에서 마크다운 코드 블록 제거
   */
  private cleanJsonResponse(response: string): string {
    // 마크다운 코드 블록 제거 (```json ... ``` 또는 ``` ... ```)
    let cleaned = response.trim();
    
    // ```json으로 시작하는 경우
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    // ```으로 시작하는 경우
    else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // 추가 정리: 앞뒤 공백 제거
    return cleaned.trim();
  }

  private mapIntent(intentString: string): UserIntent {
    switch (intentString) {
      case 'recipe_list':
      case 'recipe_request':  // 하위 호환성
        return UserIntent.RECIPE_LIST;
      case 'recipe_detail':
        return UserIntent.RECIPE_DETAIL;
      case 'alternative_recipe':
      case 'alternaive_recipe': // AI 오타 처리
        return UserIntent.ALTERNATIVE_RECIPE;
      case 'general_chat':
        return UserIntent.GENERAL_CHAT;
      default:
        return UserIntent.GENERAL_CHAT;
    }
  }

  private async fallbackClassification(message: string, conversationContext?: ConversationContext): Promise<IntentAnalysis> {
    try {
      // LLM 기반 폴백 의도 분류 시도
      const llmFallbackResult = await this.performLlmFallbackClassification(message, conversationContext);
      if (llmFallbackResult) {
        return llmFallbackResult;
      }
    } catch (error) {
      this.logger.warn('LLM 폴백 의도 분류 실패, 간소화된 분류 사용:', error);
    }

    // 최후 수단: 간소화된 키워드 기반 분류
    return await this.performSimplifiedClassification(message, conversationContext);
  }

  /**
   * 🧠 LLM 기반 폴백 의도 분류
   */
  private async performLlmFallbackClassification(message: string, conversationContext?: ConversationContext): Promise<IntentAnalysis | null> {
    const fallbackPrompt = await this.tcreiPromptLoader.getFallbackIntentClassificationPrompt({
      message,
      hasContext: conversationContext?.hasContext || false,
      lastRecipes: conversationContext?.lastRecipes || [],
      userReferences: conversationContext?.userReferences || []
    });

    let llmResponse: string | undefined;
    
    try {
      llmResponse = await this.aiService.generateResponse(fallbackPrompt, {
        temperature: 0.1
      });

      if (llmResponse) {
        // 마크다운 코드 블록 제거 후 JSON 파싱
        const cleanedResponse = this.cleanJsonResponse(llmResponse);
        const parsed = JSON.parse(cleanedResponse);
        return {
          intent: this.mapIntent(parsed.intent),
          confidence: parsed.confidence || 0.7,
          reasoning: parsed.reasoning || 'LLM 기반 폴백 분류',
          needsAlternative: parsed.needsAlternative || false,
          missingItems: parsed.missingItems || [],
          relatedRecipe: parsed.relatedRecipe
        };
      }
    } catch (error) {
      this.logger.warn('LLM 폴백 분류 파싱 실패:', error instanceof Error ? error.message : 'Unknown error');
      this.logger.warn('폴백 응답:', llmResponse?.substring(0, 200) + '...');
    }

    return null;
  }

  /**
   * 간소화된 키워드 기반 분류 (최후 수단)
   */
  private async performSimplifiedClassification(message: string, conversationContext?: ConversationContext): Promise<IntentAnalysis> {
    const messageLower = message.toLowerCase();
    
    // 대체 레시피 필요한지 먼저 확인 (핵심 키워드만)
    if (conversationContext?.hasContext && conversationContext.lastRecipes.length > 0) {
      const hasMissing = ['없어서', '없으면', '어떻게'].some(term => messageLower.includes(term));
      if (hasMissing) {
        return {
          intent: UserIntent.ALTERNATIVE_RECIPE,
          confidence: 0.7,
          reasoning: '대화 맥락과 제약사항 키워드 감지',
          needsAlternative: true,
          missingItems: [],
          relatedRecipe: conversationContext.lastRecipes[0]
        };
      }
    }

    // AI 기반 최종 분류 시도 (더 간단한 프롬프트)
    try {
      const simplePrompt = `사용자 메시지: "${message}"

이 메시지의 의도를 분류해주세요:
- recipe_list: 요리 추천이나 목록을 원함
- recipe_detail: 특정 요리 만드는 방법을 원함
- alternative_recipe: 다른 방법이나 대체재를 원함  
- general_chat: 일반 대화

JSON 답변만 (설명 없이):
{"intent": "분류결과", "confidence": 0.8, "reasoning": "이유", "needsAlternative": false}`;

      const simpleResponse = await this.aiService.generateResponse(simplePrompt, {
        temperature: 0.1
      });

      if (simpleResponse) {
        const cleaned = this.cleanJsonResponse(simpleResponse);
        const parsed = JSON.parse(cleaned);
        return {
          intent: this.mapIntent(parsed.intent),
          confidence: parsed.confidence || 0.5,
          reasoning: `최종 AI 분류: ${parsed.reasoning}`,
          needsAlternative: parsed.needsAlternative || false,
          missingItems: [],
          relatedRecipe: undefined
        };
      }
    } catch (error) {
      this.logger.warn('최종 AI 분류도 실패:', error);
    }

    // 최후 수단: 안전한 기본값
    return {
      intent: UserIntent.GENERAL_CHAT,
      confidence: 0.3,
      reasoning: '모든 분류 방법 실패, 안전한 기본값으로 설정',
      needsAlternative: false
    };
  }
}