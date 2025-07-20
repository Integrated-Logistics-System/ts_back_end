// LangGraph 서비스에서 프롬프트 매니저 사용 예시

import { Injectable, Logger } from '@nestjs/common';
// import { StateGraph, END } from '@langchain/langgraph'; // Currently unused
import { PromptManager } from './prompt-manager';
import { RecipeWorkflowState } from '../shared/interfaces/langgraph.interface';
import { ElasticsearchRecipe } from '../modules/elasticsearch/elasticsearch.service';

@Injectable()
export class UpdatedLanggraphService {
  private readonly logger = new Logger(UpdatedLanggraphService.name);

  constructor(
    // ... 기존 의존성들
  ) {}

  // Mock services for example purposes - these would be injected in real implementation
  private aiService = {
    generateText: async (_prompt: string, _options: Record<string, unknown>) => ({ content: 'Mock AI response' })
  };

  private elasticsearchService = {
    saveGeneratedRecipe: async (_recipe: Record<string, unknown>) => ({ success: true, recipeId: `mock_${Date.now()}` })
  };

  private workflow = {
    compile: () => ({
      stream: async function* (_initialState: RecipeWorkflowState) {
        // Mock implementation for streaming
        yield { mockStep: { finalResponse: 'Mock response', searchResults: [], generatedRecipe: undefined } };
      },
      invoke: async (initialState: RecipeWorkflowState): Promise<RecipeWorkflowState> => {
        // Mock implementation for invoke
        return { ...initialState, finalResponse: 'Mock final response' };
      }
    })
  };

