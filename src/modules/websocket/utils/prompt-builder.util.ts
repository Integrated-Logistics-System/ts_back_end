import { Injectable } from '@nestjs/common';
import {
  PersonalizedContext,
  PromptTemplate,
  TimeContext,
  ChatMessage,
} from '../interfaces/chat.interface';

@Injectable()
export class PromptBuilder {
  /**
   * 채팅 프롬프트 구성
   */
  buildChatPrompt(
    message: string,
    context: PersonalizedContext,
    timeContext: TimeContext
  ): string {
    const template = this.createPromptTemplate(context, timeContext);
    
    return this.assemblePrompt(template, message);
  }

  /**
   * 레시피 검색 프롬프트 구성
   */
  buildRecipeSearchPrompt(
    query: string,
    context: PersonalizedContext,
    timeContext: TimeContext
  ): string {
    const template = this.createRecipeSearchTemplate(context, timeContext);
    
    return this.assembleRecipePrompt(template, query);
  }

  /**
   * 상세 요청 프롬프트 구성
   */
  buildDetailRequestPrompt(
    targetRecipe: string,
    context: PersonalizedContext
  ): string {
    const userInfo = this.buildUserInfo(context);
    const instructions = this.buildDetailInstructions(context);
    
    return `${userInfo}

사용자가 "${targetRecipe}"의 상세한 만드는 방법을 요청했습니다.

${instructions}

다음 형식으로 응답해주세요:
1. 재료 목록 (분량 포함)
2. 단계별 조리 과정
3. 조리 팁
4. 주의사항 (알레르기 정보 포함)`;
  }

  /**
   * 개인화된 추천 프롬프트 구성
   */
  buildPersonalizedRecommendationPrompt(
    context: PersonalizedContext,
    timeContext: TimeContext
  ): string {
    const userInfo = this.buildUserInfo(context);
    const timeInfo = this.buildTimeInfo(timeContext);
    const preferences = this.buildPreferencesInfo(context);
    
    return `${userInfo}

${timeInfo}

${preferences}

사용자에게 적합한 레시피를 추천해주세요. 다음을 고려해주세요:
- 현재 시간대와 식사 시간
- 사용자의 요리 수준
- 알레르기 정보
- 개인 선호사항
- 계절적 특성

3-5개의 레시피를 추천하고, 각각에 대해 간단한 설명을 포함해주세요.`;
  }

  // ==================== Private Helper Methods ====================

  private createPromptTemplate(
    context: PersonalizedContext,
    timeContext: TimeContext
  ): PromptTemplate {
    return {
      systemPrompt: this.buildSystemPrompt(),
      userInfo: this.buildUserInfo(context),
      chatHistory: this.buildChatHistory(context),
      instructions: this.buildGeneralInstructions(context),
      context: this.buildTimeInfo(timeContext),
    };
  }

  private createRecipeSearchTemplate(
    context: PersonalizedContext,
    timeContext: TimeContext
  ): PromptTemplate {
    return {
      systemPrompt: this.buildRecipeSystemPrompt(),
      userInfo: this.buildUserInfo(context),
      chatHistory: this.buildRecentRecipeHistory(context),
      instructions: this.buildRecipeInstructions(context),
      context: this.buildTimeInfo(timeContext),
    };
  }

  private buildSystemPrompt(): string {
    return `당신은 전문적인 AI 요리 도우미입니다. 
사용자의 요리 경험, 선호도, 알레르기 정보를 고려하여 맞춤형 요리 조언을 제공합니다.
친근하고 도움이 되는 톤으로 대화하며, 실용적인 조리 팁을 제공합니다.`;
  }

  private buildRecipeSystemPrompt(): string {
    return `당신은 전문적인 레시피 추천 AI입니다.
사용자의 요청에 따라 적절한 레시피를 찾고, 상세한 조리법을 제공합니다.
영양 정보, 조리 시간, 난이도 등을 고려하여 최적의 레시피를 추천합니다.`;
  }

  private buildUserInfo(context: PersonalizedContext): string {
    const parts = [
      `사용자 이름: ${context.userName}`,
      `요리 수준: ${this.translateCookingLevel(context.cookingLevel)}`,
    ];

    if (context.allergies.length > 0) {
      parts.push(`알레르기: ${context.allergies.join(', ')}`);
    }

    if (context.preferences.length > 0) {
      parts.push(`선호사항: ${context.preferences.join(', ')}`);
    }

    return `**사용자 정보:**\n${parts.join('\n')}`;
  }

