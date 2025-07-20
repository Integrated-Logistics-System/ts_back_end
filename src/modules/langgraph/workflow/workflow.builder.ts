import { Injectable, Logger } from '@nestjs/common';
import { StateGraph } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { ElasticsearchRecipe } from '@/modules/elasticsearch/elasticsearch.service';
import { GraphState, NodeName, UserProfile } from '../types/workflow.types';
import { AnalyzeNode } from './nodes/analyze.node';
import { SearchNode } from './nodes/search.node';
import { GenerateNode } from './nodes/generate.node';
import { ResponseNode } from './nodes/response.node';
import { ValidationUtils } from '../utils/validation.utils';

@Injectable()
export class WorkflowBuilder {
  private readonly logger = new Logger(WorkflowBuilder.name);

  constructor(
    private readonly analyzeNode: AnalyzeNode,
    private readonly searchNode: SearchNode,
    private readonly generateNode: GenerateNode,
    private readonly responseNode: ResponseNode,
    private readonly validationUtils: ValidationUtils,
  ) {}

  /**
   * LangGraph 워크플로우 생성
   */
  buildWorkflow(): Runnable<GraphState, GraphState> {
    this.logger.log('🔧 Building LangGraph workflow...');

    const graph = new StateGraph<GraphState>({
      channels: this.buildChannels(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // 노드 추가
    this.addNodes(graph);

    // 엣지 추가
    this.addEdges(graph);

    // 워크플로우 컴파일
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const workflow = graph.compile() as any;

    this.logger.log('✅ LangGraph workflow built successfully');
    return workflow;
  }

  /**
   * 상태 채널 정의
   */
  private buildChannels() {
    return {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
      query: {
        value: (x: string, y: string) => y ?? x,
        default: () => '',
      },
      userAllergies: {
        value: (x: string[], y: string[]) => y ?? x,
        default: () => [],
      },
      userId: {
        value: (x: string | null, y: string | null) => y ?? x,
        default: () => null,
      },
      userProfile: {
        value: (x: UserProfile | null, y: UserProfile | null) => y ?? x,
        default: () => null,
      },
      searchResults: {
        value: (x: ElasticsearchRecipe[], y: ElasticsearchRecipe[]) => y ?? x,
        default: () => [],
      },
      generatedRecipe: {
        value: (x: ElasticsearchRecipe | null, y: ElasticsearchRecipe | null) => y ?? x,
        default: () => null,
      },
      finalResponse: {
        value: (x: string, y: string) => y ?? x,
        default: () => '',
      },
      currentStep: {
        value: (x: string, y: string) => y ?? x,
        default: () => 'start',
      },
      metadata: {
        value: (x: GraphState['metadata'], y: GraphState['metadata']) => ({ ...x, ...y }),
        default: () => ({
          searchTime: 0,
          generationTime: 0,
          totalTime: 0,
        }),
      },
    };
  }

  /**
   * 워크플로우 노드 추가
   */
  private addNodes(graph: StateGraph<GraphState>) {
    this.logger.log('🔗 Adding workflow nodes...');

    // 각 노드를 바인딩하여 추가
    graph.addNode('analyze_query' as NodeName, this.analyzeNode.analyzeQuery.bind(this.analyzeNode));
    graph.addNode('search_recipes' as NodeName, this.searchNode.searchRecipes.bind(this.searchNode));
    graph.addNode('generate_recipe' as NodeName, this.generateNode.generateRecipe.bind(this.generateNode));
    graph.addNode('create_response' as NodeName, this.responseNode.createResponse.bind(this.responseNode));

    this.logger.log('✅ All nodes added successfully');
  }

  /**
   * 워크플로우 엣지 추가
   */
  private addEdges(graph: StateGraph<GraphState>) {
    this.logger.log('🔗 Adding workflow edges...');

    // 시작 엣지
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    graph.addEdge("__start__" as any, 'analyze_query' as any);

    // 조건부 엣지: 쿼리 분석 결과에 따라 분기
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    graph.addConditionalEdges('analyze_query' as any, (state: GraphState) => {
      const nextNode = this.validationUtils.isRecipeRelated(state.query) ? 'search_recipes' : 'create_response';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
      return nextNode as any;
    }, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      'search_recipes': 'search_recipes' as any,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      'create_response': 'create_response' as any
    });

    // 조건부 엣지: 검색 결과에 따라 분기
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    graph.addConditionalEdges('search_recipes' as any, (state: GraphState) => {
      // 검색 결과가 있으면 바로 응답 생성, 없으면 AI 레시피 생성
      const nextNode = (state.searchResults && state.searchResults.length > 0) ? 'create_response' : 'generate_recipe';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
      return nextNode as any;
    }, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      'generate_recipe': 'generate_recipe' as any,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      'create_response': 'create_response' as any
    });

    // AI 생성 후 응답으로
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    graph.addEdge('generate_recipe' as any, 'create_response' as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    graph.addEdge('create_response' as any, "__end__" as any);

    this.logger.log('✅ All edges added successfully');
  }

  /**
   * 워크플로우 상태 검증
   */
  validateWorkflowState(state: GraphState): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 필수 필드 검증
    if (!state.query || state.query.trim().length === 0) {
      errors.push('Query is required');
    }

    if (!state.currentStep) {
      errors.push('Current step is required');
    }

    if (!state.metadata) {
      errors.push('Metadata is required');
    }

    // 배열 필드 검증
    if (!Array.isArray(state.messages)) {
      errors.push('Messages must be an array');
    }

    if (!Array.isArray(state.userAllergies)) {
      errors.push('User allergies must be an array');
    }

    if (!Array.isArray(state.searchResults)) {
      errors.push('Search results must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 초기 상태 생성
   */
  createInitialState(
    query: string,
    allergies: string[] = [],
    userId: string | null = null,
    userProfile: UserProfile | null = null,
  ): GraphState {
    return {
      messages: [],
      query: query.trim(),
      userAllergies: allergies,
      userId,
      userProfile,
      searchResults: [],
      generatedRecipe: null,
      finalResponse: '',
      currentStep: 'start',
      metadata: {
        searchTime: 0,
        generationTime: 0,
        totalTime: 0,
      },
    };
  }

  /**
   * 워크플로우 실행 통계 생성
   */
  generateExecutionStats(state: GraphState): Record<string, any> {
    const stats = {
      query: state.query,
      currentStep: state.currentStep,
      searchResultsCount: state.searchResults.length,
      hasGeneratedRecipe: !!state.generatedRecipe,
      allergies: state.userAllergies,
      timing: {
        searchTime: state.metadata.searchTime,
        generationTime: state.metadata.generationTime,
        totalTime: state.metadata.totalTime,
      },
      responseLength: state.finalResponse.length,
      timestamp: new Date().toISOString(),
    };

    return stats;
  }

  /**
   * 워크플로우 성능 메트릭 계산
   */
  calculatePerformanceMetrics(state: GraphState): Record<string, any> {
    const totalTime = state.metadata.totalTime;
    const searchTime = state.metadata.searchTime;
    const generationTime = state.metadata.generationTime;
    
    const searchPercentage = totalTime > 0 ? (searchTime / totalTime) * 100 : 0;
    const generationPercentage = totalTime > 0 ? (generationTime / totalTime) * 100 : 0;

    return {
      totalExecutionTime: totalTime,
      searchTimePercentage: Math.round(searchPercentage),
      generationTimePercentage: Math.round(generationPercentage),
      averageTimePerResult: state.searchResults.length > 0 ? searchTime / state.searchResults.length : 0,
      throughput: totalTime > 0 ? 1000 / totalTime : 0, // requests per second
      efficiency: this.calculateEfficiency(state),
    };
  }

  /**
   * 워크플로우 효율성 계산
   */
  private calculateEfficiency(state: GraphState): number {
    let efficiency = 0;
    
    // 검색 효율성
    if (state.searchResults.length > 0) {
      efficiency += 0.3;
    }
    
    // 생성 효율성
    if (state.generatedRecipe) {
      efficiency += 0.4;
    }
    
    // 응답 효율성
    if (state.finalResponse.length > 0) {
      efficiency += 0.3;
    }
    
    // 시간 효율성 (30초 이하면 보너스)
    if (state.metadata.totalTime < 30000) {
      efficiency += 0.1;
    }
    
    return Math.min(efficiency, 1.0);
  }

  /**
   * 워크플로우 디버그 정보 생성
   */
  generateDebugInfo(state: GraphState): Record<string, any> {
    return {
      stateSnapshot: {
        query: state.query,
        currentStep: state.currentStep,
        userAllergies: state.userAllergies,
        searchResultsCount: state.searchResults.length,
        hasGeneratedRecipe: !!state.generatedRecipe,
        finalResponseLength: state.finalResponse.length,
      },
      metadata: state.metadata,
      validation: this.validateWorkflowState(state),
      performance: this.calculatePerformanceMetrics(state),
      timestamp: new Date().toISOString(),
    };
  }
}