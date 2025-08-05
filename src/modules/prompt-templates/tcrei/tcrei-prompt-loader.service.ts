import { Injectable, Logger } from '@nestjs/common';

// TCREI template imports - 인라인으로 포함
export interface IntentClassificationParams {
  message: string;
  hasContext: boolean;
  lastRecipes?: string[];
  userReferences?: string[];
}

export interface RecipeRecommendationParams {
  userMessage: string;
  ragContext: string;
  hasContext: boolean;
  lastRecipes?: string[];
  conversationSummary?: string;
  constraintAnalysis?: string;
}

export interface GeneralChatParams {
  userMessage: string;
  conversationContext?: string;
  isRecipeRelated?: boolean;
  suggestedTopics?: string[];
}

export interface AlternativeRecipeParams {
  userMessage: string;
  originalRecipe?: any;
  missingIngredients?: string[];
  availableIngredients?: string[];
  constraints?: string[];
  preferredMethods?: string[];
}

/**
 * TCREI (Google's AI Prompting Framework) 기반 프롬프트 로더 서비스
 * 성능 최적화: 프롬프트 캐싱 및 템플릿 재사용
 */
@Injectable()
export class TcreiPromptLoaderService {
  private readonly logger = new Logger(TcreiPromptLoaderService.name);
  
  // 프롬프트 캐시 (메모리 기반)
  private readonly promptCache = new Map<string, string>();
  private readonly cacheMaxSize = 100;
  private readonly cacheTtl = 300000; // 5분
  private readonly cacheTimestamps = new Map<string, number>();

  constructor() {
    this.logger.log('🎯 TCREI 프레임워크 기반 프롬프트 로더 서비스 초기화됨 (캐싱 활성화)');
    
    // 캐시 정리 작업 (10분마다)
    setInterval(() => this.cleanupCache(), 600000);
  }

  /**
   * 캐시에서 프롬프트 조회 또는 생성
   */
  private getCachedPrompt(cacheKey: string, generator: () => string): string {
    const now = Date.now();
    
    // 캐시 히트 확인
    if (this.promptCache.has(cacheKey)) {
      const timestamp = this.cacheTimestamps.get(cacheKey);
      if (timestamp && (now - timestamp) < this.cacheTtl) {
        return this.promptCache.get(cacheKey)!;
      }
    }
    
    // 캐시 미스 - 새로 생성
    const prompt = generator();
    
    // 캐시 크기 제한
    if (this.promptCache.size >= this.cacheMaxSize) {
      const entries = Array.from(this.cacheTimestamps.entries());
      if (entries.length > 0) {
        const oldestEntry = entries.sort(([,a], [,b]) => a - b)[0];
        if (oldestEntry) {
          const oldestKey = oldestEntry[0];
          this.promptCache.delete(oldestKey);
          this.cacheTimestamps.delete(oldestKey);
        }
      }
    }
    
    // 캐시에 저장
    this.promptCache.set(cacheKey, prompt);
    this.cacheTimestamps.set(cacheKey, now);
    
    return prompt;
  }

