/**
 * 🦜 LangChain 프롬프트 서비스
 * 프롬프트 템플릿 관리 및 동적 프롬프트 생성
 */

import { Injectable, Logger } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { LangChainCoreService } from './langchain-core.service';

export interface PromptContext {
  [key: string]: any;
}

export interface SystemPromptOptions {
  role?: string;
  personality?: string;
  constraints?: string[];
  outputFormat?: 'text' | 'json' | 'markdown';
}

@Injectable()
export class LangChainPromptService {
  private readonly logger = new Logger(LangChainPromptService.name);
  private promptCache = new Map<string, PromptTemplate>();

  constructor(private readonly coreService: LangChainCoreService) {}

  /**
   * 기본 시스템 프롬프트 생성
   */
  createSystemPrompt(options: SystemPromptOptions = {}): string {
    const {
      role = '전문 요리 어시스턴트',
      personality = '친근하고 도움이 되는',
      constraints = [],
      outputFormat = 'text'
    } = options;

    let systemPrompt = `당신은 ${personality} ${role}입니다.\n\n`;

    // 제약사항 추가
    if (constraints.length > 0) {
      systemPrompt += '다음 제약사항을 반드시 따라주세요:\n';
      constraints.forEach((constraint, index) => {
        systemPrompt += `${index + 1}. ${constraint}\n`;
      });
      systemPrompt += '\n';
    }

    // 출력 형식 지정
    switch (outputFormat) {
      case 'json':
        systemPrompt += '응답은 반드시 유효한 JSON 형식이어야 합니다. 마크다운이나 추가 설명 없이 JSON만 반환하세요.\n';
        break;
      case 'markdown':
        systemPrompt += '응답은 마크다운 형식으로 작성해주세요.\n';
        break;
      default:
        systemPrompt += '자연스럽고 친근한 말투로 답변해주세요.\n';
    }

    return systemPrompt;
  }

  /**
   * 프롬프트 템플릿 생성 및 캐싱
   */
  async createTemplate(
    templateName: string,
    template: string,
    inputVariables: string[]
  ): Promise<PromptTemplate> {
    try {
      const promptTemplate = new PromptTemplate({
        template,
        inputVariables,
      });

      // 캐싱
      this.promptCache.set(templateName, promptTemplate);
      this.logger.debug(`프롬프트 템플릿 생성됨: ${templateName}`);

      return promptTemplate;
    } catch (error) {
      this.logger.error(`프롬프트 템플릿 생성 실패: ${templateName}`, error);
      throw new Error(`Failed to create prompt template: ${templateName}`);
    }
  }

  /**
   * 캐시된 템플릿 사용
   */
  async useTemplate(templateName: string, context: PromptContext): Promise<string> {
    const template = this.promptCache.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    try {
      const formattedPrompt = await template.format(context);
      return formattedPrompt;
    } catch (error) {
      this.logger.error(`템플릿 사용 실패: ${templateName}`, error);
      throw new Error(`Failed to use template: ${templateName}`);
    }
  }

  /**
   * 재료 대체 프롬프트 생성
   */
  createIngredientSubstitutePrompt(context: {
    ingredient: string;
    cookingContext?: string;
    allergies?: string[];
    dietaryRestrictions?: string[];
    availableIngredients?: string[];
  }): string {
    const systemPrompt = this.createSystemPrompt({
      role: '전문 요리사이자 영양사',
      outputFormat: 'json',
      constraints: [
        '실용적이고 구하기 쉬운 재료 추천',
        '알레르기 정보 반드시 고려',
        '영양가와 맛의 균형 중시',
        '조리법 변경 최소화'
      ]
    });

    let prompt = `${systemPrompt}

요청 정보:
- 대체할 재료: ${context.ingredient}`;

    if (context.cookingContext) {
      prompt += `\n- 요리 맥락: ${context.cookingContext}`;
    }

    if (context.allergies && context.allergies.length > 0) {
      prompt += `\n- 알레르기: ${context.allergies.join(', ')}`;
    }

    if (context.dietaryRestrictions && context.dietaryRestrictions.length > 0) {
      prompt += `\n- 식단 제한: ${context.dietaryRestrictions.join(', ')}`;
    }

    if (context.availableIngredients && context.availableIngredients.length > 0) {
      prompt += `\n- 보유 재료: ${context.availableIngredients.join(', ')}`;
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
- 최소 3개, 최대 5개의 대체 재료 추천
- 알레르기와 식단 제한 고려 필수
- 구하기 쉬운 재료 우선 추천
- 맛과 영양을 고려한 설명
- 실용적인 조리 팁 제공`;

    return prompt;
  }

  /**
   * 의도 분류 프롬프트 생성
   */
  createIntentClassificationPrompt(context: {
    message: string;
    conversationHistory?: string;
    availableIntents?: string[];
  }): string {
    const intents = context.availableIntents || [
      'recipe_list',
      'recipe_detail',
      'alternative_recipe',
      'ingredient_substitute',
      'general_chat'
    ];

    const systemPrompt = this.createSystemPrompt({
      role: '대화 의도 분석 전문가',
      outputFormat: 'json',
      constraints: [
        '사용자 메시지의 의도를 정확히 분류',
        '대화 맥락 고려',
        '높은 신뢰도 유지'
      ]
    });

    let prompt = `${systemPrompt}

사용자 메시지: "${context.message}"`;

    if (context.conversationHistory) {
      prompt += `\n\n대화 맥락:\n${context.conversationHistory}`;
    }

    prompt += `

다음 의도 중에서 분류해주세요:
${intents.map(intent => `- ${intent}`).join('\n')}

JSON 형식으로 응답:
{
  "intent": "분류된_의도",
  "confidence": 0.95,
  "reasoning": "분류 근거",
  "targetIngredient": "재료명 (ingredient_substitute인 경우)",
  "relatedRecipe": "관련 레시피명 (있는 경우)",
  "needsAlternative": false
}`;

    return prompt;
  }

  /**
   * 일반 대화 프롬프트 생성
   */
  createGeneralChatPrompt(context: {
    message: string;
    conversationHistory?: string;
    suggestedTopics?: string[];
  }): string {
    const systemPrompt = this.createSystemPrompt({
      role: '요리 전문 어시스턴트',
      personality: '친근하고 도움이 되는',
      constraints: [
        '요리와 관련된 주제를 우선으로 대화',
        '유용한 정보 제공',
        '자연스러운 대화 유지'
      ]
    });

    let prompt = `${systemPrompt}

사용자 메시지: "${context.message}"`;

    if (context.conversationHistory) {
      prompt += `\n\n이전 대화:\n${context.conversationHistory}`;
    }

    if (context.suggestedTopics && context.suggestedTopics.length > 0) {
      prompt += `\n\n추천 대화 주제: ${context.suggestedTopics.join(', ')}`;
    }

    prompt += `\n\n친근하고 자연스럽게 응답해주세요. 필요하다면 요리 관련 주제로 자연스럽게 유도해주세요.`;

    return prompt;
  }

  /**
   * 프롬프트 캐시 관리
   */
  clearCache(): void {
    this.promptCache.clear();
    this.logger.log('프롬프트 캐시 정리됨');
  }

  getCacheSize(): number {
    return this.promptCache.size;
  }

  getCachedTemplates(): string[] {
    return Array.from(this.promptCache.keys());
  }
}