/**
 * 🍖 LangChain 기반 대체 재료 추천 서비스
 * AI를 활용한 지능형 재료 대체 추천 시스템
 */

import { Injectable, Logger } from '@nestjs/common';
import { LangChainCoreService } from './langchain-core.service';
import { LangChainPromptService } from './langchain-prompt.service';

export interface IngredientSubstituteRequest {
  ingredient: string;
  context?: string; // 요리 맥락 (예: "파스타에 쓸", "볶음요리에")
  allergies?: string[]; // 알레르기 정보
  dietaryRestrictions?: string[]; // 식단 제한 (채식, 비건 등)
  availableIngredients?: string[]; // 현재 가지고 있는 재료들
}

export interface SubstituteOption {
  name: string;
  reason: string;
  ratio?: string; // 대체 비율 (예: "1:1", "2:1")
  notes?: string; // 추가 주의사항
  difficulty: 'easy' | 'medium' | 'hard';
  similarity: number; // 0-100, 원재료와의 유사도
}

export interface IngredientSubstituteResponse {
  originalIngredient: string;
  substitutes: SubstituteOption[];
  contextualAdvice: string;
  cookingTips: string[];
}

@Injectable()
export class IngredientSubstituteService {
  private readonly logger = new Logger(IngredientSubstituteService.name);

  constructor(
    private readonly coreService: LangChainCoreService,
    private readonly promptService: LangChainPromptService
  ) {}

  /**
   * AI 기반 대체 재료 추천
   */
  async getIngredientSubstitutes(request: IngredientSubstituteRequest): Promise<IngredientSubstituteResponse> {
    this.logger.log(`🔍 대체 재료 분석: ${request.ingredient}`);

    try {
      // 1. LangChain 프롬프트 구성
      const prompt = this.promptService.createIngredientSubstitutePrompt(request);

      // 2. LangChain JSON 응답 생성
      const aiResponse = await this.coreService.generateJSON<{
        substitutes: SubstituteOption[];
        contextualAdvice: string;
        cookingTips: string[];
      }>(prompt, null, { temperature: 0.3 });

      // 3. AI 응답 변환
      const parsedResponse: IngredientSubstituteResponse = {
        originalIngredient: request.ingredient,
        substitutes: aiResponse.substitutes || [],
        contextualAdvice: aiResponse.contextualAdvice || '',
        cookingTips: aiResponse.cookingTips || []
      };

      // 4. 폴백 데이터와 결합
      const enhancedResponse = this.enhanceWithFallbackData(parsedResponse, request);

      this.logger.log(`✅ 대체 재료 추천 완료: ${enhancedResponse.substitutes.length}개 옵션`);
      return enhancedResponse;

    } catch (error) {
      this.logger.error('LangChain 대체 재료 추천 실패:', error);
      return this.getFallbackSubstitutes(request);
    }
  }

  /**
   * 레거시: LangChain용 프롬프트 구성 (현재는 promptService 사용)
   */
  private buildSubstitutePrompt(request: IngredientSubstituteRequest): string {
    const { ingredient, context, allergies, dietaryRestrictions, availableIngredients } = request;

    let prompt = `당신은 전문 요리사이자 영양사입니다. 대체 재료 추천을 요청받았습니다.

요청 정보:
- 대체할 재료: ${ingredient}`;

    if (context) {
      prompt += `\n- 요리 맥락: ${context}`;
    }

    if (allergies && allergies.length > 0) {
      prompt += `\n- 알레르기: ${allergies.join(', ')}`;
    }

    if (dietaryRestrictions && dietaryRestrictions.length > 0) {
      prompt += `\n- 식단 제한: ${dietaryRestrictions.join(', ')}`;
    }

    if (availableIngredients && availableIngredients.length > 0) {
      prompt += `\n- 보유 재료: ${availableIngredients.join(', ')}`;
    }

    prompt += `

다음 JSON 형식으로 대체 재료를 추천해주세요:

{
  "substitutes": [
    {
      "name": "대체재료명",
      "reason": "추천 이유 (영양, 맛, 식감 등)",
      "ratio": "대체 비율 (예: 1:1, 2:1)",
      "notes": "주의사항이나 추가 팁",
      "difficulty": "easy|medium|hard",
      "similarity": 85
    }
  ],
  "contextualAdvice": "전체적인 조리 조언",
  "cookingTips": [
    "요리 팁 1",
    "요리 팁 2"
  ]
}

요구사항:
1. 최소 3개, 최대 5개의 대체 재료 추천
2. 알레르기와 식단 제한 고려 필수
3. 구하기 쉬운 재료 우선 추천
4. 맛과 영양을 고려한 설명
5. 실용적인 조리 팁 제공

응답은 반드시 유효한 JSON 형식이어야 합니다.`;

    return prompt;
  }