  private buildChatHistory(context: PersonalizedContext): string {
    if (!context.conversationHistory?.length) {
      return '**대화 기록:** 새로운 대화';
    }

    const recentMessages = context.conversationHistory.slice(-5);
    const historyLines = recentMessages.map(msg => 
      `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
    );

    return `**최근 대화:**\n${historyLines.join('\n')}`;
  }

  private buildRecentRecipeHistory(context: PersonalizedContext): string {
    if (!context.conversationHistory?.length) {
      return '';
    }

    const recipeMessages = context.conversationHistory
      .filter(msg => msg.metadata?.messageType === 'recipe_request' || msg.metadata?.recipeId)
      .slice(-3);

    if (recipeMessages.length === 0) {
      return '';
    }

    const historyLines = recipeMessages.map(msg =>
      `- ${msg.metadata?.recipeName || '레시피'}: ${msg.content.substring(0, 80)}...`
    );

    return `**최근 레시피 관련 대화:**\n${historyLines.join('\n')}`;
  }

  private buildGeneralInstructions(context: PersonalizedContext): string {
    const instructions = [
      '친근하고 도움이 되는 톤으로 대화하세요.',
      '실용적이고 따라하기 쉬운 조언을 제공하세요.',
    ];

    if (context.cookingLevel === 'beginner') {
      instructions.push('초보자도 이해하기 쉽게 설명하세요.');
      instructions.push('기본적인 조리 용어와 기법을 설명해주세요.');
    } else if (context.cookingLevel === 'advanced') {
      instructions.push('고급 기법이나 전문적인 팁을 포함할 수 있습니다.');
    }

    if (context.allergies.length > 0) {
      instructions.push(`알레르기 정보(${context.allergies.join(', ')})를 반드시 고려하세요.`);
    }

    return `**지침:**\n${instructions.map(inst => `- ${inst}`).join('\n')}`;
  }

  private buildRecipeInstructions(context: PersonalizedContext): string {
    const instructions = [
      '레시피는 명확하고 단계별로 제공하세요.',
      '재료 분량을 정확히 명시하세요.',
      '조리 시간과 난이도를 표시하세요.',
    ];

    if (context.cookingLevel === 'beginner') {
      instructions.push('기본적인 조리 기법을 상세히 설명하세요.');
      instructions.push('실패하기 쉬운 부분에 대한 주의사항을 포함하세요.');
    }

    if (context.allergies.length > 0) {
      instructions.push(`알레르기 재료(${context.allergies.join(', ')})를 피하고 대체재를 제안하세요.`);
    }

    return `**레시피 지침:**\n${instructions.map(inst => `- ${inst}`).join('\n')}`;
  }

  private buildDetailInstructions(context: PersonalizedContext): string {
    const instructions = [
      '상세하고 따라하기 쉬운 조리법을 제공하세요.',
      '각 단계마다 소요 시간을 명시하세요.',
      '조리 중 주의할 점을 포함하세요.',
    ];

    if (context.cookingLevel === 'beginner') {
      instructions.push('초보자를 위한 상세한 설명과 팁을 포함하세요.');
    }

    if (context.allergies.length > 0) {
      instructions.push(`알레르기 재료(${context.allergies.join(', ')})에 대한 주의사항을 반드시 포함하세요.`);
    }

    return instructions.map(inst => `- ${inst}`).join('\n');
  }

  private buildTimeInfo(timeContext: TimeContext): string {
    const timeInfo = [
      `현재 시간대: ${this.translateTimeOfDay(timeContext.timeOfDay)}`,
      `요일: ${timeContext.isWeekend ? '주말' : '평일'}`,
      `계절: ${this.translateSeason(timeContext.season)}`,
    ];

    if (timeContext.mealTime) {
      timeInfo.push(`식사 시간: ${this.translateMealTime(timeContext.mealTime)}`);
    }

    return `**시간 정보:**\n${timeInfo.join('\n')}`;
  }

  private buildPreferencesInfo(context: PersonalizedContext): string {
    const info = [];

    if (context.preferences.length > 0) {
      info.push(`선호 음식: ${context.preferences.join(', ')}`);
    }

    if (context.allergies.length > 0) {
      info.push(`알레르기: ${context.allergies.join(', ')} (반드시 피해야 함)`);
    }

    return info.length > 0 ? `**선호도 정보:**\n${info.join('\n')}` : '';
  }

  private assemblePrompt(template: PromptTemplate, message: string): string {
    const parts = [
      template.systemPrompt,
      template.userInfo,
      template.context,
      template.chatHistory,
      template.instructions,
      `\n**사용자 메시지:** ${message}`,
    ].filter(part => part.trim().length > 0);

    return parts.join('\n\n');
  }

  private assembleRecipePrompt(template: PromptTemplate, query: string): string {
    const parts = [
      template.systemPrompt,
      template.userInfo,
      template.context,
      template.chatHistory,
      template.instructions,
      `\n**레시피 요청:** ${query}`,
    ].filter(part => part.trim().length > 0);

    return parts.join('\n\n');
  }

  private translateCookingLevel(level: string): string {
    const translations = {
      beginner: '초급',
      intermediate: '중급',
      advanced: '고급',
    };
    return translations[level as keyof typeof translations] || level;
  }

  private translateTimeOfDay(timeOfDay: string): string {
    const translations = {
      morning: '아침',
      afternoon: '오후',
      evening: '저녁',
      night: '밤',
    };
    return translations[timeOfDay as keyof typeof translations] || timeOfDay;
  }

  private translateMealTime(mealTime: string): string {
    const translations = {
      breakfast: '아침식사',
      lunch: '점심식사',
      dinner: '저녁식사',
      snack: '간식',
    };
    return translations[mealTime as keyof typeof translations] || mealTime;
  }

  private translateSeason(season: string): string {
    const translations = {
      spring: '봄',
      summer: '여름',
      fall: '가을',
      winter: '겨울',
    };
    return translations[season as keyof typeof translations] || season;
  }
}