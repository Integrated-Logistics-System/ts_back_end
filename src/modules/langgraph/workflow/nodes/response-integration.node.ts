import { Injectable } from '@nestjs/common';
import { BaseNode } from './base.node';
import { GraphState } from '../workflow.builder';

/**
 * Response Integration Node
 * Final processing step that integrates responses with personalization
 */
@Injectable()
export class ResponseIntegrationNode extends BaseNode {
  constructor() {
    super();
  }

  /**
   * Execute response integration logic
   */
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log('📝 Response Integration');

    // Post-process and personalize response
    let finalResponse = state.response || '';
    
    // Add personalized tips based on user status and intent
    if (state.userStatus && state.intent === 'recipe_search') {
      finalResponse += this.addPersonalizedTips(state.userStatus);
    }

    // Add context-aware suggestions
    finalResponse += this.addContextualSuggestions(state);

    // Calculate total processing time
    const totalTime = Date.now() - new Date(state.metadata.timestamp).getTime();

    return {
      response: finalResponse,
      metadata: {
        ...state.metadata,
        processingTime: totalTime,
      },
    };
  }

  /**
   * Add personalized tips based on user status
   */
  private addPersonalizedTips(userStatus: string): string {
    const tips: string[] = [];

    // Beginner tips
    if (userStatus.includes('초보')) {
      tips.push('💡 초보자 팁: 처음엔 간단한 레시피부터 시작하시는 것을 추천드려요!');
    }
    
    // Time-saving tips
    if (userStatus.includes('빠른') || userStatus.includes('30분')) {
      tips.push('⏰ 시간 절약 팁: 미리 재료를 준비해두면 더 빠르게 요리할 수 있어요!');
    }
    
    // Spice level tips
    if (userStatus.includes('매운맛 못') || userStatus.includes('매운 음식 못')) {
      tips.push('🌶️ 매운맛 조절 팁: 고춧가루 대신 파프리카 가루를 사용해보세요!');
    }

    // Health-conscious tips
    if (userStatus.includes('건강한') || userStatus.includes('다이어트')) {
      tips.push('🥗 건강 팁: 기름 사용량을 줄이고 찜이나 구이 요리를 추천해요!');
    }

    // Allergy considerations
    if (userStatus.includes('알레르기')) {
      tips.push('⚠️ 알레르기 주의: 재료 확인을 꼼꼼히 해주시고, 대체 재료 사용을 고려해보세요!');
    }

    if (tips.length === 0) {
      tips.push('✨ 개인 맞춤 팁이 더 필요하시면 언제든 말씀해주세요!');
    }

    return '\n\n' + tips.join('\n\n');
  }

  /**
   * Add contextual suggestions based on current state
   */
  private addContextualSuggestions(state: GraphState): string {
    const suggestions: string[] = [];

    // Intent-based suggestions
    switch (state.intent) {
      case 'recipe_search':
        suggestions.push('💭 관련 제안: "요리 시간", "난이도", "재료 대체" 등에 대해 더 물어보세요!');
        break;
      case 'cooking_help':
        suggestions.push('💭 관련 제안: "조리법 상세", "요리 팁", "시간 단축법" 등에 대해 더 물어보세요!');
        break;
      case 'general_chat':
        suggestions.push('💭 관련 제안: "오늘의 추천 레시피", "간단한 요리", "계절 요리" 등을 검색해보세요!');
        break;
    }

    // Time-based suggestions
    const currentHour = new Date().getHours();
    if (currentHour >= 11 && currentHour <= 13) {
      suggestions.push('🍽️ 점심시간이네요! "점심 레시피" 또는 "간단한 도시락"을 검색해보세요!');
    } else if (currentHour >= 17 && currentHour <= 19) {
      suggestions.push('🌆 저녁시간이네요! "저녁 레시피" 또는 "가족 요리"를 검색해보세요!');
    }

    if (suggestions.length === 0) {
      return '';
    }

    return '\n\n' + suggestions.join('\n\n');
  }

  /**
   * Add emoji and formatting enhancements
   */
  private enhanceResponseFormatting(response: string, intent: GraphState['intent']): string {
    // Add appropriate emoji header based on intent
    const emojiHeaders = {
      recipe_search: '🔍 레시피 검색 결과',
      cooking_help: '🍳 요리 도움말',
      general_chat: '💬 요리 어시스턴트',
      unknown: '🤖 AI 어시스턴트'
    };

    const header = emojiHeaders[intent] || emojiHeaders.unknown;
    
    // Format response with clear sections
    return `${header}\n\n${response}`;
  }

  /**
   * Validate response quality
   */
  private validateResponse(response: string): boolean {
    // Check minimum response length
    if (!response || response.trim().length < 10) {
      return false;
    }

    // Check for placeholder text that might indicate errors
    const errorIndicators = [
      'undefined',
      'null',
      '[object Object]',
      'Error:',
      'undefined에 대한'
    ];

    return !errorIndicators.some(indicator => 
      response.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Error response for response integration failures
   */
  protected getErrorResponse(error: any, state: GraphState): string {
    // Return the original response if available, otherwise a fallback
    return state.response || '처리 중 오류가 발생했습니다. 다시 시도해주세요.';
  }
}