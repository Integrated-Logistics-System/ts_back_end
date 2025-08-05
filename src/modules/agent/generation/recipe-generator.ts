import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { ElasticsearchAgentService } from '../search/elasticsearch-agent';
import { ElasticsearchRecipe, RecipeCreateInput } from '../../elasticsearch/elasticsearch.service';
import { TcreiPromptLoaderService } from '../../prompt-templates/tcrei/tcrei-prompt-loader.service';

export interface AlternativeRecipeRequest {
  originalRecipe: ElasticsearchRecipe;
  missingItems: string[];
  userMessage: string;
  userId?: string;
}

@Injectable()
export class AlternativeRecipeGeneratorService {
  private readonly logger = new Logger(AlternativeRecipeGeneratorService.name);
  private generatedRecipeCounter = 1;

  constructor(
    private readonly aiService: AiService,
    private readonly elasticsearchAgent: ElasticsearchAgentService,
    private readonly tcreiPromptLoader: TcreiPromptLoaderService
  ) {}

  /**
   * 대체 레시피 생성 또는 기존 대체 레시피 조회
   */
  async generateOrFindAlternativeRecipe(request: AlternativeRecipeRequest): Promise<ElasticsearchRecipe | null> {
    try {
      // 1. 먼저 기존에 생성된 대체 레시피가 있는지 확인
      const existingAlternative = await this.findExistingAlternativeRecipe(
        request.originalRecipe.id, 
        request.missingItems
      );
      
      if (existingAlternative) {
        this.logger.log(`📚 기존 대체 레시피 재사용: ${existingAlternative.id}`);
        return existingAlternative;
      }

      // 2. 새로운 대체 레시피 생성
      this.logger.log(`🔄 새 대체 레시피 생성 시작: ${request.originalRecipe.nameKo || request.originalRecipe.name}`);
      const newAlternativeRecipe = await this.generateNewAlternativeRecipe(request);
      
      if (newAlternativeRecipe) {
        // 3. Elasticsearch에 저장
        await this.saveAlternativeRecipe(newAlternativeRecipe);
        this.logger.log(`✅ 대체 레시피 생성 완료: ${newAlternativeRecipe.id}`);
        return newAlternativeRecipe;
      }

      return null;
    } catch (error) {
      this.logger.error('대체 레시피 생성 실패:', error);
      return null;
    }
  }

