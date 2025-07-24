import { Injectable, Logger } from '@nestjs/common';
import { StateGraph } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { UserStatusService } from '../../../modules/user/user-status.service';

/**
 * 간단하고 안전한 LangGraph 워크플로우
 * 기존 4,000+ 라인의 복잡한 시스템을 3단계 조건부 분기로 단순화
 */

export interface GraphState {
  // 기본 입력
  query: string;
  userId?: string;
  userStatus?: string; // "나의 상태" 개인화 컨텍스트
  
  // 의도 분석 결과
  intent: 'recipe_search' | 'cooking_help' | 'general_chat' | 'unknown';
  confidence: number;
  
  // 처리 결과
  response: string;
  metadata: {
    processingTime: number;
    intentAnalysisTime: number;
    responseGenerationTime: number;
    timestamp: string;
    [key: string]: any; // Allow additional metadata fields
  };
}

@Injectable()
export class WorkflowBuilder {
  private readonly logger = new Logger(WorkflowBuilder.name);

  constructor(
    private readonly userStatusService: UserStatusService,
  ) {}

  /**
   * 간단한 3단계 워크플로우 생성
   * [Intent Analysis] → [Conditional Processing] → [Response Integration]
   */
  buildWorkflow(): any {
    this.logger.log('🔧 Building LangGraph workflow...');

    const graph = new StateGraph<GraphState>({
      channels: this.buildChannels(),
    });

    // 3개의 핵심 노드만 추가
    this.addNodes(graph);
    this.addEdges(graph);

    const workflow = graph.compile();
    this.logger.log('✅ LangGraph workflow built successfully');
    
    return workflow;
  }

  /**
   * 간소화된 상태 채널
   */
  private buildChannels() {
    return {
      query: {
        value: (x: string, y: string) => y ?? x,
        default: () => '',
      },
      userId: {
        value: (x: string | undefined, y: string | undefined) => y ?? x,
        default: () => undefined,
      },
      userStatus: {
        value: (x: string | undefined, y: string | undefined) => y ?? x,
        default: () => undefined,
      },
      intent: {
        value: (x: GraphState['intent'], y: GraphState['intent']) => y ?? x,
        default: () => 'unknown' as const,
      },
      confidence: {
        value: (x: number, y: number) => y ?? x,
        default: () => 0,
      },
      response: {
        value: (x: string, y: string) => y ?? x,
        default: () => '',
      },
      metadata: {
        value: (x: GraphState['metadata'], y: GraphState['metadata']) => ({ ...x, ...y }),
        default: () => ({
          processingTime: 0,
          intentAnalysisTime: 0,
          responseGenerationTime: 0,
          timestamp: new Date().toISOString(),
        }),
      },
    };
  }

  /**
   * 3개 핵심 노드 추가
   */
  private addNodes(graph: any) {
    this.logger.log('🔗 Adding simple workflow nodes...');

    graph.addNode('intent_analysis', this.intentAnalysisNode.bind(this));
    graph.addNode('recipe_search', this.recipeSearchNode.bind(this));
    graph.addNode('cooking_help', this.cookingHelpNode.bind(this));
    graph.addNode('general_chat', this.generalChatNode.bind(this));
    graph.addNode('response_integration', this.responseIntegrationNode.bind(this));

    this.logger.log('✅ Simple nodes added successfully');
  }

  /**
   * 조건부 분기 엣지 추가
   */
  private addEdges(graph: any) {
    this.logger.log('🔗 Adding simple workflow edges...');

    // 시작 → 의도 분석
    graph.addEdge("__start__", 'intent_analysis');

    // 의도 분석 → 조건부 분기
    graph.addConditionalEdges('intent_analysis', (state: GraphState) => {
      switch (state.intent) {
        case 'recipe_search':
          return 'recipe_search';
        case 'cooking_help':
          return 'cooking_help';
        case 'general_chat':
          return 'general_chat';
        default:
          return 'general_chat'; // 기본값
      }
    }, {
      'recipe_search': 'recipe_search',
      'cooking_help': 'cooking_help',
      'general_chat': 'general_chat',
    });

    // 모든 처리 노드 → 응답 통합
    graph.addEdge('recipe_search', 'response_integration');
    graph.addEdge('cooking_help', 'response_integration');
    graph.addEdge('general_chat', 'response_integration');
    
    // 응답 통합 → 종료
    graph.addEdge('response_integration', "__end__");

    this.logger.log('✅ Simple edges added successfully');
  }

