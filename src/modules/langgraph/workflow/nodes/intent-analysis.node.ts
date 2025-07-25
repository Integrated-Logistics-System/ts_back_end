import { Injectable } from '@nestjs/common';
import { BaseNode } from './base.node';
import { GraphState } from '../workflow.builder';
// import { UserStatusService } from '../../../user/user-status.service'; // Removed

/**
 * Intent Analysis Node
 * Analyzes user query to determine intent and loads user context
 */
@Injectable()
export class IntentAnalysisNode extends BaseNode {
  constructor() {
    super();
  }

  /**
   * Execute intent analysis logic
   */
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`🧠 Intent Analysis: "${state.query}"`);

    // Load user status for personalization (service removed)
    const userStatus = state.userId ? `User ${state.userId}` : 'Anonymous user';
    this.logger.log(`👤 User Status: ${userStatus}`);

    // Analyze intent using keyword matching
    const { intent, confidence } = this.analyzeIntent(state.query);
    
    this.logger.log(`🎯 Intent detected: ${intent} (confidence: ${confidence})`);

    return {
      intent,
      confidence,
      userStatus,
    };
  }

  /**
   * Simple keyword-based intent analysis
   */
  private analyzeIntent(query: string): { 
    intent: GraphState['intent']; 
    confidence: number 
  } {
    const queryLower = query.toLowerCase();

    // Recipe search keywords
    const recipeKeywords = [
      '레시피', '요리법', '만드는법', '조리법', '추천',
      '음식', '요리', '만들어', '어떻게', '방법'
    ];

    // Cooking help keywords  
    const cookingKeywords = [
      '요리하는', '조리하는', '팁', '비법', '노하우',
      '시간', '온도', '불조절', '썰기', '볶기'
    ];

    // Calculate keyword matching scores
    const recipeScore = recipeKeywords.filter(keyword => 
      queryLower.includes(keyword)
    ).length;
    
    const cookingScore = cookingKeywords.filter(keyword => 
      queryLower.includes(keyword)
    ).length;

    // Determine intent based on scores
    if (recipeScore > 0) {
      return { 
        intent: 'recipe_search', 
        confidence: Math.min(recipeScore * 0.3, 1.0) 
      };
    }
    
    if (cookingScore > 0) {
      return { 
        intent: 'cooking_help', 
        confidence: Math.min(cookingScore * 0.3, 1.0) 
      };
    }

    return { intent: 'general_chat', confidence: 0.2 };
  }

  /**
   * Error response for intent analysis failures
   */
  protected getErrorResponse(error: any, state: GraphState): string {
    return '의도 분석 중 오류가 발생했습니다. 일반 대화 모드로 전환합니다.';
  }
}