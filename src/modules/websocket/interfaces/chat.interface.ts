// Chat-related interface definitions for PersonalChatService

export interface ChainStatusResponse {
  aiService: {
    isConnected: boolean;
    provider: string;
    model: string;
  };
  chat: {
    messageCount: number;
    hasHistory: boolean;
    lastMessageTime: string | null;
  };
  user: {
    name: string;
    cookingLevel: string;
    allergiesCount: number;
    preferencesCount: number;
  };
  rag: {
    enabled: boolean;
    elasticsearchConnected: boolean;
    recipesIndexed: boolean;
  };
  recipes: {
    totalMentioned: number;
    uniqueRecipes: number;
    lastRecipeTime: string | null;
  };
  performance: {
    maxHistorySize: number;
    cacheTtl: number;
    maxRetryAttempts: number;
  };
  timestamp: string;
  error?: string;
}

export interface UserChatStatsResponse {
  totalMessages: number;
  userMessages: number;
  aiMessages: number;
  recipeRequests: number;
  detailRequests: number;
  successfulRecipes: number;
  averageResponseTime: number;
  lastMessageTime: string | null;
  sessionStartTime: string;
  conversationDuration: number;
  userSatisfactionScore?: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  userId?: string;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  messageType?: 'general' | 'recipe_request' | 'detail_request';
  recipeId?: string;
  recipeName?: string;
  processingTime?: number;
  ragUsed?: boolean;
  userContext?: PersonalizedContext;
  responseQuality?: number;
  errorInfo?: {
    code: string;
    message: string;
    retryCount: number;
  };
}

export interface PersonalizedContext {
  userId: string;
  userName: string;
  cookingLevel: string;
  allergies: string[];
  preferences: string[];
  conversationHistory?: ChatMessage[];
  currentSession?: SessionContext;
}

export interface SessionContext {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  messageCount: number;
  recipeRequests: number;
  currentTopic?: string;
  userIntent?: UserIntent;
}

export interface UserIntent {
  type: 'recipe_search' | 'recipe_detail' | 'cooking_advice' | 'general_chat' | 'ingredient_substitute' | 'nutritional_info';
  confidence: number;
  keywords: string[];
  targetRecipe?: string;
  specificRequest?: string;
}

export interface ProcessingResult {
  success: boolean;
  response: string;
  metadata: ChatMessageMetadata;
  shouldSave: boolean;
  processingTime: number;
}

export interface MessageStorageResult {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
    retryCount: number;
  };
  backupUsed?: boolean;
}

export interface ConversationAnalysisResult {
  isDetailRequest: boolean;
  targetRecipe?: string;
  userIntent: UserIntent;
  context: PersonalizedContext;
  suggestedAction: 'process_detail' | 'process_recipe' | 'general_chat';
}

export interface RecipeSearchStrategy {
  name: string;
  priority: number;
  execute: (context: PersonalizedContext, query: string) => Promise<string | null>;
}

export interface PromptTemplate {
  systemPrompt: string;
  userInfo: string;
  chatHistory: string;
  instructions: string;
  context: string;
}

export interface ResponseChunk {
  id: string;
  content: string;
  isComplete: boolean;
  metadata?: {
    chunkIndex: number;
    totalChunks: number;
    processingTime: number;
  };
}

export interface ChatConfiguration {
  maxHistorySize: number;
  cacheTtl: number;
  maxRetryAttempts: number;
  enableRAG: boolean;
  enableDetailRequests: boolean;
  enableRecipeGeneration: boolean;
  responseTimeout: number;
  maxResponseLength: number;
}

export interface TimeContext {
  currentTime: Date;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  mealTime?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  isWeekend: boolean;
  season: 'spring' | 'summer' | 'fall' | 'winter';
}

export interface UserPreferences {
  cookingLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredCuisines: string[];
  dietaryRestrictions: string[];
  allergies: string[];
  favoriteFlavors: string[];
  cookingMethods: string[];
  timeConstraints?: {
    maxCookingTime: number;
    quickMealsPreferred: boolean;
  };
}