  /**
   * 1단계: 의도 분석 노드
   * 사용자 쿼리를 분석하여 3가지 의도로 분류
   */
  private async intentAnalysisNode(state: GraphState): Promise<Partial<GraphState>> {
    const startTime = Date.now();
    this.logger.log(`🧠 Intent Analysis: "${state.query}"`);

    try {
      // 사용자 상태 로드 (개인화)
      let userStatus = '';
      if (state.userId) {
        try {
          userStatus = await this.userStatusService.getContextForLangGraph(state.userId);
          this.logger.log(`👤 User Status loaded for ${state.userId}: "${userStatus}"`);
        } catch (error) {
          this.logger.error(`❌ Failed to load user status for ${state.userId}:`, error);
        }
      } else {
        this.logger.log(`👤 No userId provided - using anonymous mode`);
      }

      // 간단한 키워드 기반 의도 분석
      const { intent, confidence } = this.analyzeIntent(state.query);

      const analysisTime = Date.now() - startTime;
      
      return {
        intent,
        confidence,
        userStatus,
        metadata: {
          ...state.metadata,
          intentAnalysisTime: analysisTime,
        },
      };
    } catch (error) {
      this.logger.error('Intent analysis failed:', error);
      return {
        intent: 'general_chat',
        confidence: 0.1,
        metadata: {
          ...state.metadata,
          intentAnalysisTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * 2-A단계: 레시피 검색 노드
   */
  private async recipeSearchNode(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`🔍 Recipe Search: "${state.query}"`);

    try {
      // 개인화된 검색 쿼리 생성
      let enhancedQuery = state.query;
      if (state.userStatus) {
        enhancedQuery = `${state.userStatus} ${state.query}`;
      }

      // 실제 레시피 검색 로직은 여기에 구현
      // 현재는 간단한 응답 생성
      const response = this.generateRecipeSearchResponse(enhancedQuery, state.userStatus);

      return { response };
    } catch (error) {
      this.logger.error('Recipe search failed:', error);
      return { 
        response: '죄송합니다. 레시피 검색 중 오류가 발생했습니다. 다시 시도해주세요.' 
      };
    }
  }

  /**
   * 2-B단계: 요리 도움 노드
   */
  private async cookingHelpNode(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`🍳 Cooking Help: "${state.query}"`);

    try {
      const response = this.generateCookingHelpResponse(state.query, state.userStatus);
      return { response };
    } catch (error) {
      this.logger.error('Cooking help failed:', error);
      return { 
        response: '죄송합니다. 요리 도움말을 제공하는 중 오류가 발생했습니다.' 
      };
    }
  }

  /**
   * 2-C단계: 일반 대화 노드
   */
  private async generalChatNode(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`💬 General Chat: "${state.query}"`);

    try {
      const response = this.generateGeneralChatResponse(state.query, state.userStatus);
      return { response };
    } catch (error) {
      this.logger.error('General chat failed:', error);
      return { 
        response: '안녕하세요! 요리와 레시피에 관해 궁금한 것이 있으시면 언제든 물어보세요.' 
      };
    }
  }

  /**
   * 3단계: 응답 통합 노드
   */
  private async responseIntegrationNode(state: GraphState): Promise<Partial<GraphState>> {
    const startTime = Date.now();
    this.logger.log('📝 Response Integration');

    try {
      // 응답 후처리 및 개인화
      let finalResponse = state.response;
      
      // 사용자 상태 기반 추가 정보 제공
      if (state.userStatus && state.intent === 'recipe_search') {
        finalResponse += this.addPersonalizedTips(state.userStatus);
      }

      const responseTime = Date.now() - startTime;
      const totalTime = Date.now() - new Date(state.metadata.timestamp).getTime();

      return {
        response: finalResponse,
        metadata: {
          ...state.metadata,
          responseGenerationTime: responseTime,
          processingTime: totalTime,
        },
      };
    } catch (error) {
      this.logger.error('Response integration failed:', error);
      return {
        response: state.response || '처리 중 오류가 발생했습니다.',
        metadata: {
          ...state.metadata,
          responseGenerationTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * 간단한 키워드 기반 의도 분석
   */
  private analyzeIntent(query: string): { intent: GraphState['intent']; confidence: number } {
    const queryLower = query.toLowerCase();

    // 레시피 검색 키워드
    const recipeKeywords = [
      '레시피', '요리법', '만드는법', '조리법', '추천',
      '음식', '요리', '만들어', '어떻게', '방법'
    ];

    // 요리 도움 키워드  
    const cookingKeywords = [
      '요리하는', '조리하는', '팁', '비법', '노하우',
      '시간', '온도', '불조절', '썰기', '볶기'
    ];

    // 키워드 매칭
    const recipeScore = recipeKeywords.filter(keyword => queryLower.includes(keyword)).length;
    const cookingScore = cookingKeywords.filter(keyword => queryLower.includes(keyword)).length;

    if (recipeScore > 0) {
      return { intent: 'recipe_search', confidence: Math.min(recipeScore * 0.3, 1.0) };
    }
    
    if (cookingScore > 0) {
      return { intent: 'cooking_help', confidence: Math.min(cookingScore * 0.3, 1.0) };
    }

    return { intent: 'general_chat', confidence: 0.2 };
  }

  /**
   * 레시피 검색 응답 생성
   */
  private generateRecipeSearchResponse(query: string, userStatus?: string): string {
    this.logger.log(`🍳 Generating recipe response for query="${query}" with userStatus="${userStatus || 'none'}"`);
    
    let response = `"${query}"에 대한 레시피를 찾고 있습니다.\n\n`;
    
    if (userStatus) {
      response += `🎯 개인화 정보: ${userStatus}\n`;
      response += `이 정보를 바탕으로 맞춤형 레시피를 추천해드리겠습니다.\n\n`;
    }
    
    response += `💡 더 정확한 추천을 위해 다음 정보를 추가로 알려주세요:
- 요리 시간 (예: 30분 이하)
- 선호하는 재료나 피하고 싶은 재료
- 요리 난이도 (초급/중급/고급)`;

    return response;
  }

  /**
   * 요리 도움 응답 생성
   */
  private generateCookingHelpResponse(query: string, userStatus?: string): string {
    let response = `요리 관련 도움을 드리겠습니다! 📚\n\n`;
    
    if (userStatus) {
      response += `🎯 개인화 정보: ${userStatus}\n`;
      response += `이를 고려한 맞춤형 팁을 제공해드리겠습니다.\n\n`;
    }
    
    response += `"${query}"에 대한 구체적인 도움이 필요하시면:
- 단계별로 자세한 설명을 원하시는지
- 특별한 주의사항이나 팁이 필요한지
- 재료 손질법이나 조리 기법에 대해 궁금한지
더 구체적으로 말씀해주세요!`;

    return response;
  }

  /**
   * 일반 대화 응답 생성
   */
  private generateGeneralChatResponse(query: string, userStatus?: string): string {
    let response = `안녕하세요! 요리 AI 어시스턴트입니다. 🍳\n\n`;
    
    if (userStatus) {
      response += `✨ ${userStatus}인 분이시군요!\n\n`;
    }
    
    response += `다음과 같은 도움을 드릴 수 있습니다:
🔍 레시피 검색 및 추천
🍳 요리 방법 및 팁 제공
📝 맞춤형 요리 가이드

궁금한 것이 있으시면 언제든 물어보세요!`;

    return response;
  }

  /**
   * 개인화된 팁 추가
   */
  private addPersonalizedTips(userStatus: string): string {
    if (userStatus.includes('초보')) {
      return '\n\n💡 초보자 팁: 처음엔 간단한 레시피부터 시작하시는 것을 추천드려요!';
    }
    
    if (userStatus.includes('빠른') || userStatus.includes('30분')) {
      return '\n\n⏰ 시간 절약 팁: 미리 재료를 준비해두면 더 빠르게 요리할 수 있어요!';
    }
    
    if (userStatus.includes('매운맛 못') || userStatus.includes('매운 음식 못')) {
      return '\n\n🌶️ 매운맛 조절 팁: 고춧가루 대신 파프리카 가루를 사용해보세요!';
    }
    
    return '\n\n✨ 개인 맞춤 팁이 더 필요하시면 언제든 말씀해주세요!';
  }

  /**
   * 초기 상태 생성
   */
  createInitialState(query: string, userId?: string): GraphState {
    return {
      query: query.trim(),
      userId,
      userStatus: undefined,
      intent: 'unknown',
      confidence: 0,
      response: '',
      metadata: {
        processingTime: 0,
        intentAnalysisTime: 0,
        responseGenerationTime: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * 워크플로우 상태 검증
   */
  validateWorkflowState(state: GraphState): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!state.query || state.query.trim().length === 0) {
      errors.push('Query is required');
    }

    if (!state.metadata) {
      errors.push('Metadata is required');
    }

    if (!['recipe_search', 'cooking_help', 'general_chat', 'unknown'].includes(state.intent)) {
      errors.push('Invalid intent');
    }

    if (typeof state.confidence !== 'number' || state.confidence < 0 || state.confidence > 1) {
      errors.push('Confidence must be a number between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}