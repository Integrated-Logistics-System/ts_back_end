import { Injectable, Logger } from '@nestjs/common';
import { PromptFileLoaderService } from './prompt-file-loader.service';

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
 * 파일 기반 프롬프트 관리 + 성능 최적화 캐싱
 */
@Injectable()
export class TcreiPromptLoaderService {
  private readonly logger = new Logger(TcreiPromptLoaderService.name);
  
  // 프롬프트 캐시 (메모리 기반)
  private readonly promptCache = new Map<string, string>();
  private readonly cacheMaxSize = 100;
  private readonly cacheTtl = 300000; // 5분
  private readonly cacheTimestamps = new Map<string, number>();

  constructor(private readonly promptFileLoader: PromptFileLoaderService) {
    this.logger.log('🎯 TCREI 프레임워크 기반 프롬프트 로더 서비스 초기화됨 (파일 기반 + 캐싱)');
    
    // 캐시 정리 작업 (10분마다)
    setInterval(() => this.cleanupCache(), 600000);
  }

  /**
   * 캐시에서 프롬프트 조회 또는 생성
   */
  private getCachedPrompt(cacheKey: string, promptGenerator: () => string): string {
    const now = Date.now();
    
    // 캐시 확인
    const cached = this.promptCache.get(cacheKey);
    const timestamp = this.cacheTimestamps.get(cacheKey);
    
    if (cached && timestamp && (now - timestamp) < this.cacheTtl) {
      return cached;
    }
    
    // 새 프롬프트 생성
    const prompt = promptGenerator();
    
    // 캐시 크기 제한
    if (this.promptCache.size >= this.cacheMaxSize) {
      const oldestKey = Array.from(this.cacheTimestamps.entries())
        .sort(([,a], [,b]) => a - b)[0]?.[0];
      if (oldestKey) {
        this.promptCache.delete(oldestKey);
        this.cacheTimestamps.delete(oldestKey);
      }
    }
    
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

  // ================ 의도 분류 프롬프트 (파일 기반) ================

  async getIntentClassificationPrompt(params: IntentClassificationParams): Promise<string> {
    const { message, hasContext, lastRecipes = [], userReferences = [] } = params;
    
    try {
      return this.promptFileLoader.loadPrompt('intent-classification', {
        message,
        hasContext,
        lastRecipes: lastRecipes.length > 0 ? lastRecipes.join(', ') : '없음',
        userReferences: userReferences.length > 0 ? userReferences.join(', ') : '없음'
      });
    } catch (error) {
      this.logger.error('의도 분류 프롬프트 로드 실패, 기본 프롬프트 사용', error);
      return this.getIntentClassificationFallback(params);
    }
  }

  async getFallbackIntentClassificationPrompt(params: IntentClassificationParams): Promise<string> {
    const { message, hasContext, lastRecipes = [], userReferences = [] } = params;
    
    try {
      return this.promptFileLoader.loadPrompt('fallback-intent-classification', {
        message,
        hasContext,
        lastRecipes: lastRecipes.length > 0 ? lastRecipes.join(', ') : '없음',
        userReferences: userReferences.length > 0 ? userReferences.join(', ') : '없음'
      });
    } catch (error) {
      this.logger.error('폴백 의도 분류 프롬프트 로드 실패, 하드코딩 프롬프트 사용', error);
      return this.getIntentClassificationFallback(params);
    }
  }

  private getIntentClassificationFallback(params: IntentClassificationParams): string {
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

  // ================ 대체 레시피 프롬프트 (파일 기반) ================

  async getAlternativeRecipePrompt(params: AlternativeRecipeParams): Promise<string> {
    const { userMessage, originalRecipe, missingIngredients = [], availableIngredients = [], constraints = [] } = params;
    
    try {
      return this.promptFileLoader.loadPrompt('alternative-recipe', {
        userMessage,
        originalRecipe: originalRecipe?.name || originalRecipe?.nameKo || '알 수 없음',
        missingIngredients: missingIngredients.join(', ') || '없음',
        availableIngredients: availableIngredients.join(', ') || '없음',
        constraints: constraints.join(', ') || '없음'
      });
    } catch (error) {
      this.logger.error('대체 레시피 프롬프트 로드 실패, 기본 프롬프트 사용', error);
      return this.getAlternativeRecipeFallback(params);
    }
  }

  private getAlternativeRecipeFallback(params: AlternativeRecipeParams): string {
    const { userMessage, originalRecipe, missingIngredients = [] } = params;
    
    return `대체 레시피를 JSON 형식으로 제공해주세요.

기존 레시피: ${originalRecipe?.name || originalRecipe?.nameKo || '알 수 없음'}
부족한 재료: ${missingIngredients.join(', ') || '없음'}
사용자 요청: "${userMessage}"

JSON 응답:
{
  "nameKo": "대체 레시피명",
  "name": "Alternative Recipe Name",
  "descriptionKo": "대체 버전 설명",
  "description": "Alternative description",
  "ingredientsKo": ["재료1", "재료2"],
  "ingredients": ["ingredient1", "ingredient2"],
  "stepsKo": ["단계1", "단계2"],
  "steps": ["step1", "step2"],
  "cookingTime": 30,
  "difficulty": "보통"
}`;
  }

  // ================ 레시피 추천 프롬프트 (기존 유지) ================

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

  // ================ 일반 대화 프롬프트 (기존 유지) ================

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
}