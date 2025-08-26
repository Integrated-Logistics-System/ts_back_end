import { Injectable, Logger } from '@nestjs/common';
import { Ollama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { IntentAnalysis, ConversationContext } from '../types/langchain.types';

@Injectable()
export class IntentAnalysisService {
  private readonly logger = new Logger(IntentAnalysisService.name);
  private readonly ollama: Ollama;
  private readonly intentPrompt: PromptTemplate;

  constructor() {
    // Ollama 모델 초기화 (의도 분류용)
    this.ollama = new Ollama({
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3:1.7b',
      temperature: parseFloat(process.env.OLLAMA_TEMPERATURE_CLASSIFICATION || '0.1'),
    });

    // 지능형 의도 분류 프롬프트
    this.intentPrompt = PromptTemplate.fromTemplate(`
다음 사용자 메시지를 뛰어난 AI 셰프로서 정밀하게 분석하고 의도를 분류해주세요.

사용자 메시지: {message}

컨텍스트 정보:
{context}

의도 분류:
1. **recipe_list**: 사용자가 여러 레시피 추천을 원하는 경우
   - "오늘 저녁 메뉴 추천해주세요", "닭가슴살 요리 알려주세요"
   - "간단한 요리", "다이어트 음식", "매운 음식"

2. **recipe_detail**: 특정 레시피의 상세한 만드는 법을 원하는 경우
   - "김치찌개 만드는 법", "불고기 레시피 자세히"
   - "파스타 조리법", "케이크 굽는 방법"

3. **cooking_help**: 요리 과정에서의 도움이나 팁을 원하는 경우
   - "고기가 너무 질긴데 어떻게 해야 하나요?"
   - "소금 대신 뭘 쓸 수 있나요?", "이 재료는 어떻게 보관하나요?"

4. **general_chat**: 일반적인 대화나 인사
   - "안녕하세요", "고마워요", "오늘 날씨가 좋네요"

**중요**: 응답은 반드시 다음 JSON 형식으로만 제공하세요:
{{
  "intent": "recipe_list|recipe_detail|cooking_help|general_chat",
  "confidence": 0.0-1.0,
  "reasoning": "분류한 이유를 한 문장으로",
  "recipeKeywords": ["키워드1", "키워드2"] (선택사항),
  "specificRecipe": "특정 레시피명" (recipe_detail인 경우만)
}}
    `);

    this.logger.log('🎯 Intent Analysis Service initialized');
  }

  /**
   * 사용자 메시지의 의도를 분석합니다
   */
  async analyzeIntent(message: string, context?: ConversationContext): Promise<IntentAnalysis> {
    const startTime = Date.now();
    
    try {
      const contextStr = this.buildContextString(context);
      const intentPromptValue = await this.intentPrompt.format({ message, context: contextStr });
      const intentResult = await this.ollama.invoke(intentPromptValue);

      this.logger.log(`🎯 Intent analysis for: "${message.substring(0, 30)}..."`);

      // JSON 파싱 시도
      try {
        // JSON 추출 (첫 번째 완전한 JSON 객체)
        const jsonMatch = intentResult.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const processingTime = Date.now() - startTime;
          
          this.logger.log(`✅ Intent: ${parsed.intent} (${parsed.confidence.toFixed(2)}) - ${processingTime}ms`);
          
          return {
            intent: parsed.intent || 'general_chat',
            confidence: parsed.confidence || 0.7,
            reasoning: parsed.reasoning || 'Fallback classification',
            recipeKeywords: parsed.recipeKeywords || [],
            specificRecipe: parsed.specificRecipe
          };
        }
      } catch (parseError) {
        this.logger.warn('🔍 JSON 파싱 실패, 키워드 기반 분류 사용');
        this.logger.warn('📋 AI 응답 원본:', intentResult.substring(0, 200));
        this.logger.warn('💥 파싱 에러:', parseError instanceof Error ? parseError.message : parseError);
      }

      // Fallback: 키워드 기반 분류
      return this.fallbackIntentClassification(message);
    } catch (error) {
      this.logger.error('❌ 의도 분석 오류:', error);
      return this.fallbackIntentClassification(message);
    }
  }

  /**
   * Fallback 의도 분류 (규칙 기반)
   */
  private fallbackIntentClassification(message: string): IntentAnalysis {
    const detailKeywords = /만드는\s*법|어떻게|조리법|레시피.*자세히|상세히|단계별|방법/i;
    const helpKeywords = /대신|대체|실패|왜|문제|보관|익혀야|온도|시간|팁/i;
    const recipeKeywords = /(레시피|요리|만들|음식|메뉴|추천|간식|반찬|국물|찌개|볶음|구이)/i;

    if (detailKeywords.test(message)) {
      return {
        intent: 'recipe_detail',
        confidence: 0.8,
        reasoning: 'Keyword-based: 상세 레시피 요청 감지'
      };
    }

    if (helpKeywords.test(message)) {
      return {
        intent: 'cooking_help',
        confidence: 0.8,
        reasoning: 'Keyword-based: 요리 도움 요청 감지'
      };
    }

    if (recipeKeywords.test(message)) {
      return {
        intent: 'recipe_list',
        confidence: 0.8,
        reasoning: 'Keyword-based: 레시피 목록 요청 감지'
      };
    }

    return {
      intent: 'general_chat',
      confidence: 0.6,
      reasoning: 'Keyword-based: 일반 대화로 분류'
    };
  }

  /**
   * 컨텍스트 정보를 문자열로 변환
   */
  private buildContextString(context?: ConversationContext): string {
    if (!context) return '컨텍스트 정보 없음';

    let contextStr = '';
    
    if (context.history && context.history.length > 0) {
      contextStr += `이전 대화: ${context.history.slice(-3).map(h => 
        `${h.type}: ${h.text}`
      ).join(', ')}\n`;
    }
    
    if (context.allergies && context.allergies.length > 0) {
      contextStr += `알레르기: ${context.allergies.join(', ')}\n`;
    }
    
    if (context.cookingLevel) {
      contextStr += `요리 수준: ${context.cookingLevel}\n`;
    }

    return contextStr || '컨텍스트 정보 없음';
  }
}