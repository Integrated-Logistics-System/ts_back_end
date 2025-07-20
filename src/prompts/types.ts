// src/prompts/types.ts - 프롬프트 타입 정의

import { ElasticsearchRecipe } from '../modules/elasticsearch/elasticsearch.service';

export interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  variables: string[];
  defaultValues?: Record<string, unknown>;
  tags?: string[];
}

export interface RecipePromptContext {
  query: string;
  userAllergies?: string[];
  preferences?: string[];
  searchResults?: ElasticsearchRecipe[];
  recipeContext?: string;
  existingRecipes?: ElasticsearchRecipe[];
  targetRecipeTitle?: string;
  generatedRecipe?: ElasticsearchRecipe;
}

export interface LangGraphPromptContext {
  query: string;
  userAllergies?: string[];
  currentStep?: string;
  searchResults?: ElasticsearchRecipe[];
  baseRecipes?: ElasticsearchRecipe[];
  metadata?: object;
}

export class PromptBuilder {
  static build(template: PromptTemplate, context: Record<string, unknown>): string {
    let prompt = template.template;
    
    // 변수 치환
    for (const variable of template.variables) {
      const value = context[variable] || template.defaultValues?.[variable] || '';
      const placeholder = new RegExp(`{{${variable}}}`, 'g');
      prompt = prompt.replace(placeholder, String(value));
    }
    
    return prompt;
  }
  
  static validate(template: PromptTemplate, context: Record<string, unknown>): boolean {
    const requiredVars = template.variables.filter(
      variable => !template.defaultValues?.[variable]
    );
    
    return requiredVars.every(variable => context[variable] !== undefined);
  }
}