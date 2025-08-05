import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { LlmFallbackAnalyzerService } from './fallback-analyzer';

export interface ConversationContext {
  hasContext: boolean;
  lastRecipes: string[];
  userReferences: string[];
  conversationSummary: string;
}

export interface ConversationHistory {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ConversationContextService {
  private readonly logger = new Logger(ConversationContextService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly llmFallbackAnalyzerService: LlmFallbackAnalyzerService
  ) {}

  /**
   * 🧠 대화 맥락 분석 (LLM 기반)
   */
  async analyzeContext(
    message: string,
    conversationHistory?: ConversationHistory[]
  ): Promise<ConversationContext> {
    const context: ConversationContext = {
      hasContext: false,
      lastRecipes: [],
      userReferences: [],
      conversationSummary: ''
    };

    if (!conversationHistory || conversationHistory.length === 0) {
      return context;
    }

    context.hasContext = true;
    this.logger.log(`📚 대화 히스토리 분석: ${conversationHistory.length}개 메시지`);

    // 최근 3개 대화만 분석 (성능상 이유)
    const recentHistory = conversationHistory.slice(-6); // user-assistant 쌍으로 3세트
    
    try {
      // LLM을 통한 대화 맥락 분석 (개선된 프롬프트)
      const contextAnalysisPrompt = `당신은 대화 맥락을 정확히 분석하는 전문 어시스턴트입니다.

다음 대화 히스토리와 현재 사용자 메시지를 분석하여 정확한 JSON 형태로 응답해주세요.

=== 대화 히스토리 ===
${recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

=== 현재 사용자 메시지 ===
"${message}"

=== 추출할 정보 ===
다음 3가지 정보를 정확히 추출해주세요:

1. **lastRecipes** (배열): 
   - 이전 대화에서 언급된 구체적인 요리/레시피 이름들
   - 어시스턴트가 추천했거나 사용자가 언급한 모든 요리명 포함
   - 없으면 빈 배열 []

2. **userReferences** (배열):
   - 현재 메시지에서 이전 대화를 참조하는 모든 표현들
   - 포함할 표현: "그거", "그것", "그런", "다른", "또 다른", "대신", "말고", "없어서", "안돼서", "못해서" 등
   - 없으면 빈 배열 []

3. **conversationSummary** (문자열):
   - 대화의 핵심 맥락을 80자 이내로 요약
   - 사용자의 요청, 제약사항, 상황을 포함
   - 빈 문자열이면 안됨

=== 응답 예시 ===
시나리오 1 - 일반적인 경우:
{
  "lastRecipes": ["지중해식 치킨 케밥", "토마토 파스타"],
  "userReferences": ["그것", "없어서"],
  "conversationSummary": "사용자가 케밥을 요청했지만 도구가 부족해서 대안을 찾고있음"
}

시나리오 2 - 첫 대화인 경우:
{
  "lastRecipes": [],
  "userReferences": [],
  "conversationSummary": "사용자가 처음으로 파스타 레시피를 요청함"
}

시나리오 3 - 참조 표현이 많은 경우:
{
  "lastRecipes": ["김치찌개", "된장찌개"],
  "userReferences": ["그런", "말고", "다른"],
  "conversationSummary": "사용자가 찌개류 대신 다른 종류의 요리를 원함"
}

=== 중요 지침 ===
- 반드시 유효한 JSON 형태로만 응답하세요
- 모든 문자열은 쌍따옴표로 감싸세요
- 배열이 비어있으면 []로, 문자열이 비어있으면 ""로 표시하세요
- JSON 외의 다른 텍스트는 절대 포함하지 마세요
- 확실하지 않은 정보는 포함하지 마세요

JSON 응답:`;

      const llmResponse = await this.aiService.generateResponse(contextAnalysisPrompt, {
        temperature: 0.1
      });

      if (llmResponse) {
        try {
          // JSON 응답에서 불필요한 텍스트 제거 (더 robust한 파싱)
          let cleanedResponse = llmResponse.trim();
          
          // JSON 블록 추출 (```json ``` 형태로 감싸진 경우 처리)
          const jsonMatch = cleanedResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanedResponse = jsonMatch[1];
          }
          
          // 첫 번째와 마지막 중괄호 사이의 내용만 추출
          const startIndex = cleanedResponse.indexOf('{');
          const lastIndex = cleanedResponse.lastIndexOf('}');
          if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
            cleanedResponse = cleanedResponse.substring(startIndex, lastIndex + 1);
          }
          
          const parsed = JSON.parse(cleanedResponse);
          
          // 타입 검증 및 안전한 할당
          context.lastRecipes = Array.isArray(parsed.lastRecipes) ? parsed.lastRecipes : [];
          context.userReferences = Array.isArray(parsed.userReferences) ? parsed.userReferences : [];
          context.conversationSummary = typeof parsed.conversationSummary === 'string' ? parsed.conversationSummary : '';
          
          this.logger.log('✅ LLM 대화 맥락 분석 성공');
        } catch (parseError) {
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
          this.logger.warn('LLM 응답 파싱 실패, 폴백 분석 수행:', errorMessage);
          
          // 폴백: LLM 기반 분석으로 정보 추출
          await this.performLlmFallbackAnalysis(message, recentHistory, context);
        }
      } else {
        this.logger.warn('LLM 응답이 비어있음, 폴백 분석 수행');
        await this.performLlmFallbackAnalysis(message, recentHistory, context);
      }
    } catch (llmError) {
      this.logger.warn('LLM 대화 맥락 분석 실패:', llmError);
      // 폴백: 간단한 요약만 생성
      if (recentHistory.length > 0) {
        const lastUserMsg = recentHistory.filter(m => m.role === 'user').pop();
        context.conversationSummary = `최근 사용자 요청: ${lastUserMsg?.content?.substring(0, 50) || ''}`;
      }
    }

    this.logger.log(`🔍 대화 맥락 - 이전 레시피: [${context.lastRecipes.join(', ')}], 참조: [${context.userReferences.join(', ')}]`);
    return context;
  }

  /**
   * 🧠 LLM 기반 폴백 분석 (하드코딩된 정규식 패턴 대체)
   */
  private async performLlmFallbackAnalysis(
    message: string, 
    recentHistory: ConversationHistory[], 
    context: ConversationContext
  ): Promise<void> {
    try {
      this.logger.log('🧠 LLM 기반 폴백 분석 수행 중...');
      
      const fallbackResult = await this.llmFallbackAnalyzerService.analyzeFallback(message, recentHistory);
      
      // 결과를 context에 적용
      context.userReferences = fallbackResult.userReferences;
      context.lastRecipes = fallbackResult.lastRecipes;
      context.conversationSummary = fallbackResult.conversationSummary;
      
      this.logger.log(`🧠 LLM 폴백 분석 완료 (${fallbackResult.method}) - 레시피: ${context.lastRecipes.length}개, 참조: ${context.userReferences.length}개, 신뢰도: ${fallbackResult.confidence}`);
    } catch (error) {
      this.logger.warn('LLM 폴백 분석 실패, 기본 요약만 생성:', error);
      
      // 최후 수단: 매우 간단한 요약만 생성
      if (recentHistory.length > 0) {
        const lastUserMsg = recentHistory.filter(m => m.role === 'user').pop();
        context.conversationSummary = `사용자 요청: ${lastUserMsg?.content?.substring(0, 50) || message.substring(0, 50)}`;
      } else {
        context.conversationSummary = `새로운 대화: ${message.substring(0, 50)}`;
      }
      
      context.userReferences = [];
      context.lastRecipes = [];
    }
  }
}