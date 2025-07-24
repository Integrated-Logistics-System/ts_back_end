import { Injectable } from '@nestjs/common';
import { BaseNode } from './base.node';
import { GraphState } from '../workflow.builder';

/**
 * Cooking Help Node
 * Provides cooking tips, techniques, and guidance
 */
@Injectable()
export class CookingHelpNode extends BaseNode {
  constructor() {
    super();
  }

  /**
   * Execute cooking help logic
   */
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`🍳 Cooking Help: "${state.query}"`);

    const response = this.generateCookingHelpResponse(
      state.query, 
      state.userStatus
    );

    return { response };
  }

  /**
   * Generate cooking help response based on query and user context
   */
  private generateCookingHelpResponse(query: string, userStatus?: string): string {
    let response = `요리 관련 도움을 드리겠습니다! 📚\n\n`;
    
    if (userStatus) {
      response += `🎯 개인화 정보: ${userStatus}\n`;
      response += `이를 고려한 맞춤형 팁을 제공해드리겠습니다.\n\n`;
    }
    
    // Add specific cooking help based on query keywords
    response += this.generateSpecificCookingTips(query, userStatus);
    
    response += `\n\n"${query}"에 대한 구체적인 도움이 필요하시면:
- 단계별로 자세한 설명을 원하시는지
- 특별한 주의사항이나 팁이 필요한지
- 재료 손질법이나 조리 기법에 대해 궁금한지
더 구체적으로 말씀해주세요!`;

    return response;
  }

  /**
   * Generate specific cooking tips based on query analysis
   */
  private generateSpecificCookingTips(query: string, userStatus?: string): string {
    const queryLower = query.toLowerCase();
    let tips = '';

    // Cooking technique tips
    if (queryLower.includes('볶기') || queryLower.includes('볶는')) {
      tips += `🔥 볶기 팁:
- 센 불에서 빠르게 볶아주세요
- 재료를 한 번에 너무 많이 넣지 마세요
- 기름이 충분히 달궈진 후 재료를 넣어주세요\n\n`;
    }

    if (queryLower.includes('조림') || queryLower.includes('끓이기')) {
      tips += `🍲 조림 팁:
- 처음엔 센 불로 끓인 후 약불로 줄여주세요
- 뚜껑을 덮어 수분 증발을 막아주세요
- 중간중간 저어서 눌어붙지 않게 해주세요\n\n`;
    }

    if (queryLower.includes('썰기') || queryLower.includes('자르기')) {
      tips += `🔪 썰기 팁:
- 칼을 잘 갈아서 사용하세요
- 재료를 안정적으로 잡고 천천히 썰어주세요
- 같은 크기로 썰면 익는 시간이 균일해집니다\n\n`;
    }

    // Time-saving tips for busy users
    if (userStatus && (userStatus.includes('빠른') || userStatus.includes('30분'))) {
      tips += `⏰ 시간 절약 팁:
- 미리 재료를 다듬어 보관해두세요
- 한 번에 여러 요리를 만들어 냉동 보관하세요
- 압력솥이나 에어프라이어 활용을 추천합니다\n\n`;
    }

    // Beginner-friendly tips
    if (userStatus && userStatus.includes('초보')) {
      tips += `👶 초보자를 위한 팁:
- 레시피를 정확히 따라해보세요
- 타이머를 활용해 시간을 체크하세요
- 실패해도 괜찮으니 계속 도전해보세요\n\n`;
    }

    return tips || `💡 "${query}"와 관련된 구체적인 팁을 제공해드리겠습니다.`;
  }

  /**
   * Error response for cooking help failures
   */
  protected getErrorResponse(error: any, state: GraphState): string {
    return '죄송합니다. 요리 도움말을 제공하는 중 오류가 발생했습니다.';
  }
}