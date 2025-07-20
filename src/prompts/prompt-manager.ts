// src/prompts/prompt-manager.ts - 모든 프롬프트 통합 관리

import { PromptTemplate, PromptBuilder } from './types';
import { RecipeMetadata } from '../shared/interfaces/langgraph.interface';

// Recipe prompts
import { ragRecipeResponsePrompt } from './recipe/rag-response';
import { recipeDetailPrompt } from './recipe/detail-request';
import { recipeGenerationPrompt, recipeFromScratchPrompt } from './recipe/generation';
import { recipeSuggestionPrompt, noResultsPrompt } from './recipe/suggestion';

// LangGraph prompts
import { langgraphRecipeGenerationPrompt, langgraphResponsePrompt } from './langgraph/generation';

// Chat prompts
import { generalChatPrompt, personalizedChatPrompt } from './chat/general';

export class PromptManager {
  private static prompts: Map<string, PromptTemplate> = new Map();

  static {
    // Recipe prompts 등록
    this.register(ragRecipeResponsePrompt);
    this.register(recipeDetailPrompt);
    this.register(recipeGenerationPrompt);
    this.register(recipeFromScratchPrompt);
    this.register(recipeSuggestionPrompt);
    this.register(noResultsPrompt);

    // LangGraph prompts 등록
    this.register(langgraphRecipeGenerationPrompt);
    this.register(langgraphResponsePrompt);

    // Chat prompts 등록
    this.register(generalChatPrompt);
    this.register(personalizedChatPrompt);
  }

  private static register(prompt: PromptTemplate): void {
    this.prompts.set(prompt.name, prompt);
  }

  static get(name: string): PromptTemplate | undefined {
    return this.prompts.get(name);
  }

  static build(name: string, context: Record<string, unknown>): string {
    const template = this.get(name);
    if (!template) {
      throw new Error(`프롬프트 템플릿을 찾을 수 없습니다: ${name}`);
    }

    if (!PromptBuilder.validate(template, context)) {
      throw new Error(`프롬프트 컨텍스트가 유효하지 않습니다: ${name}`);
    }

    return PromptBuilder.build(template, context);
  }

  static list(): PromptTemplate[] {
    return Array.from(this.prompts.values());
  }

  static listByTag(tag: string): PromptTemplate[] {
    return this.list().filter(prompt => prompt.tags?.includes(tag));
  }

  static getRecipePrompts(): PromptTemplate[] {
    return this.listByTag('recipe');
  }

  static getLangGraphPrompts(): PromptTemplate[] {
    return this.listByTag('langgraph');
  }

  static getChatPrompts(): PromptTemplate[] {
    return this.listByTag('chat');
  }

  // 편의 메서드들
  static buildRAGResponse(context: {
    query: string;
    recipeContext: string;
    allergyInfo?: string;
  }): string {
    return this.build('rag_recipe_response', context);
  }

  static buildRecipeDetail(context: {
    query: string;
    recipeData: string;
    allergyInfo?: string;
  }): string {
    return this.build('recipe_detail_request', context);
  }

  static buildRecipeGeneration(context: {
    query: string;
    recipeContext: string;
    allergyWarning?: string;
    preferenceText?: string;
  }): string {
    return this.build('recipe_generation', context);
  }

  static buildLangGraphGeneration(context: {
    query: string;
    allergyWarning?: string;
    recipeContext?: string;
  }): string {
    return this.build('langgraph_recipe_generation', context);
  }

  static buildLangGraphResponse(context: {
    query: string;
    context: string;
    allergyInfo?: string;
    recipeMetadata?: RecipeMetadata;
  }): string {
    return this.build('langgraph_response_generation', context);
  }

  static buildGeneralChat(context: {
    message: string;
    context?: string;
  }): string {
    return this.build('general_chat', context);
  }

  static buildPersonalizedChat(context: {
    message: string;
    context?: string;
    userProfile?: string;
  }): string {
    return this.build('personalized_chat', context);
  }
}