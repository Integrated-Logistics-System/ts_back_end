import { BaseMessage } from '@langchain/core/messages';
import { ElasticsearchRecipe, AllergenInfo } from '@/modules/elasticsearch/elasticsearch.service';

// 🔥 통합된 WorkflowMetadata 타입
export interface WorkflowMetadata {
  searchTime: number;
  generationTime: number;
  totalTime: number;
  recipeId?: string;
  foundRecipes?: number;
  source?: string;
  ragMode?: boolean;
  workflowPath?: string[];
  originalQuery?: string;
  processedKeywords?: string[];
  // Enhanced analysis metadata
  queryIntent?: any;
  extractedEntities?: any[];
  semanticTags?: string[];
  confidenceScore?: number;
  queryComplexity?: 'simple' | 'medium' | 'complex';
  suggestedRefinements?: string[];
  fallbackUsed?: boolean;
  // Query analysis metadata
  queryType?: 'new_recipe' | 'follow_up' | 'recipe_detail' | 'general';
  queryConfidence?: number;
}

// 🔥 User Profile 타입 (임시)
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  allergies?: string[];
  cookingLevel?: string;
  preferences?: string[];
}

// 🔥 메인 GraphState 인터페이스
export interface GraphState {
  messages: BaseMessage[];
  query: string;
  userAllergies: string[];
  userId: string | null;
  userProfile: UserProfile | null;
  searchKeywords?: string[]; // 분석된 검색 키워드
  searchFilters?: any; // 분석된 검색 필터
  searchResults: ElasticsearchRecipe[];
  generatedRecipe: ElasticsearchRecipe | null;
  finalResponse: string;
  currentStep: string;
  queryType?: 'new_recipe' | 'follow_up' | 'recipe_detail' | 'general'; // 쿼리 유형
  queryConfidence?: number; // 쿼리 유형 신뢰도
  isFollowUp?: boolean; // 후속 질문 여부
  conversationContext?: ConversationContext; // 대화 맥락
  metadata: WorkflowMetadata;
}

// 🔥 노드 타입 정의
export type NodeName = 'analyze_query' | 'search_recipes' | 'generate_recipe' | 'create_response';

// 🔥 노드 실행 결과
export interface NodeResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Partial<WorkflowMetadata>;
}

// 🔥 ElasticsearchRecipe 확장 타입 (누락된 속성 추가)
export interface ExtendedElasticsearchRecipe extends ElasticsearchRecipe {
  servings?: number; // 누락된 servings 속성 추가
  allergenInfo?: AllergenInfo; // 올바른 타입 정의
}

// 🔥 RAG 요청/응답 타입 (통합)
export interface RAGRecipeRequest {
  query: string;
  userAllergies?: string[];
  preferences?: string[];
  maxResults?: number;
  conversationContext?: ConversationContext;
}

export interface RAGRecipeResponse {
  query: string;
  response: string; // aiResponse가 아닌 response로 통일
  searchResults: ElasticsearchRecipe[];
  generatedRecipe: ElasticsearchRecipe | null;
  metadata: WorkflowMetadata;
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

// 🔥 WebSocket 스트리밍 타입
export interface WebSocketStreamChunk {
  type: 'step' | 'data' | 'complete' | 'error' | 'status' | 'message';
  step?: string;
  content: string;
  data?: object;
  timestamp: number;
  userId?: string;
  query?: string;
  metadata?: Record<string, any>;
}

// 🔥 레시피 생성 요청/응답 타입
export interface RecipeGenerationRequest {
  query: string;
  userAllergies: string[];
  preferences?: string[];
  baseRecipes?: ElasticsearchRecipe[];
}

export interface RecipeGenerationResponse {
  success: boolean;
  recipe: ElasticsearchRecipe;
  metadata: {
    generationTime: number;
    model: string;
    baseRecipesUsed: number;
  };
}

// 🔥 검색 필터 타입
export interface SearchFilters {
  allergies?: string[];
  preferences?: string[];
  difficulty?: string;
  maxTime?: number;
  minRating?: number;
  tags?: string[];
}

// 🔥 검색 결과 타입
export interface SearchResult {
  recipes: ElasticsearchRecipe[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  filters: SearchFilters;
  metadata: {
    searchTime: number;
    filteredCount: number;
    safeRecipeCount: number;
  };
}

// 🔥 알레르기 정보 타입
export interface AllergyInfo {
  isSafe: boolean;
  warnings: string[];
  riskyIngredients: string[];
  allergenScore: number;
}

// 🔥 서비스 상태 타입
export interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  components: Record<string, ComponentStatus>;
  timestamp: number;
}

export interface ComponentStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
  lastCheck?: number;
}

// 🔥 워크플로우 통계 타입
export interface WorkflowStats {
  totalExecutions: number;
  averageExecutionTime: number;
  successRate: number;
  errorCount: number;
  lastExecution: number | null;
  version: string;
  timestamp: number;
}

// 🔥 캐시 관리 타입
export interface CacheResult {
  success: boolean;
  message: string;
  pattern?: string;
  clearedCount?: number;
}