  /**
   * AI 응답 파싱
   */
  private parseAiResponse(response: string, originalIngredient: string): IngredientSubstituteResponse {
    try {
      // JSON 추출 (마크다운 코드블록 제거)
      let jsonStr = response.trim();
      
      // 마크다운 코드블록 제거
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1]?.split('```')[0] || jsonStr;
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1]?.split('```')[0] || jsonStr;
      }
      
      // JSON 파싱
      const parsed = JSON.parse(jsonStr.trim());

      return {
        originalIngredient,
        substitutes: parsed.substitutes || [],
        contextualAdvice: parsed.contextualAdvice || '',
        cookingTips: parsed.cookingTips || []
      };

    } catch (error) {
      this.logger.warn('AI 응답 파싱 실패, 폴백 사용:', error);
      throw error;
    }
  }

  /**
   * 폴백 데이터와 결합하여 응답 품질 향상
   */
  private enhanceWithFallbackData(
    aiResponse: IngredientSubstituteResponse, 
    request: IngredientSubstituteRequest
  ): IngredientSubstituteResponse {
    const fallbackData = this.getFallbackSubstituteData(request.ingredient);
    
    // AI 응답이 부족한 경우 폴백 데이터로 보강
    if (aiResponse.substitutes.length < 3) {
      const additionalSubstitutes = fallbackData.substitutes
        .filter(fallback => !aiResponse.substitutes.some(ai => ai.name === fallback.name))
        .slice(0, 3 - aiResponse.substitutes.length);
      
      aiResponse.substitutes.push(...additionalSubstitutes);
    }

    // 조리 팁이 부족한 경우 보강
    if (aiResponse.cookingTips.length === 0) {
      aiResponse.cookingTips = fallbackData.cookingTips;
    }

    // 전체 조언이 없는 경우 기본 조언 추가
    if (!aiResponse.contextualAdvice) {
      aiResponse.contextualAdvice = `${request.ingredient} 대신 사용할 수 있는 다양한 대체재를 준비했습니다. 요리의 특성과 개인 취향에 맞게 선택해보세요.`;
    }

    return aiResponse;
  }

  /**
   * 폴백 대체 재료 데이터 (AI 실패 시 사용)
   */
  private getFallbackSubstituteData(ingredient: string): IngredientSubstituteResponse {
    const ingredientLower = ingredient.toLowerCase().replace(/\s+/g, '');
    
    // 육류
    if (ingredientLower.includes('닭가슴살') || ingredientLower.includes('치킨')) {
      return {
        originalIngredient: ingredient,
        substitutes: [
          { name: '돼지 안심', reason: '단백질 함량이 비슷하고 부드러운 식감', ratio: '1:1', difficulty: 'easy', similarity: 85 },
          { name: '두부', reason: '식물성 단백질로 건강한 대안', ratio: '1:1', notes: '물기를 잘 제거하고 사용', difficulty: 'easy', similarity: 60 },
          { name: '콩고기', reason: '비건 친화적이며 단백질 풍부', ratio: '1:1', difficulty: 'medium', similarity: 70 }
        ],
        contextualAdvice: '닭가슴살의 담백함을 살리려면 조리 시간을 조절하는 것이 중요합니다.',
        cookingTips: ['대체재는 원래 조리시간보다 짧게 익혀주세요', '양념을 미리 재워두면 맛이 더 좋습니다']
      };
    }

    // 채소류
    if (ingredientLower.includes('양파')) {
      return {
        originalIngredient: ingredient,
        substitutes: [
          { name: '대파', reason: '단맛과 향이 비슷함', ratio: '1:1', difficulty: 'easy', similarity: 75 },
          { name: '샬롯', reason: '부드러운 양파 맛', ratio: '1:1', difficulty: 'easy', similarity: 90 },
          { name: '마늘', reason: '깊은 풍미 제공', ratio: '1:3', notes: '양을 줄여서 사용', difficulty: 'easy', similarity: 50 }
        ],
        contextualAdvice: '양파의 단맛을 대체하려면 조리 시간을 늘려 대체재의 단맛을 끌어내세요.',
        cookingTips: ['대체재를 천천히 볶아 단맛을 내세요', '설탕을 조금 추가하면 양파의 단맛 대체 가능']
      };
    }

    // 기본 폴백
    return {
      originalIngredient: ingredient,
      substitutes: [
        { name: '유사한 재료', reason: '비슷한 성질의 재료로 대체', ratio: '1:1', difficulty: 'medium', similarity: 70 }
      ],
      contextualAdvice: '정확한 대체재를 찾기 어려우니 요리의 전체적인 밸런스를 고려해보세요.',
      cookingTips: ['조리법을 약간 조정해야 할 수 있습니다', '맛을 보며 간을 조절하세요']
    };
  }

  /**
   * 완전 폴백 응답 (AI 서비스 실패 시)
   */
  private getFallbackSubstitutes(request: IngredientSubstituteRequest): IngredientSubstituteResponse {
    this.logger.warn(`폴백 대체재료 사용: ${request.ingredient}`);
    return this.getFallbackSubstituteData(request.ingredient);
  }

  /**
   * 대체재료 검색 및 필터링
   */
  async searchSubstitutes(
    ingredient: string, 
    filters?: {
      maxDifficulty?: 'easy' | 'medium' | 'hard';
      minSimilarity?: number;
      excludeAllergies?: string[];
    }
  ): Promise<SubstituteOption[]> {
    const response = await this.getIngredientSubstitutes({ ingredient });
    
    let substitutes = response.substitutes;

    // 필터 적용
    if (filters?.maxDifficulty) {
      const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
      const maxLevel = difficultyOrder[filters.maxDifficulty];
      substitutes = substitutes.filter(sub => difficultyOrder[sub.difficulty] <= maxLevel);
    }

    if (filters?.minSimilarity) {
      substitutes = substitutes.filter(sub => sub.similarity >= filters.minSimilarity!);
    }

    if (filters?.excludeAllergies) {
      substitutes = substitutes.filter(sub => 
        !filters.excludeAllergies!.some(allergy => 
          sub.name.toLowerCase().includes(allergy.toLowerCase())
        )
      );
    }

    return substitutes;
  }
}