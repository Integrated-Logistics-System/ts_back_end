// 업데이트된 LangChain 서비스에서 프롬프트 사용 예시

import { Injectable, Logger } from '@nestjs/common';
import { PromptManager } from './prompt-manager';
import { ElasticsearchRecipe } from '../modules/elasticsearch/elasticsearch.service';

@Injectable()
export class UpdatedLangchainService {
  private readonly logger = new Logger(UpdatedLangchainService.name);

  constructor(
    // ... 기존 의존성들
  ) {}

  // Mock services for example purposes - these would be injected in real implementation
  private aiService = {
    generateText: async (_prompt: string, _options: Record<string, unknown>) => ({ content: 'Mock AI response' })
  };

  private searchRecipes = async (_query: string, _allergies: string[]): Promise<ElasticsearchRecipe[]> => {
    // Mock implementation
    return [];
  };

  private parseGeneratedRecipe = (aiResponse: string): ElasticsearchRecipe | null => {
    // Mock implementation for parsing generated recipe
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON 형식을 찾을 수 없습니다');
      }
      return JSON.parse(jsonMatch[0]) as ElasticsearchRecipe;
    } catch {
      return null;
    }
  };

  // ✅ 개선된 RAG 응답 생성 - 프롬프트 분리됨
  private async generateRAGResponse(
    query: string,
    context: string,
    allergies?: string[]
  ): Promise<string> {
    const allergyInfo = allergies?.length
      ? `사용자 알레르기: ${allergies.join(', ')}`
      : '알레르기 정보 없음';

    // 🔥 프롬프트 매니저 사용
    const prompt = PromptManager.buildRAGResponse({
      query,
      recipeContext: context,
      allergyInfo
    });

    try {
      const response = await this.aiService.generateText(prompt, {
        temperature: 0.7,
        maxTokens: 1000,
      });

      return response.content;
    } catch (error) {
      this.logger.error('RAG response generation failed:', error);
      return '죄송합니다. 응답 생성 중 오류가 발생했습니다.';
    }
  }

  // ✅ 개선된 상세 정보 응답 - 프롬프트 분리됨
  private async generateDetailResponse(
    query: string,
    recipe: ElasticsearchRecipe,
    allergies?: string[]
  ): Promise<string> {
    const recipeData = `
- **레시피 ID**: ${recipe.id}
- **이름**: ${recipe.nameKo || recipe.name}
- **설명**: ${recipe.description || '맛있는 요리입니다'}
- **재료**: ${Array.isArray(recipe.ingredients) ? recipe.ingredients.join(', ') : '정보 준비 중'}
- **조리시간**: ${recipe.minutes || 30}분
- **난이도**: ${recipe.difficulty || '보통'}
- **인분**: ${(recipe as { servings?: number }).servings || 2}인분`;

    const allergyInfo = allergies?.length
      ? `사용자 알레르기: ${allergies.join(', ')}`
      : '알레르기 정보 없음';

    // 🔥 프롬프트 매니저 사용
    const prompt = PromptManager.buildRecipeDetail({
      query,
      recipeData,
      allergyInfo
    });

    try {
      const response = await this.aiService.generateText(prompt, {
        temperature: 0.6,
        maxTokens: 1500,
      });

      return response.content;
    } catch (error) {
      this.logger.error('Detail response generation failed:', error);
      return this.getDetailErrorResponse(recipe, recipe.name);
    }
  }

  // ✅ 개선된 레시피 생성 - 프롬프트 분리됨
  private async generateNewRecipe(
    baseRecipes: ElasticsearchRecipe[],
    userQuery: string,
    userAllergies: string[],
    preferences: string[] = []
  ): Promise<{ success: boolean; recipe?: ElasticsearchRecipe; error?: string }> {
    try {
      const recipeContext = this.buildRecipeGenerationContext(baseRecipes, userQuery, userAllergies);
      const allergyWarning = userAllergies.length > 0
        ? `⚠️ 절대 금지 재료: ${userAllergies.join(', ')} - 이 재료들은 절대 사용하지 마세요!`
        : '';
      
      const preferenceText = preferences.length > 0
        ? `선호 스타일: ${preferences.join(', ')}`
        : '';

      // 🔥 프롬프트 매니저 사용
      const prompt = PromptManager.buildRecipeGeneration({
        query: userQuery,
        recipeContext,
        allergyWarning,
        preferenceText
      });

      const response = await this.aiService.generateText(prompt, {
        temperature: 0.8,
        maxTokens: 2000,
      });

      const generatedRecipe = this.parseGeneratedRecipe(response.content);
      
      if (!generatedRecipe) {
        throw new Error('AI 응답을 파싱할 수 없습니다');
      }

      return { success: true, recipe: generatedRecipe };
    } catch (error) {
      this.logger.error('Recipe generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  // ✅ 개선된 일반 채팅 - 프롬프트 분리됨
  private async generateChatResponse(message: string, context: string): Promise<string> {
    // 🔥 프롬프트 매니저 사용
    const prompt = PromptManager.buildGeneralChat({
      message,
      context
    });

    try {
      const response = await this.aiService.generateText(prompt, {
        temperature: 0.7,
        maxTokens: 500,
      });

      return response.content;
    } catch (error) {
      this.logger.error('Chat response generation failed:', error);
      return '죄송합니다. 응답 생성 중 오류가 발생했습니다.';
    }
  }

  // ✅ 개선된 LangGraph 워크플로우 연동
  async processWithLangGraphPrompts(query: string, allergies: string[] = []): Promise<{ success: boolean; response: string; generatedRecipe?: ElasticsearchRecipe; searchResults: ElasticsearchRecipe[]; }> {
    // 기존 레시피 검색
    const searchResults = await this.searchRecipes(query, allergies);
    
    if (searchResults.length > 0) {
      // LangGraph 프롬프트로 새 레시피 생성
      const allergyWarning = allergies.length > 0
        ? `⚠️ 절대 사용하면 안 되는 재료 (알레르기): ${allergies.join(', ')}`
        : '';

      const recipeContext = searchResults.slice(0, 3).map((recipe, i) => 
        `참고 레시피 ${i + 1}: ${recipe.name}
재료: ${recipe.ingredients?.join(', ') || '정보 없음'}
조리시간: ${recipe.minutes || 30}분`
      ).join('\n\n');

      // 🔥 LangGraph 전용 프롬프트 사용
      const generationPrompt = PromptManager.buildLangGraphGeneration({
        query,
        allergyWarning,
        recipeContext
      });

      const generatedRecipe = await this.aiService.generateText(generationPrompt, {
        temperature: 0.8,
        maxTokens: 1500,
      });

      // 최종 응답 생성
      const responsePrompt = PromptManager.buildLangGraphResponse({
        query,
        context: `새로 생성된 레시피: ${generatedRecipe.content}\n\n기존 레시피: ${recipeContext}`,
        allergyInfo: allergyWarning,
        recipeMetadata: { 
          id: `generated_${Date.now()}`,
          title: 'Generated Recipe',
          titleKo: '생성된 레시피',
          generatedAt: Date.now(),
          type: 'ai_generated' as const
        }
      });

      const finalResponse = await this.aiService.generateText(responsePrompt, {
        temperature: 0.7,
        maxTokens: 1200,
      });

      return {
        success: true,
        response: finalResponse.content,
        generatedRecipe: this.parseGeneratedRecipe(generatedRecipe.content) || undefined,
        searchResults
      };
    }

    // 검색 결과 없을 때
    const noResultsResponse = PromptManager.build('no_results_response', {
      query,
      allergyNote: allergies.length > 0 ? ` (${allergies.join(', ')} 알레르기 제외)` : ''
    });

    return {
      success: false,
      response: noResultsResponse,
      searchResults: []
    };
  }

  // ... 기타 헬퍼 메서드들
  private buildRecipeGenerationContext(baseRecipes: ElasticsearchRecipe[], userQuery: string, userAllergies: string[]): string {
    const recipeExamples = baseRecipes.slice(0, 3).map((recipe: ElasticsearchRecipe, index: number) => {
      return `참고 레시피 ${index + 1}: ${recipe.name || recipe.nameKo}
재료: ${Array.isArray(recipe.ingredients) ? recipe.ingredients.join(', ') : '정보 없음'}
조리시간: ${recipe.minutes || '30'}분
난이도: ${recipe.difficulty || '보통'}
설명: ${recipe.description || '설명 없음'}`;
    }).join('\n\n');

    const allergyWarning = userAllergies.length > 0
      ? `⚠️ 절대 사용하면 안 되는 재료 (알레르기): ${userAllergies.join(', ')}`
      : '알레르기 제한 없음';

    return `사용자 요청: "${userQuery}"
${allergyWarning}

${recipeExamples}`;
  }


  private getDetailErrorResponse(recipe: ElasticsearchRecipe, recipeTitle: string): string {
    return `😔 "${recipeTitle || '해당 레시피'}"에 대한 상세 정보를 생성하는 중 오류가 발생했습니다.

📋 **기본 정보**:
- 레시피명: ${recipe?.nameKo || recipe?.name || recipeTitle}
- 레시피 ID: ${recipe?.id || '정보 없음'}
- 조리시간: ${recipe?.minutes || 30}분
- 난이도: ${recipe?.difficulty || '보통'}

💡 **다시 시도해주시거나, 다른 질문을 해주세요!**`;
  }
}