  /**
   * 만료된 캐시 엔트리 정리
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if ((now - timestamp) > this.cacheTtl) {
        this.promptCache.delete(key);
        this.cacheTimestamps.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.log(`🧹 프롬프트 캐시 정리 완료: ${cleaned}개 항목 제거`);
    }
  }

  // ================ 의도 분류 프롬프트 (TCREI) ================

  async getIntentClassificationPrompt(params: IntentClassificationParams): Promise<string> {
    const { message, hasContext, lastRecipes = [], userReferences = [] } = params;
    
    // 캐시 키 생성 (메시지 내용 제외, 구조적 요소만)
    const cacheKey = `intent_${hasContext}_${lastRecipes.length}_${userReferences.length}`;
    
    const basePrompt = this.getCachedPrompt(cacheKey, () => {
      const context = hasContext 
        ? `# 대화 맥락 정보:
- 최근 언급된 레시피: ${lastRecipes.join(', ') || '없음'}
- 사용자가 참조한 내용: ${userReferences.join(', ') || '없음'}`
        : `# 대화 맥락 정보: 새로운 대화 시작`;
    
      return `# Task (작업)
당신은 요리 전문 챗봇의 의도 분석 전문가입니다. 사용자의 메시지를 분석하여 다음 4가지 의도 중 하나로 정확히 분류해주세요.

## Context (맥락)
- 환경: 한국어 요리 챗봇 시스템
- 사용자: 요리에 관심 있는 일반인
- 목적: 적절한 응답 전략 선택을 위한 의도 파악

${context}

## Reference (참조 기준)

### 1. recipe_list (레시피 목록/추천)
**예시**: "오늘 저녁 뭐 해먹을까?", "닭가슴살로 만들 수 있는 요리들 보여줘"

### 2. recipe_detail (특정 레시피 상세 정보)
**예시**: "김치찌개 만드는 법 알려줘", "카르보나라 어떻게 만들어?"

### 3. alternative_recipe (대체 레시피/변형)
**예시**: "양파 없으면 뭘로 대체할까?", "더 간단한 방법 없을까?"

### 4. general_chat (일반 대화)
**예시**: "안녕하세요", "고마워", "날씨가 좋네요"

## Evaluate (평가 기준)
JSON 형식으로 응답 (코드 블록 없이):
{
  "intent": "recipe_list|recipe_detail|alternative_recipe|general_chat",
  "confidence": 0.0~1.0,
  "reasoning": "판단 근거",
  "needsAlternative": true/false,
  "missingItems": ["부족한 재료"],
  "relatedRecipe": "관련 레시피명"
}

사용자 메시지: "{{USER_MESSAGE}}"`;
    });
    
    // 사용자 메시지를 동적으로 삽입
    return basePrompt.replace('{{USER_MESSAGE}}', message);
  }

  async getFallbackIntentClassificationPrompt(params: IntentClassificationParams): Promise<string> {
    return `간단한 의도 분류를 수행해주세요.

사용자 메시지: "${params.message}"

JSON으로 응답:
{
  "intent": "recipe_list|recipe_detail|alternative_recipe|general_chat",
  "confidence": 0.5,
  "reasoning": "간단한 판단",
  "needsAlternative": false,
  "missingItems": [],
  "relatedRecipe": null
}`;
  }

  // ================ 레시피 추천 프롬프트 (TCREI) ================

  async getRecipeRecommendationPrompt(params: RecipeRecommendationParams): Promise<string> {
    const { userMessage, ragContext, hasContext, lastRecipes = [], conversationSummary = '', constraintAnalysis = '' } = params;
    
    const contextInfo = hasContext 
      ? `**대화 맥락**: 최근 관심 레시피: ${lastRecipes.join(', ')}, 요약: ${conversationSummary}`
      : '**대화 상태**: 새로운 요청';
    
    return `# Task (작업)
당신은 전문적이면서도 친근한 요리 어시스턴트입니다. 검색된 레시피 정보를 바탕으로 사용자에게 맞춤형 추천을 제공해주세요.

## Context (맥락)
${contextInfo}
**제약사항**: ${constraintAnalysis}

## Reference (참조 기준)
🍽️ **[요리 카테고리] 추천**

[검색 결과 요약]

1. **[레시피명]** (⏱️ [시간], 🌟 [난이도])
   → [특징 설명]

💡 **조리 팁**: [실용적인 팁]

궁금한 점이 있으시면 언제든 말씀해 주세요! 😊

## Evaluate (평가 기준)
- 적합성: 사용자 요청과 검색 결과 일치
- 실용성: 실제 만들 수 있는 수준
- 친근함: 부담스럽지 않은 톤

사용자 요청: "${userMessage}"

검색된 레시피 정보:
${ragContext}`;
  }

  async getFallbackRecipePrompt(params: RecipeRecommendationParams): Promise<string> {
    return `친근한 요리 어시스턴트로서 도움이 되는 답변을 해주세요.

사용자 요청: "${params.userMessage}"
관련 정보: ${params.ragContext}`;
  }

  // ================ 일반 대화 프롬프트 (TCREI) ================

  async getGeneralChatPrompt(params: GeneralChatParams): Promise<string> {
    const { userMessage, conversationContext = '', isRecipeRelated = false, suggestedTopics = [] } = params;
    
    const contextInfo = conversationContext 
      ? `**대화 맥락**: ${conversationContext}`
      : '**대화 상태**: 새로운 대화 시작';
    
    const topicSuggestions = isRecipeRelated || suggestedTopics.length > 0
      ? `**연결 가능 주제**: ${suggestedTopics.join(', ')}`
      : '';
    
    return `# Task (작업)
당신은 친근하고 지식이 풍부한 요리 전문 챗봇입니다. 사용자와 자연스럽고 따뜻한 대화를 나누세요.

## Context (맥락)
${contextInfo}
${topicSuggestions}

## Reference (참조 기준)
- 친근하고 자연스러운 대화 상대
- 요리에 대한 전문 지식 보유
- 필요시 요리 관련 주제로 자연스럽게 연결

## Evaluate (평가 기준)
- 자연스러움: 어색하지 않은 대화 흐름
- 가치 제공: 도움이 되는 정보나 관심 유발
- 친근함: 따뜻하고 편안한 톤

사용자 메시지: "${userMessage}"`;
  }

  async getFallbackGeneralChatPrompt(userMessage: string): Promise<string> {
    return `친근한 요리 어시스턴트로서 자연스럽게 응답해주세요.

사용자 메시지: "${userMessage}"`;
  }

  // ================ 대체 레시피 프롬프트 (TCREI) ================

  async getAlternativeRecipePrompt(params: AlternativeRecipeParams): Promise<string> {
    const { userMessage, originalRecipe, missingIngredients = [], availableIngredients = [], constraints = [] } = params;
    
    const recipeInfo = originalRecipe 
      ? `**기존 레시피**: ${originalRecipe.name || originalRecipe.nameKo || '알 수 없음'}`
      : '**기존 레시피**: 정보 없음';
    
    const ingredientInfo = missingIngredients.length > 0 || availableIngredients.length > 0
      ? `**재료 상황**: 없는 재료(${missingIngredients.join(', ')}), 있는 재료(${availableIngredients.join(', ')})`
      : '**재료 상황**: 정보 없음';
    
    const constraintInfo = constraints.length > 0
      ? `**제약사항**: ${constraints.join(', ')}`
      : '**제약사항**: 없음';
    
    return `# Task (작업)
당신은 창의적이고 실용적인 요리 문제 해결 전문가입니다. 사용자의 제약사항에 맞는 레시피 대안 솔루션을 제공하세요.

## Context (맥락)
${recipeInfo}
${ingredientInfo}
${constraintInfo}

## Reference (참조 기준)
🔄 **[레시피명] 대체 방안**

📋 **상황 분석**: [문제점과 목표]

💡 **추천 대안**:
1️⃣ [대안 1] - ⭐ 추천도 높음
**변경사항**: [구체적인 변경 내용]
**장점**: [이유]
**주의점**: [포인트]

🎯 **핵심 팁**: [결정적 조언]

## Evaluate (평가 기준)
- 실현 가능성: 실제로 시도할 수 있는 현실적 방법
- 맛 유지도: 원래 레시피의 핵심 맛 유지
- 접근성: 재료나 도구를 쉽게 구할 수 있음

사용자 요청: "${userMessage}"`;
  }
}