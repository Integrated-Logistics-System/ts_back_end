// src/prompts/index.ts - 프롬프트 모듈 전체 export

export * from './types';
export * from './prompt-manager';

// Recipe prompts
export * from './recipe/rag-response';
export * from './recipe/detail-request';
export * from './recipe/generation';
export * from './recipe/suggestion';

// LangGraph prompts
export * from './langgraph/generation';

// Chat prompts
export * from './chat/general';

// 편의를 위한 기본 export
export { PromptManager as default } from './prompt-manager';