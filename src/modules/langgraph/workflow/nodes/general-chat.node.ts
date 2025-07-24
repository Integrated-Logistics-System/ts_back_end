import { Injectable } from '@nestjs/common';
import { BaseNode } from './base.node';
import { GraphState } from '../workflow.builder';

/**
 * General Chat Node
 * Handles general conversation and provides basic cooking assistant introduction
 */
@Injectable()
export class GeneralChatNode extends BaseNode {
  constructor() {
    super();
  }

  /**
   * Execute general chat logic
   */
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`💬 General Chat: "${state.query}"`);

    const response = this.generateGeneralChatResponse(
      state.query, 
      state.userStatus
    );

    return { response };
  }

  /**
   * Generate general chat response with personalization
   */
  private generateGeneralChatResponse(query: string, userStatus?: string): string {
    let response = `안녕하세요! 요리 AI 어시스턴트입니다. 🍳\n\n`;
    
    // Add personalized greeting
    if (userStatus) {
      response += `✨ ${userStatus}인 분이시군요!\n\n`;
    }
    
    // Analyze query for specific responses
    response += this.analyzeQueryForSpecificResponse(query);
    
    response += `\n다음과 같은 도움을 드릴 수 있습니다:
🔍 레시피 검색 및 추천
🍳 요리 방법 및 팁 제공
📝 맞춤형 요리 가이드

궁금한 것이 있으시면 언제든 물어보세요!`;

    return response;
  }

  /**
   * Analyze query for specific chat responses
   */
  private analyzeQueryForSpecificResponse(query: string): string {
    const queryLower = query.toLowerCase();

    // Greeting responses
    if (this.isGreeting(queryLower)) {
      return `반가워요! 오늘은 어떤 요리를 해보고 싶으신가요? 😊\n`;
    }

    // Thank you responses
    if (this.isThankYou(queryLower)) {
      return `천만에요! 더 도움이 필요하시면 언제든 말씀해주세요. 🙏\n`;
    }

    // Farewell responses
    if (this.isFarewell(queryLower)) {
      return `안녕히 가세요! 맛있는 요리 하시길 바라며, 또 언제든 찾아와주세요! 👋\n`;
    }

    // Help requests
    if (this.isHelpRequest(queryLower)) {
      return `도움이 필요하시군요! 레시피 검색, 요리 팁, 또는 요리 방법에 대해 궁금한 점이 있으시면 구체적으로 말씀해주세요.\n`;
    }

    // Default friendly response
    return `네, 잘 들었어요! 요리와 관련된 질문이시라면 더 구체적으로 알려주시면 좋겠어요.\n`;
  }

  /**
   * Check if query is a greeting
   */
  private isGreeting(query: string): boolean {
    const greetings = [
      '안녕', '안녕하세요', '안녕하십니까', 'hello', 'hi', 
      '처음 뵙겠습니다', '반갑습니다', '좋은 아침', '좋은 저녁'
    ];
    return greetings.some(greeting => query.includes(greeting));
  }

  /**
   * Check if query is a thank you
   */
  private isThankYou(query: string): boolean {
    const thankYous = [
      '고마워', '감사', '고맙습니다', '감사합니다', 
      'thank', '땡큐', '땡스', '고마워요'
    ];
    return thankYous.some(thanks => query.includes(thanks));
  }

  /**
   * Check if query is a farewell
   */
  private isFarewell(query: string): boolean {
    const farewells = [
      '안녕히', '잘 가', '가요', '끝', '그만', 
      'bye', 'goodbye', '나중에', '또 봐'
    ];
    return farewells.some(farewell => query.includes(farewell));
  }

  /**
   * Check if query is a help request
   */
  private isHelpRequest(query: string): boolean {
    const helpRequests = [
      '도움', '도와', '모르겠', '어떻게', '뭐가', 
      'help', '설명', '알려', '가르쳐'
    ];
    return helpRequests.some(help => query.includes(help));
  }

  /**
   * Error response for general chat failures
   */
  protected getErrorResponse(error: any, state: GraphState): string {
    return '안녕하세요! 요리와 레시피에 관해 궁금한 것이 있으시면 언제든 물어보세요.';
  }
}