  private parseRecipeResponse = (response: string): ElasticsearchRecipe | null => {
    // Mock implementation
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]) as ElasticsearchRecipe;
    } catch {
      return null;
    }
  };

  private getStepDescription = (nodeName: string): string => {
    const descriptions: { [key: string]: string } = {
      'analyze_query': '쿼리 분석 중',
      'search_recipes': '레시피 검색 중',
      'generate_recipe': '레시피 생성 중',
      'create_response': '응답 생성 중'
    };
    return descriptions[nodeName] || '처리 중';
  };

  // ✅ 프롬프트 매니저를 사용한 레시피 생성 노드
  private async generateRecipe(state: RecipeWorkflowState): Promise<Partial<RecipeWorkflowState>> {
    this.logger.log(`🍳 Generating new recipe based on ${state.searchResults.length} existing recipes`);
    
    const startTime = Date.now();
    
    try {
      if (state.searchResults.length === 0) {
        return await this.generateFromScratchWithPrompts(state);
      }

      // 기존 레시피를 기반으로 새로운 레시피 생성
      const baseRecipes = state.searchResults.slice(0, 3);
      const allergyWarning = state.userAllergies.length > 0
        ? `⚠️ 절대 사용하면 안 되는 재료 (알레르기): ${state.userAllergies.join(', ')}`
        : '';

      const recipeContext = baseRecipes.map((recipe, i) => 
        `참고 레시피 ${i + 1}: ${recipe.name}
재료: ${recipe.ingredients?.join(', ') || '정보 없음'}
조리시간: ${recipe.minutes || 30}분`
      ).join('\n\n');

      // 🔥 프롬프트 매니저 사용
      const prompt = PromptManager.buildLangGraphGeneration({
        query: state.query,
        allergyWarning,
        recipeContext
      });

      const response = await this.aiService.generateText(prompt, {
        temperature: 0.8,
        maxTokens: 2000,
      });

      const generatedRecipe = this.parseRecipeResponse(response.content);

      if (generatedRecipe) {
        // Elasticsearch에 저장
        const saveResult = await this.elasticsearchService.saveGeneratedRecipe({
          ...generatedRecipe,
          allergies: state.userAllergies,
          source: 'LangGraph_Workflow_Enhanced',
        });

        if (saveResult.success) {
          generatedRecipe.id = saveResult.recipeId;
          this.logger.log(`✅ Recipe saved with ID: ${saveResult.recipeId}`);
        }
      }

      return {
        generatedRecipe: generatedRecipe || undefined,
        currentStep: 'generation_complete',
        metadata: {
          ...state.metadata,
          generationTime: Date.now() - startTime,
          recipeId: generatedRecipe?.id,
        },
      };

    } catch (error) {
      this.logger.error('Recipe generation failed:', error);
      return {
        generatedRecipe: undefined,
        currentStep: 'generation_failed',
      };
    }
  }

  // ✅ 프롬프트 매니저를 사용한 최종 응답 생성
  private async createResponse(state: RecipeWorkflowState): Promise<Partial<RecipeWorkflowState>> {
    this.logger.log(`📝 Creating final response using PromptManager`);
    
    try {
      let finalResponse = '';

      if (state.generatedRecipe) {
        // 새 레시피가 생성된 경우 - LangGraph 전용 프롬프트 사용
        const context = this.buildContextWithGenerated(state.searchResults, state.generatedRecipe);
        const allergyInfo = state.userAllergies.length > 0
          ? `사용자 알레르기: ${state.userAllergies.join(', ')}`
          : '알레르기 정보 없음';

        // 🔥 LangGraph 응답 프롬프트 사용
        const prompt = PromptManager.buildLangGraphResponse({
          query: state.query,
          context,
          allergyInfo,
          recipeMetadata: {
            id: state.generatedRecipe.id || `generated_${Date.now()}`,
            title: state.generatedRecipe.nameKo || 'Generated Recipe',
            titleKo: state.generatedRecipe.nameKo || '생성된 레시피',
            generatedAt: Date.now(),
            type: 'ai_generated' as const
          }
        });

        const response = await this.aiService.generateText(prompt, {
          temperature: 0.7,
          maxTokens: 1200,
        });

        finalResponse = response.content;

      } else if (state.searchResults.length > 0) {
        // 기존 레시피만 있는 경우 - 일반 RAG 프롬프트 사용
        const context = this.buildSearchContext(state.searchResults);
        const allergyInfo = state.userAllergies.length > 0
          ? `사용자 알레르기: ${state.userAllergies.join(', ')}`
          : '알레르기 정보 없음';

        // 🔥 RAG 응답 프롬프트 사용
        finalResponse = PromptManager.buildRAGResponse({
          query: state.query,
          recipeContext: context,
          allergyInfo
        });

      } else {
        // 결과가 없는 경우 - 빈 결과 프롬프트 사용
        const allergyNote = state.userAllergies.length > 0
          ? ` (${state.userAllergies.join(', ')} 알레르기 제외)`
          : '';

        // 🔥 빈 결과 프롬프트 사용
        finalResponse = PromptManager.build('no_results_response', {
          query: state.query,
          allergyNote
        });
      }

      return {
        finalResponse,
        currentStep: 'complete',
        metadata: {
          ...state.metadata,
          totalTime: Date.now() - (state.metadata.searchTime + state.metadata.generationTime),
        },
      };

    } catch (error) {
      this.logger.error('Response creation failed:', error);
      return {
        finalResponse: '죄송합니다. 응답 생성 중 오류가 발생했습니다.',
        currentStep: 'response_failed',
      };
    }
  }

  // ✅ 처음부터 생성하는 경우도 프롬프트 매니저 사용
  private async generateFromScratchWithPrompts(state: RecipeWorkflowState): Promise<Partial<RecipeWorkflowState>> {
    this.logger.log(`🍳 Generating recipe from scratch using PromptManager for: "${state.query}"`);
    
    const allergyWarning = state.userAllergies.length > 0
      ? `⚠️ 절대 사용 금지: ${state.userAllergies.join(', ')}`
      : '';

    // 🔥 처음부터 생성 프롬프트 사용
    const prompt = PromptManager.build('recipe_from_scratch', {
      query: state.query,
      allergyWarning
    });

    const response = await this.aiService.generateText(prompt, {
      temperature: 0.9,
      maxTokens: 1500,
    });

    const generatedRecipe = this.parseRecipeResponse(response.content);
    return { 
      generatedRecipe: generatedRecipe || undefined,
      currentStep: 'generation_complete'
    };
  }

  // ✅ 컨텍스트 생성 헬퍼 메서드들
  private buildContextWithGenerated(searchResults: ElasticsearchRecipe[], generatedRecipe: ElasticsearchRecipe): string {
    const generatedContext = `🎆 새로 생성된 맞춤 레시피: ${generatedRecipe.nameKo}
레시피 ID: ${generatedRecipe.id || `generated_${Date.now()}`}
재료: ${generatedRecipe.ingredients.join(', ')}
설명: ${generatedRecipe.description}
난이도: ${generatedRecipe.difficulty} (${generatedRecipe.steps.length}단계)
조리시간: ${generatedRecipe.minutes}분
인분: ${(generatedRecipe as { servings?: number }).servings || 2}인분
✅ AI가 사용자 요청에 맞춰 새로운 레시피를 창조했습니다!`;

    const existingContext = searchResults.slice(0, 3).map((recipe, index) => {
      return `레시피 ${index + 1}: ${recipe.name || recipe.nameKo}
레시피 ID: ${recipe.id}
재료: ${Array.isArray(recipe.ingredients) ? recipe.ingredients.join(', ') : '정보 없음'}
조리시간: ${recipe.minutes || 30}분`;
    }).join('\n\n');

    return `${generatedContext}\n\n${existingContext}`;
  }

  private buildSearchContext(searchResults: ElasticsearchRecipe[]): string {
    return searchResults.slice(0, 5).map((recipe, index) => {
      return `레시피 ${index + 1}: ${recipe.name || recipe.nameKo}
레시피 ID: ${recipe.id}
재료: ${Array.isArray(recipe.ingredients) ? recipe.ingredients.join(', ') : '정보 없음'}
설명: ${recipe.description || '설명 없음'}
난이도: ${recipe.difficulty || '정보 없음'}
조리시간: ${recipe.minutes ? `${recipe.minutes}분` : '정보 없음'}`;
    }).join('\n\n');
  }

  // ✅ 스트리밍 워크플로우에서도 프롬프트 매니저 활용
  async *streamRecipeWorkflowWithPrompts(query: string, allergies: string[] = []): AsyncIterable<{
    type: 'status' | 'context' | 'response' | 'generation' | 'complete' | 'error';
    content: string;
    done: boolean;
    generatedRecipe?: ElasticsearchRecipe;
    promptUsed?: string; // 사용된 프롬프트 정보 추가
  }> {
    try {
      yield { 
        type: 'status', 
        content: '🚀 Enhanced LangGraph 워크플로우 시작 (프롬프트 매니저 활용)...', 
        done: false,
        promptUsed: 'workflow_start'
      };

      // 워크플로우 실행...
      const compiled = this.workflow.compile();
      
      const initialState: RecipeWorkflowState = {
        messages: [],
        query,
        userAllergies: allergies,
        searchResults: [],
        finalResponse: '',
        currentStep: 'start',
        metadata: { searchTime: 0, generationTime: 0, totalTime: 0 },
      };

      for await (const step of compiled.stream(initialState)) {
        const stepEntries = Object.entries(step);
        if (stepEntries.length > 0) {
          const stepEntry = stepEntries[0];
          if (stepEntry) {
            const [nodeName, nodeOutput] = stepEntry;
          
          yield { 
            type: 'status', 
            content: `📍 ${this.getStepDescription(nodeName)} (프롬프트 기반)`,
            done: false,
            promptUsed: this.getPromptNameForNode(nodeName)
          };
          
          if (nodeOutput && typeof nodeOutput === 'object' && 'generatedRecipe' in nodeOutput) {
            yield { 
              type: 'generation', 
              content: '🍳 새로운 레시피가 프롬프트 매니저로 생성되었습니다!',
              done: false,
              generatedRecipe: (nodeOutput as { generatedRecipe?: ElasticsearchRecipe }).generatedRecipe,
              promptUsed: 'langgraph_recipe_generation'
            };
          }
        }
        }
      }
      
      // 최종 결과
      const finalResult = await compiled.invoke(initialState);
      yield { 
        type: 'complete', 
        content: finalResult.finalResponse,
        done: true,
        promptUsed: this.getFinalPromptUsed(finalResult)
      };

    } catch (error) {
      this.logger.error('Enhanced streaming workflow failed:', error);
      yield { 
        type: 'error', 
        content: '워크플로우 처리 중 오류가 발생했습니다.',
        done: true,
        promptUsed: 'error_fallback'
      };
    }
  }

  private getPromptNameForNode(nodeName: string): string {
    const promptMap: { [key: string]: string } = {
      'analyze_query': 'query_analysis',
      'search_recipes': 'recipe_search',
      'generate_recipe': 'langgraph_recipe_generation',
      'create_response': 'langgraph_response_generation',
    };
    
    return promptMap[nodeName] || 'unknown_prompt';
  }

  private getFinalPromptUsed(result: RecipeWorkflowState): string {
    if (result.generatedRecipe) {
      return 'langgraph_response_generation';
    } else if (result.searchResults?.length > 0) {
      return 'rag_recipe_response';
    } else {
      return 'no_results_response';
    }
  }

  // ... 기타 헬퍼 메서드들
}