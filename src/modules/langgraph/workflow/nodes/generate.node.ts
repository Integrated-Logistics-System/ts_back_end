import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@/modules/ai/ai.service';
import { ElasticsearchService } from '@/modules/elasticsearch/elasticsearch.service';
import { ElasticsearchRecipe } from '@/modules/elasticsearch/elasticsearch.service';
import { GraphState, UserProfile } from '../../types/workflow.types';

@Injectable()
export class GenerateNode {
  private readonly logger = new Logger(GenerateNode.name);

  constructor(
    private readonly aiService: AiService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async generateRecipe(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`🍳 Generating new recipe based on ${state.searchResults.length} existing recipes`);

    // AI 생성 전용 모드 체크
    if (process.env.USE_AI_GENERATED_ONLY === 'true') {
      this.logger.log('🤖 Using AI-generated only mode, creating recipe from scratch');
      return this.generateFromScratch(state);
    }

    const startTime = Date.now();

    try {
      if (state.searchResults.length === 0) {
        return await this.generateFromScratch(state);
      }

      const baseRecipes = state.searchResults.slice(0, 3);
      const prompt = this.buildGenerationPrompt(state.query, baseRecipes, state.userAllergies, state.userProfile);

      const response = await this.aiService.generateText(prompt, {
        temperature: 0.5,
        maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '4000'),
      });

      const generatedRecipe = this.parseRecipeResponse(response.content);

      if (generatedRecipe) {
        try {
          const saveResult = await this.elasticsearchService.saveRecipe({
            recipe: {
              ...generatedRecipe,
              allergies: state.userAllergies,
              source: 'LangGraph_Workflow_v0.4',
              isAiGenerated: true,
              generationTimestamp: new Date().toISOString(),
            },
          });

          if (saveResult && saveResult.id) {
            generatedRecipe.id = saveResult.id;
            this.logger.log(`✅ Recipe saved with ID: ${saveResult.id}`);
            this.logger.log(`💾 Saved to Elasticsearch: "${generatedRecipe.nameKo}" (${generatedRecipe.name})`);
            this.logger.log(`📊 Recipe Stats: ${generatedRecipe.ingredients?.length || 0}개 재료, ${generatedRecipe.steps?.length || 0}개 단계, ${generatedRecipe.minutes}분 조리시간`);
          }
        } catch (saveError: unknown) {
          this.logger.warn('Recipe save failed, but continuing:', saveError instanceof Error ? saveError.message : 'Unknown error');
          generatedRecipe.id = `generated_${Date.now()}`;
        }
      }

      return {
        generatedRecipe,
        currentStep: 'generation_complete',
        metadata: {
          ...state.metadata,
          generationTime: Date.now() - startTime,
          recipeId: generatedRecipe?.id,
        },
      };

    } catch (error: unknown) {
      this.logger.error('Recipe generation failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        generatedRecipe: null,
        currentStep: 'generation_failed',
      };
    }
  }

  private buildGenerationPrompt(query: string, baseRecipes: ElasticsearchRecipe[], allergies: string[], userProfile: UserProfile | null): string {
    const allergyWarning = allergies.length > 0
      ? `⚠️ 금지 재료: ${allergies.join(', ')}`
      : '';

    // 3개 레시피만 사용하고 재료 수 제한
    const recipeContext = baseRecipes.slice(0, 3).map((recipe, i) => {
      const ingredients = recipe.ingredients?.slice(0, 5) || [];  // 재료 5개만
      return `${i + 1}. ${recipe.name} (${recipe.minutes || 30}분)\n재료: ${ingredients.join(', ')}`;
    }).join('\n\n');

    const userProfileText = userProfile ? `

사용자 프로필:
  - 알레르기: ${userProfile.allergies?.join(', ') || '없음'}
  - 요리 수준: ${userProfile.cookingLevel || '정보 없음'}
  - 선호도: ${userProfile.preferences?.join(', ') || '없음'}` : '';

    return `"${query}" 레시피를 JSON으로 생성해주세요.\n${allergyWarning}${userProfileText}\n\n참고:\n${recipeContext}\n\n반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):\n{\n  "name": "Kimchi Jjigae",\n  "nameKo": "김치찌개",\n  "description": "간단한 설명",\n  "ingredients": ["재료1", "재료2"],\n  "steps": ["멸치 다시마 육수 만들기", "돼지고기 볶아서 김치와 함께 끓이기"],\n  "minutes": 30,\n  "difficulty": "쉬움",\n  "servings": 2,\n  "tags": ["한식"]\n}\n\n주의: steps 배열에는 번호(1., 2., 3.) 없이 순수한 조리 단계만 작성하세요.`;
  }

  private async generateFromScratch(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`🍳 Generating recipe from scratch for: "${state.query}"`);

    const userProfileText = state.userProfile ? `

사용자 프로필:
  - 알레르기: ${state.userProfile.allergies?.join(', ') || '없음'}
  - 요리 수준: ${state.userProfile.cookingLevel || '정보 없음'}
  - 선호도: ${state.userProfile.preferences?.join(', ') || '없음'}` : '';

    const prompt = `"${state.query}" 레시피를 JSON으로 생성해주세요.\n${state.userAllergies.length > 0 ? `⚠️ 금지 재료: ${state.userAllergies.join(', ')}` : ''}${userProfileText}\n\n반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):\n{\n  "name": "Recipe Name",\n  "nameKo": "레시피명",\n  "description": "간단한 설명",\n  "ingredients": ["재료1", "재료2"],\n  "steps": ["재료 손질하기", "볶아서 끓이기"],\n  "minutes": 30,\n  "difficulty": "쉬움",\n  "servings": 2,\n  "tags": ["태그1"]\n}\n\n주의: steps 배열에는 번호(1., 2., 3.) 없이 순수한 조리 단계만 작성하세요.`;

    const response = await this.aiService.generateText(prompt, {
      temperature: 0.7,
      maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '4000'),
    });

    const generatedRecipe = this.parseRecipeResponse(response.content);

    return {
      generatedRecipe,
      currentStep: 'generation_complete'
    };
  }

  private parseRecipeResponse(response: string): ElasticsearchRecipe | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in response');
        return null;
      }

      const jsonString = jsonMatch[0]
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(jsonString);

      if (this.isValidRecipe(parsed)) {
        return {
          id: `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: parsed.name || 'Generated Recipe',
          nameKo: parsed.nameKo || parsed.name || '생성된 레시피',
          nameEn: parsed.name || 'Generated Recipe',
          description: parsed.description || '맛있는 레시피입니다.',
          descriptionKo: parsed.description || '맛있는 레시피입니다.',
          descriptionEn: parsed.description || 'Delicious recipe.',
          ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
          ingredientsKo: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
          ingredientsEn: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
          steps: Array.isArray(parsed.steps) ? parsed.steps : [],
          stepsKo: Array.isArray(parsed.steps) ? parsed.steps : [],
          stepsEn: Array.isArray(parsed.steps) ? parsed.steps : [],
          minutes: parsed.minutes || 30,
          difficulty: parsed.difficulty || '보통',
          servings: parsed.servings || 2,
          nIngredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.length : 0,
          nSteps: Array.isArray(parsed.steps) ? parsed.steps.length : 0,
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          tagsKo: Array.isArray(parsed.tags) ? parsed.tags : [],
          tagsEn: Array.isArray(parsed.tags) ? parsed.tags : [],
          isAiGenerated: true,
          source: 'LangGraph_Workflow_v0.4',
          generationTimestamp: new Date().toISOString(),
          safetyScore: 100,
          isSafeForAllergies: true,
          allergenInfo: undefined,
          allergyRisk: 'high',
        };
      }

      return null;
    } catch (error: unknown) {
      this.logger.error('Recipe parsing failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private isValidRecipe(parsed: unknown): parsed is ElasticsearchRecipe {
    if (!parsed || typeof parsed !== 'object') return false;

    const recipe = parsed as Record<string, unknown>;

    const hasRequiredFields = [
      'name', 'nameKo', 'description', 'ingredients', 'steps'
    ].every(field => field in recipe);

    if (!hasRequiredFields) return false;

    const hasArrayFields = ['ingredients', 'steps'].every(field => 
      Array.isArray(recipe[field])
    );

    return hasArrayFields;
  }
}