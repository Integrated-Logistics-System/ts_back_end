import { Injectable, Logger } from '@nestjs/common';
import { StateGraph } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { 
  IntentAnalysisNode,
  RecipeSearchNode,
  CookingHelpNode,
  GeneralChatNode,
  ResponseIntegrationNode
} from './nodes';

/**
 * Refactored LangGraph Workflow Builder
 * Uses modular node architecture for better maintainability
 */

export interface GraphState {
  // Basic input
  query: string;
  userId?: string;
  userStatus?: string; // "나의 상태" 개인화 컨텍스트
  
  // Intent analysis results
  intent: 'recipe_search' | 'cooking_help' | 'general_chat' | 'unknown';
  confidence: number;
  
  // Processing results
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
    private readonly intentAnalysisNode: IntentAnalysisNode,
    private readonly recipeSearchNode: RecipeSearchNode,
    private readonly cookingHelpNode: CookingHelpNode,
    private readonly generalChatNode: GeneralChatNode,
    private readonly responseIntegrationNode: ResponseIntegrationNode,
  ) {}

  /**
   * Build modular workflow with independent nodes
   * [Intent Analysis] → [Conditional Processing] → [Response Integration]
   */
  buildWorkflow(): any {
    this.logger.log('🔧 Building modular LangGraph workflow...');

    const graph = new StateGraph<GraphState>({
      channels: this.buildChannels(),
    });

    // Add modular nodes
    this.addNodes(graph);
    this.addEdges(graph);

    const workflow = graph.compile();
    this.logger.log('✅ Modular LangGraph workflow built successfully');
    
    return workflow;
  }

  /**
   * Simplified state channels configuration
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
   * Add modular nodes using dependency injection
   */
  private addNodes(graph: any) {
    this.logger.log('🔗 Adding modular workflow nodes...');

    // Add nodes using the process method for consistent error handling
    graph.addNode('intent_analysis', 
      (state: GraphState) => this.intentAnalysisNode.process(state)
    );
    graph.addNode('recipe_search', 
      (state: GraphState) => this.recipeSearchNode.process(state)
    );
    graph.addNode('cooking_help', 
      (state: GraphState) => this.cookingHelpNode.process(state)
    );
    graph.addNode('general_chat', 
      (state: GraphState) => this.generalChatNode.process(state)
    );
    graph.addNode('response_integration', 
      (state: GraphState) => this.responseIntegrationNode.process(state)
    );

    this.logger.log('✅ Modular nodes added successfully');
  }

  /**
   * Add workflow edges for conditional routing
   */
  private addEdges(graph: any) {
    this.logger.log('🔗 Adding workflow edges...');

    // Start → Intent Analysis
    graph.addEdge("__start__", 'intent_analysis');

    // Intent Analysis → Conditional branching
    graph.addConditionalEdges('intent_analysis', (state: GraphState) => {
      this.logger.log(`🎯 Routing based on intent: ${state.intent} (confidence: ${state.confidence})`);
      
      switch (state.intent) {
        case 'recipe_search':
          return 'recipe_search';
        case 'cooking_help':
          return 'cooking_help';
        case 'general_chat':
          return 'general_chat';
        default:
          this.logger.warn(`⚠️ Unknown intent '${state.intent}', defaulting to general_chat`);
          return 'general_chat'; // Safe fallback
      }
    }, {
      'recipe_search': 'recipe_search',
      'cooking_help': 'cooking_help',
      'general_chat': 'general_chat',
    });

    // All processing nodes → Response Integration
    graph.addEdge('recipe_search', 'response_integration');
    graph.addEdge('cooking_help', 'response_integration');
    graph.addEdge('general_chat', 'response_integration');
    
    // Response Integration → End
    graph.addEdge('response_integration', "__end__");

    this.logger.log('✅ Workflow edges added successfully');
  }

  /**
   * Create initial state for workflow execution
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
   * Validate workflow state for debugging
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

  /**
   * Get workflow statistics for monitoring
   */
  getWorkflowStats(state: GraphState) {
    return {
      totalTime: state.metadata.processingTime,
      intentAnalysisTime: state.metadata.intentAnalysisTime,
      responseTime: state.metadata.responseGenerationTime,
      intent: state.intent,
      confidence: state.confidence,
      hasUserContext: !!state.userStatus,
      responseLength: state.response.length,
    };
  }
}