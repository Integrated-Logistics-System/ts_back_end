// src/shared/interfaces/langgraph.interface.ts - 최신 LangGraph 0.3.8 호환
import { BaseMessage } from '@langchain/core/messages';
import { ElasticsearchRecipe } from '../../modules/elasticsearch/elasticsearch.service';

export interface RecipeWorkflowState {
    messages: BaseMessage[];
    query: string;
    userAllergies: string[];
    searchResults: ElasticsearchRecipe[];
    generatedRecipe?: ElasticsearchRecipe;
    finalResponse: string;
    currentStep: string;
    metadata: WorkflowMetadata;
}

export type StateType = RecipeWorkflowState;

export interface WorkflowMetadata {
    searchTime: number;
    generationTime: number;
    totalTime: number;
    recipeId?: string;
    workflowPath?: string[];
}

export interface RAGRecipeRequest {
    query: string;
    userAllergies?: string[];
    preferences?: string[];
    maxResults?: number;
    conversationContext?: ConversationContext;
}

export interface ConversationContext {
    previousRecipes: RecipeMetadata[];
    isDetailRequest: boolean;
    targetRecipeId?: string;
    targetRecipeTitle?: string;
}

export interface RecipeMetadata {
    id: string;
    title: string;
    titleKo: string;
    generatedAt: number;
    type: 'existing' | 'ai_generated';
    source?: string;
    workflowPath?: string[];
}

export interface RAGRecipeResponse {
    query: string;
    response: string; // aiResponse 대신 response로 통일
    searchResults: ElasticsearchRecipe[];
    generatedRecipe: ElasticsearchRecipe | null;
    metadata: {
        searchTime: number;
        generationTime: number;
        totalTime: number;
        foundRecipes: number;
        source: string;
        ragMode: boolean;
    };
}

export interface WebSocketStreamChunk {
    type: 'step' | 'data' | 'complete' | 'error' | 'status';
    step?: string;
    content: string;
    data?: object;
    timestamp: number;
    userId?: string;
    query?: string;
}

// Interfaces from langgraph.dto.ts


export interface LangGraphRecipeResponse {
  success: boolean;
  response: string;
  metadata: {
    totalTime: number;
    workflow: string;
    workflowPath: string[];
    userId?: string;
    processingTime?: number;
    model?: string;
    workflowType?: string;
  };
  generatedRecipe?: ElasticsearchRecipe;
  timestamp: string;
}

export interface LangGraphChatRequest {
  message: string;
}

export interface LangGraphChatResponse {
  content: string;
  metadata: {
    processingTime: number;
    userId: string;
    model: string;
    workflowType: string;
    memoryUsed: boolean;
  };
  timestamp: string;
}

export interface LangGraphStreamChunk {
  type: 'step' | 'data' | 'complete' | 'error';
  step?: string;
  content: string;
  data?: object;
  timestamp: string;
  userId?: string;
}

export interface WorkflowState {
  query: string;
  allergies: string[];
  isRecipeQuery: boolean;
  isDetailRequest: boolean;
  extractedAllergies: string[];
  recommendedPath: string;
}