  /**
   * 새로운 대체 레시피 생성 (LLM 기반)
   */
  private async generateNewAlternativeRecipe(request: AlternativeRecipeRequest): Promise<ElasticsearchRecipe | null> {
    try {
      const prompt = await this.tcreiPromptLoader.getAlternativeRecipePrompt({
        originalRecipe: request.originalRecipe,
        missingIngredients: request.missingItems,
        userMessage: request.userMessage
      });
      
      const llmResponse = await this.aiService.generateResponse(prompt, {
        temperature: 0.3
      });

      if (llmResponse) {
        try {
          // 마크다운 코드 블록 제거 후 JSON 파싱
          const cleanedResponse = this.cleanJsonResponse(llmResponse);
          const parsed = JSON.parse(cleanedResponse);
          
          // 새로운 ID 생성
          const newId = `make_ai_${this.generatedRecipeCounter++}`;
          
          // 기존 레시피를 기반으로 새 레시피 생성
          const alternativeRecipe: ElasticsearchRecipe = {
            ...request.originalRecipe,
            id: newId,
            nameKo: parsed.nameKo || `${request.originalRecipe.nameKo} (대체 버전)`,
            name: parsed.name || `${request.originalRecipe.name} (Alternative)`,
            descriptionKo: parsed.descriptionKo || parsed.description,
            description: parsed.description,
            instructionsKo: parsed.instructionsKo || parsed.instructions,
            instructions: parsed.instructions || parsed.instructionsKo,
            ingredientsKo: parsed.ingredientsKo || parsed.ingredients,
            ingredients: parsed.ingredients || parsed.ingredientsKo,
            minutes: parsed.cookingTime || request.originalRecipe.minutes,
            // AI 생성 레시피임을 표시하는 태그 추가
            tags: [...(request.originalRecipe.tags || []), 'AI생성', '대체레시피'],
            // 원본 레시피 ID 보관
            originalRecipeId: request.originalRecipe.id
          };

          return alternativeRecipe;
        } catch (parseError) {
          this.logger.warn('LLM 대체 레시피 응답 파싱 실패:', parseError instanceof Error ? parseError.message : 'Unknown error');
          this.logger.warn('원본 응답:', llmResponse.substring(0, 200) + '...');
          return null;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('LLM 대체 레시피 생성 실패:', error);
      return null;
    }
  }

  /**
   * JSON 응답에서 마크다운 코드 블록 제거
   */
  private cleanJsonResponse(response: string): string {
    // 마크다운 코드 블록 제거 (```json ... ``` 또는 ``` ... ```)
    let cleaned = response.trim();
    
    // ```json으로 시작하는 경우
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    // ```으로 시작하는 경우
    else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // 추가 정리: 앞뒤 공백 제거
    return cleaned.trim();
  }


  /**
   * 기존 대체 레시피 찾기
   */
  private async findExistingAlternativeRecipe(originalRecipeId: string, missingItems: string[]): Promise<ElasticsearchRecipe | null> {
    try {
      // 원본 레시피 ID와 부족한 아이템을 기반으로 기존 대체 레시피 검색
      const searchQuery = `originalRecipeId:${originalRecipeId} AND tags:대체레시피`;
      const results = await this.elasticsearchAgent.advancedSearch(searchQuery, { limit: 10 });
      
      // 부족한 아이템과 가장 일치하는 대체 레시피 찾기
      for (const recipe of results.recipes) {
        const recipeName = (recipe.nameKo || recipe.name || '').toLowerCase();
        const hasMatchingAlternative = missingItems.some(item => 
          recipeName.includes(item.replace('케밥', '팬')) || 
          recipeName.includes(item.replace('오븐', '팬')) ||
          recipeName.includes('팬') || recipeName.includes('대체')
        );
        
        if (hasMatchingAlternative) {
          return recipe;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.warn('기존 대체 레시피 검색 실패:', error);
      return null;
    }
  }

  /**
   * 대체 레시피를 Elasticsearch에 저장
   */
  private async saveAlternativeRecipe(recipe: ElasticsearchRecipe): Promise<void> {
    try {
      const createInput: RecipeCreateInput = {
        recipe: recipe,
        validate: true
      };
      
      await this.elasticsearchAgent.saveRecipe(createInput);
      this.logger.log(`💾 대체 레시피 저장 완료: ${recipe.id}`);
    } catch (error) {
      this.logger.error(`대체 레시피 저장 실패: ${recipe.id}`, error);
      throw error;
    }
  }

  /**
   * AI 생성 카운터 초기화 (필요시)
   */
  async initializeCounter(): Promise<void> {
    try {
      // make_ai_* 패턴의 레시피 중 가장 큰 번호 찾기
      const results = await this.elasticsearchAgent.advancedSearch('id:make_ai_*', { limit: 1000 });
      
      let maxNumber = 0;
      results.recipes.forEach((recipe: any) => {
        const match = recipe.id.match(/make_ai_(\d+)/);
        if (match && match[1]) {
          const number = parseInt(match[1], 10);
          if (number > maxNumber) {
            maxNumber = number;
          }
        }
      });
      
      this.generatedRecipeCounter = maxNumber + 1;
      this.logger.log(`🔢 대체 레시피 카운터 초기화: ${this.generatedRecipeCounter}`);
    } catch (error) {
      this.logger.warn('카운터 초기화 실패, 기본값 사용:', error);
      this.generatedRecipeCounter = 1;
    }
  }
}