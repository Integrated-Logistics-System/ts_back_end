// src/shared/interfaces/langchain.interface.ts

import { BaseMessage } from '@langchain/core/messages';

export interface LangChainChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    chainType?: string;
    model?: string;
    temperature?: number;
    tokenCount?: number;
  };
}

export interface LangChainMemoryData {
  userId: string;
  messages: BaseMessage[];
  lastUpdated: Date;
  messageCount: number;
  memoryType: 'conversation' | 'recipe' | 'rag';
}

export interface PersonalizedPromptContext {
  userName: string;
  cookingLevel: 'beginner' | 'intermediate' | 'advanced';
  allergies: string[];
  preferences: string[];
  currentTime: string;
  previousConversation?: string;
}

export interface ChainConfiguration {
  model: string;
  temperature: number;
  maxTokens?: number;
  streaming: boolean;
  verbose: boolean;
  memoryType: 'buffer' | 'summary' | 'redis';
}

export interface LangChainResponse {
  content: string;
  metadata: {
    model: string;
    chainType: string;
    processingTime: number;
    tokenCount?: number;
    memoryUsed: boolean;
  };
  timestamp: Date;
}

export interface RecipeChainContext extends PersonalizedPromptContext {
  ingredients?: string[];
  cookingTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
}

export interface RAGChainContext extends PersonalizedPromptContext {
  searchQuery: string;
  retrievedDocuments: Array<{
    content: string;
    score: number;
    source: string;
  }>;
  maxRelevantDocs: number;
}

export interface ChainMemoryOptions {
  maxMessages: number;
  ttlDays: number;
  compressionThreshold?: number;
  summaryMaxTokens?: number;
}

export interface LangChainStreamChunk {
  type: 'start' | 'content' | 'end' | 'error';
  data?: string;
  metadata?: {
    chunkIndex: number;
    totalChunks?: number;
    processingTime?: number;
  };
  timestamp: number;
}