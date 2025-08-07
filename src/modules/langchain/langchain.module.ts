/**
 * 🦜 LangChain 전용 모듈
 * LangChain 기반 AI 서비스들의 중앙 관리 모듈
 */

import { Module, DynamicModule } from '@nestjs/common';
import { LangChainCoreService } from './services/langchain-core.service';
import { LangChainPromptService } from './services/langchain-prompt.service';
import { LangChainChatService } from './services/langchain-chat.service';
import { LangChainAgentService } from './services/langchain-agent.service';
import { IngredientSubstituteService } from './services/ingredient-substitute.service';

export interface LangChainModuleOptions {
  ollama?: {
    baseUrl?: string;
    model?: string;
    temperature?: number;
    timeout?: number;
  };
  enableLogging?: boolean;
  cacheTtl?: number;
}

@Module({})
export class LangChainModule {
  
  /**
   * 동적 모듈 생성 (루트 모듈에서 설정과 함께 import)
   */
  static forRoot(options?: LangChainModuleOptions): DynamicModule {
    return {
      module: LangChainModule,
      providers: [
        {
          provide: 'LANGCHAIN_OPTIONS',
          useValue: {
            ollama: {
              baseUrl: options?.ollama?.baseUrl || 'http://localhost:11434',
              model: options?.ollama?.model || 'gemma3n:e4b',
              temperature: options?.ollama?.temperature || 0.7,
              timeout: options?.ollama?.timeout || 30000,
            },
            enableLogging: options?.enableLogging ?? true,
            cacheTtl: options?.cacheTtl || 300000, // 5분
          },
        },
        LangChainCoreService,
        LangChainPromptService,
        LangChainChatService,
        LangChainAgentService,
        IngredientSubstituteService,
      ],
      exports: [
        LangChainCoreService,
        LangChainPromptService,
        LangChainChatService,
        LangChainAgentService,
        IngredientSubstituteService,
      ],
      global: true, // 전역 모듈로 설정하여 다른 모듈에서 쉽게 사용
    };
  }

  /**
   * 비동기 모듈 생성 (환경변수나 ConfigService 사용시)
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<LangChainModuleOptions> | LangChainModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: LangChainModule,
      providers: [
        {
          provide: 'LANGCHAIN_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        LangChainCoreService,
        LangChainPromptService,
        LangChainChatService,
        LangChainAgentService,
        IngredientSubstituteService,
      ],
      exports: [
        LangChainCoreService,
        LangChainPromptService,
        LangChainChatService,
        LangChainAgentService,
        IngredientSubstituteService,
      ],
      global: true,
    };
  }

  /**
   * 기본 모듈 (설정 없이 기본값으로 사용)
   */
  static forFeature(): DynamicModule {
    return {
      module: LangChainModule,
      providers: [
        LangChainCoreService,
        LangChainPromptService,
        LangChainChatService,
        LangChainAgentService,
        IngredientSubstituteService,
      ],
      exports: [
        LangChainCoreService,
        LangChainPromptService,
        LangChainChatService,
        LangChainAgentService,
        IngredientSubstituteService,
      ],
    };
  }
}