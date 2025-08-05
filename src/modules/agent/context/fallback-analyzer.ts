import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { ConversationHistory } from './context-analyzer';

export interface FallbackAnalysisResult {
  userReferences: string[];
  lastRecipes: string[];
  conversationSummary: string;
  confidence: number;
  method: 'llm' | 'pattern_matching';
}

@Injectable()
export class LlmFallbackAnalyzerService {
  private readonly logger = new Logger(LlmFallbackAnalyzerService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * 🧠 LLM 기반 폴백 분석 (하드코딩된 정규식 패턴 대체)
   */
  async analyzeFallback(
    message: string,
    recentHistory: ConversationHistory[]
  ): Promise<FallbackAnalysisResult> {
    try {
      // 먼저 LLM 기반 분석 시도
      const llmResult = await this.performLlmAnalysis(message, recentHistory);
      if (llmResult) {
        return {
          ...llmResult,
          method: 'llm',
          confidence: 0.8
        };
      }
    } catch (error) {
      this.logger.warn('LLM 폴백 분석 실패, 패턴 매칭으로 전환:', error);
    }

    // LLM 실패 시 간소화된 패턴 매칭
    return this.performSimplifiedPatternMatching(message, recentHistory);
  }

  /**
   * LLM 기반 폴백 분석
   */
  private async performLlmAnalysis(
    message: string,
    recentHistory: ConversationHistory[]
  ): Promise<Omit<FallbackAnalysisResult, 'method' | 'confidence'> | null> {
    const analysisPrompt = `다음 대화를 분석해서 필요한 정보를 추출해주세요:

=== 대화 히스토리 ===
${recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

=== 현재 사용자 메시지 ===
"${message}"

=== 추출 작업 ===
다음 3가지 정보를 자연어 이해를 통해 추출해주세요:

1. **userReferences**: 현재 메시지에서 이전 대화를 참조하는 표현들
   - 예: "그거", "그것", "다른", "대신", "말고", "없어서" 등
   - 자연스러운 참조 표현을 모두 찾아주세요

2. **lastRecipes**: 이전 대화에서 언급된 요리/레시피 이름들
   - 어시스턴트가 추천했거나 언급한 구체적인 요리명
   - 한국어 요리명을 정확히 추출해주세요

3. **conversationSummary**: 대화 맥락의 핵심 요약 (80자 이내)
   - 사용자의 상황, 요청, 제약사항을 포함
   - 자연스럽고 이해하기 쉽게 작성

=== 응답 형식 ===
{
  "userReferences": ["참조 표현들"],
  "lastRecipes": ["요리명들"],
  "conversationSummary": "대화 맥락 요약"
}

자연어 이해 능력을 활용해서 정확하게 분석해주세요. JSON만 응답하세요:`;

    try {
      const llmResponse = await this.aiService.generateResponse(analysisPrompt, {
        temperature: 0.1
      });

      if (llmResponse) {
        const parsed = JSON.parse(llmResponse);
        return {
          userReferences: Array.isArray(parsed.userReferences) ? parsed.userReferences : [],
          lastRecipes: Array.isArray(parsed.lastRecipes) ? parsed.lastRecipes : [],
          conversationSummary: typeof parsed.conversationSummary === 'string' ? parsed.conversationSummary : ''
        };
      }
    } catch (error) {
      this.logger.warn('LLM 폴백 분석 파싱 실패:', error);
    }

    return null;
  }

  /**
   * 간소화된 패턴 매칭 (최후 수단)
   */
  private performSimplifiedPatternMatching(
    message: string,
    recentHistory: ConversationHistory[]
  ): FallbackAnalysisResult {
    this.logger.log('🔄 간소화된 패턴 매칭 수행');

    // 1. 핵심 참조 표현만 감지 (하드코딩 최소화)
    const coreReferences = ['그거', '그것', '다른', '대신', '말고', '없어서'];
    const foundReferences = coreReferences.filter(ref => message.includes(ref));

    // 2. 간단한 레시피 추출 (LLM 기반 접근 시도)
    const foundRecipes = this.extractRecipesSimply(recentHistory);

    // 3. 기본 요약 생성
    const summary = this.generateBasicSummary(message, recentHistory, foundReferences.length > 0);

    return {
      userReferences: foundReferences,
      lastRecipes: foundRecipes,
      conversationSummary: summary,
      confidence: 0.6,
      method: 'pattern_matching'
    };
  }

  /**
   * 간단한 레시피 추출 (LLM 없이)
   */
  private extractRecipesSimply(recentHistory: ConversationHistory[]): string[] {
    const recipes: string[] = [];
    
    // 어시스턴트 메시지에서 일반적인 요리명 패턴 찾기
    const commonFoods = [
      '파스타', '스파게티', '볶음밥', '찌개', '케밥', '샐러드', '수프', 
      '스테이크', '치킨', '피자', '라면', '국수', '떡볶이', '김밥'
    ];

    recentHistory
      .filter(msg => msg.role === 'assistant')
      .forEach(msg => {
        commonFoods.forEach(food => {
          if (msg.content.includes(food) && !recipes.includes(food)) {
            recipes.push(food);
          }
        });
      });

    return recipes.slice(0, 3); // 최대 3개
  }

  /**
   * 기본 요약 생성
   */
  private generateBasicSummary(
    message: string, 
    recentHistory: ConversationHistory[], 
    hasReferences: boolean
  ): string {
    if (recentHistory.length === 0) {
      return `새로운 대화: ${message.substring(0, 50)}`;
    }

    const lastUserMsg = recentHistory.filter(m => m.role === 'user').pop();
    
    if (hasReferences) {
      return `사용자가 이전 대화를 참조하며 ${message.substring(0, 30)}`;
    } else {
      return `사용자 요청: ${lastUserMsg?.content?.substring(0, 50) || message.substring(0, 50)}`;
    }
  }

  /**
   * 🧠 LLM 기반 참조 표현 감지 (별도 메서드)
   */
  async detectReferences(message: string): Promise<string[]> {
    try {
      const referencePrompt = `다음 메시지에서 이전 대화를 참조하는 표현들을 찾아주세요:

메시지: "${message}"

참조 표현이란 이전에 언급된 것을 가리키는 말들입니다.
예: "그거", "그것", "다른", "대신", "말고", "없어서", "안돼서", "못해서" 등

자연어 이해를 통해 참조 표현을 찾아서 배열로 응답해주세요:
["참조표현1", "참조표현2", ...]

배열만 응답하세요:`;

      const llmResponse = await this.aiService.generateResponse(referencePrompt, {
        temperature: 0.1
      });

      if (llmResponse) {
        const parsed = JSON.parse(llmResponse);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      this.logger.warn('LLM 참조 표현 감지 실패:', error);
    }

    // 폴백: 기본 패턴 매칭
    const coreReferences = ['그거', '그것', '다른', '대신', '말고', '없어서'];
    return coreReferences.filter(ref => message.includes(ref));
  }

  /**
   * 🧠 LLM 기반 레시피 추출 (별도 메서드)
   */
  async extractRecipes(conversationHistory: ConversationHistory[]): Promise<string[]> {
    if (conversationHistory.length === 0) return [];

    try {
      const extractionPrompt = `다음 대화에서 언급된 구체적인 요리/레시피 이름들을 추출해주세요:

${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

어시스턴트가 추천했거나 언급한 구체적인 요리명만 추출해주세요.
한국어 요리명을 정확히 찾아서 배열로 응답해주세요:
["요리명1", "요리명2", ...]

배열만 응답하세요:`;

      const llmResponse = await this.aiService.generateResponse(extractionPrompt, {
        temperature: 0.1
      });

      if (llmResponse) {
        const parsed = JSON.parse(llmResponse);
        return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
      }
    } catch (error) {
      this.logger.warn('LLM 레시피 추출 실패:', error);
    }

    // 폴백: 간단한 패턴 매칭
    return this.extractRecipesSimply(conversationHistory);
  }
}