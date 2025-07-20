import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { ConversationState, RecipeReference, ConversationManagerService } from './conversation-manager.service';

export interface PersonalizedResponse {
  content: string;
  tone: 'friendly' | 'informative' | 'encouraging' | 'helpful';
  actionRequired?: 'none' | 'recipe_selection' | 'ingredient_check' | 'cooking_start';
  suggestedFollowups?: string[];
  recipeData?: any;
}

@Injectable()
export class PersonalizedResponseService {
  private readonly logger = new Logger(PersonalizedResponseService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly conversationManager: ConversationManagerService,
  ) {}

  // ================== 메인 응답 생성 ==================

  async generatePersonalizedResponse(
    userId: string,
    message: string,
    conversationState: ConversationState
  ): Promise<PersonalizedResponse> {
    try {
      const intent = conversationState.userIntent;
      const stage = conversationState.currentStage;

      this.logger.log(`🎯 Generating response for intent: ${intent}, stage: ${stage}`);

      switch (intent) {
        case 'search':
          return await this.handleRecipeSearch(message, conversationState);
        
        case 'detail':
          return await this.handleRecipeDetail(message, conversationState);
        
        case 'substitute':
          return await this.handleIngredientSubstitute(message, conversationState);
        
        case 'help':
          return await this.handleCookingHelp(message, conversationState);
        
        default:
          return await this.handleGeneralChat(message, conversationState);
      }
    } catch (error) {
      this.logger.error('Failed to generate personalized response:', error);
      return this.getFallbackResponse();
    }
  }

  // ================== 레시피 검색 처리 ==================

  private async handleRecipeSearch(message: string, state: ConversationState): Promise<PersonalizedResponse> {
    // Elasticsearch에서 레시피 검색
    const searchResults = await this.elasticsearchService.searchRecipes(message, {
      limit: 5,
      allergies: [], // 추후 사용자 알레르기 정보 연동
    });

    if (!searchResults?.recipes?.length) {
      return {
        content: this.generateNoResultsResponse(message),
        tone: 'helpful',
        actionRequired: 'none',
        suggestedFollowups: [
          '다른 요리로 검색해보세요',
          '재료 이름으로 검색해보세요',
          '간단한 요리 추천 받기'
        ]
      };
    }

    // 검색 결과를 RecipeReference로 변환
    const recipeRefs: RecipeReference[] = searchResults.recipes.map((recipe, index) => ({
      id: recipe.id,
      title: recipe.name || '',
      titleKo: recipe.nameKo || recipe.name || '',
      shortDescription: recipe.descriptionKo || recipe.description || '',
      position: index + 1,
      mentioned: false,
    }));

    // 대화 상태 업데이트
    state.currentRecipes = recipeRefs;

    // 자연스러운 응답 생성
    const responseContent = await this.generateRecipeSearchResponse(message, recipeRefs, state);

    return {
      content: responseContent,
      tone: 'friendly',
      actionRequired: 'recipe_selection',
      suggestedFollowups: [
        '첫 번째 레시피 자세히 알려줘',
        '재료가 적은 것으로 추천해줘',
        '다른 요리도 보여줘'
      ],
      recipeData: recipeRefs,
    };
  }

  // ================== 레시피 상세 정보 처리 ==================

  private async handleRecipeDetail(message: string, state: ConversationState): Promise<PersonalizedResponse> {
    // 참조 해결
    let selectedRecipe = await this.conversationManager.resolveReference(state, message);
    
    // 참조가 없으면 메시지에서 직접 검색
    if (!selectedRecipe) {
      this.logger.log(`📝 No reference found, searching directly for: ${message}`);
      
      // 직접 검색 수행
      const searchResults = await this.elasticsearchService.searchRecipes(message, {
        limit: 1,
        allergies: [],
      });
      
      if (searchResults?.recipes?.length > 0) {
        const recipe = searchResults.recipes[0];
        if (recipe) {
          selectedRecipe = {
            id: recipe.id,
            title: recipe.name || '',
            titleKo: recipe.nameKo || recipe.name || '',
            shortDescription: recipe.descriptionKo || recipe.description || '',
            position: 1,
            mentioned: false,
          };
        }
      } else {
        return {
          content: '죄송해요, 해당 레시피를 찾을 수 없어요. 다른 키워드로 검색해보시거나 더 구체적으로 말씀해주세요!',
          tone: 'helpful',
          actionRequired: 'recipe_selection',
        };
      }
    }

    // 선택된 레시피의 상세 정보 가져오기
    if (!selectedRecipe) {
      return {
        content: '죄송해요, 해당 레시피를 찾을 수 없어요. 다른 키워드로 검색해보시거나 더 구체적으로 말씀해주세요!',
        tone: 'helpful',
        actionRequired: 'recipe_selection',
      };
    }
    
    const detailedRecipe = await this.elasticsearchService.getRecipeById(selectedRecipe.id);
    
    if (!detailedRecipe) {
      return {
        content: '죄송해요, 해당 레시피의 상세 정보를 찾을 수 없어요. 다른 레시피를 선택해주시거나 새로 검색해볼까요?',
        tone: 'helpful',
        actionRequired: 'recipe_selection',
      };
    }

    // 자연스러운 상세 응답 생성
    const responseContent = await this.generateDetailedRecipeResponse(detailedRecipe, state);

    return {
      content: responseContent,
      tone: 'informative',
      actionRequired: 'cooking_start',
      suggestedFollowups: [
        '재료 중에 없는 게 있어요',
        '이 요리의 팁이 있나요?',
        '다른 비슷한 요리도 알려줘'
      ],
      recipeData: detailedRecipe,
    };
  }

  // ================== 응답 텍스트 생성 ==================

  private async generateRecipeSearchResponse(
    query: string, 
    recipes: RecipeReference[], 
    state: ConversationState
  ): Promise<string> {
    const context = this.conversationManager.buildConversationContext(state);
    
    const prompt = `
당신은 친근하고 도움이 되는 AI 요리 어시스턴트입니다. 

사용자 질문: "${query}"

검색된 레시피들:
${recipes.map((r, i) => `${i + 1}. ${r.titleKo} - ${r.shortDescription}`).join('\n')}

대화 맥락:
${context}

다음 지침을 따라 자연스럽고 친근한 응답을 생성해주세요:

1. 사용자의 요청에 공감하며 시작
2. 검색된 레시피들을 간단히 소개 (번호와 함께)
3. 어떤 레시피에 대해 더 자세히 알고 싶은지 물어보기
4. 친근하고 도움이 되는 톤 유지
5. 너무 길지 않게 (3-4문장)

예시:
"${query.includes('김치찌개') ? '김치찌개' : '그 요리'}가 생각나는 날이네요! 😊 제가 찾은 레시피들을 보여드릴게요:

1. 김치찌개 기본 레시피 - 돼지고기와 김치로 만드는 정통 김치찌개
2. 참치 김치찌개 - 돼지고기 대신 참치로 만드는 간단한 버전  
3. 해물 김치찌개 - 새우와 조개를 넣은 시원한 김치찌개

어떤 레시피가 궁금하신가요? '첫 번째 레시피 자세히 알려줘'라고 말씀해주시면 재료와 만드는 방법을 알려드릴게요!"

응답:`;

    const response = await this.aiService.generateResponse(prompt, {
      temperature: 0.7,
      maxTokens: 300,
    });

    return response || this.getFallbackSearchResponse(recipes);
  }

  private async generateDetailedRecipeResponse(recipe: any, state: ConversationState): Promise<string> {
    const context = this.conversationManager.buildConversationContext(state);
    
    // 전체 단계 정보 준비
    const fullSteps = Array.isArray(recipe.steps_json_ko) ? recipe.steps_json_ko : 
                     Array.isArray(recipe.steps_json) ? recipe.steps_json : 
                     Array.isArray(recipe.instructions) ? recipe.instructions : [];
    
    const prompt = `
당신은 친근하고 경험 많은 AI 요리 어시스턴트입니다.

사용자가 선택한 레시피: ${recipe.name_ko || recipe.name}

레시피 정보:
- 재료: ${Array.isArray(recipe.ingredients_json_ko) ? recipe.ingredients_json_ko.join(', ') : '정보 없음'}
- 소요시간: ${recipe.minutes || '정보 없음'}분
- 난이도: ${recipe.difficulty_ko || recipe.difficulty || '정보 없음'}
- 전체 조리 단계: ${fullSteps.join(' / ')}

대화 맥락:
${context}

다음 지침으로 친근하고 도움이 되는 응답을 생성해주세요:

1. 레시피 선택에 대해 긍정적으로 반응
2. 재료 목록을 깔끔하게 정리해서 제시 
3. **전체 조리 단계를 순서대로 번호를 매겨서 상세히 설명**
4. 요리 팁이나 주의사항 추가
5. 추가 도움 제안

응답 형식:
"좋은 선택이에요! [레시피명]은/는 [간단한 특징] 요리예요.

📝 **필요한 재료:**
- [재료 목록]

👩‍🍳 **만드는 방법:**
1. [첫 번째 단계]
2. [두 번째 단계]
3. [세 번째 단계]
... (모든 단계를 순서대로)

💡 **팁:** [유용한 팁]

혹시 재료 중에 없는 것이 있거나, 만드는 과정에서 궁금한 점이 있으시면 언제든 물어보세요!"

응답:`;

    const response = await this.aiService.generateResponse(prompt, {
      temperature: 0.6,
      maxTokens: 500,
    });

    return response || this.getFallbackDetailResponse(recipe);
  }

  // ================== 재료 대체 처리 ==================

  private async handleIngredientSubstitute(message: string, state: ConversationState): Promise<PersonalizedResponse> {
    const selectedRecipe = state.selectedRecipe;
    
    if (!selectedRecipe) {
      return {
        content: '어떤 레시피의 재료를 대체하고 싶으신가요? 먼저 레시피를 선택해주시면 재료 대체 방법을 알려드릴게요!',
        tone: 'helpful',
        actionRequired: 'recipe_selection',
      };
    }

    const prompt = `
사용자가 "${message}"라고 물어봤습니다.
현재 논의 중인 레시피: ${selectedRecipe.titleKo}

재료 대체에 대한 친근하고 실용적인 조언을 해주세요:
1. 어떤 재료를 대체하고 싶은지 파악
2. 적절한 대체 재료 제안
3. 맛의 차이나 주의사항 설명
4. 격려와 함께 마무리

응답:`;

    const response = await this.aiService.generateResponse(prompt, {
      temperature: 0.7,
      maxTokens: 300,
    });

    return {
      content: response || '재료 대체에 대해 구체적으로 어떤 재료를 바꾸고 싶으신지 알려주시면 도움드릴게요!',
      tone: 'helpful',
      actionRequired: 'none',
      suggestedFollowups: [
        '이 재료 꼭 넣어야 하나요?',
        '비슷한 다른 요리도 추천해줘',
        '요리 시작할게요'
      ]
    };
  }

  // ================== 요리 도움 처리 ==================

  private async handleCookingHelp(message: string, state: ConversationState): Promise<PersonalizedResponse> {
    const prompt = `
사용자가 "${message}"라고 요리 도움을 요청했습니다.

친근하고 경험 많은 요리사처럼 도움을 주세요:
1. 사용자의 질문에 공감
2. 구체적이고 실용적인 조언
3. 실수를 방지하는 팁
4. 격려의 말

응답:`;

    const response = await this.aiService.generateResponse(prompt, {
      temperature: 0.7,
      maxTokens: 250,
    });

    return {
      content: response || '요리하면서 궁금한 점이 있으시군요! 구체적으로 어떤 부분이 어려우신지 알려주시면 더 정확한 도움을 드릴 수 있어요.',
      tone: 'encouraging',
      actionRequired: 'none',
    };
  }

  // ================== 일반 대화 처리 ==================

  private async handleGeneralChat(message: string, state: ConversationState): Promise<PersonalizedResponse> {
    const context = this.conversationManager.buildConversationContext(state);
    
    const prompt = `
당신은 친근한 AI 요리 어시스턴트입니다.

사용자 메시지: "${message}"
대화 맥락: ${context}

친근하고 자연스럽게 대화하면서, 요리와 관련된 도움을 제안해주세요.

응답:`;

    const response = await this.aiService.generateResponse(prompt, {
      temperature: 0.8,
      maxTokens: 200,
    });

    return {
      content: response || '안녕하세요! 오늘은 어떤 요리를 도와드릴까요? 😊',
      tone: 'friendly',
      actionRequired: 'none',
      suggestedFollowups: [
        '오늘 뭐 먹을까요?',
        '간단한 요리 추천해줘',
        '냉장고 재료로 만들 수 있는 요리'
      ]
    };
  }

  // ================== 폴백 응답들 ==================

  private generateNoResultsResponse(query: string): string {
    return `"${query}"에 대한 레시피를 찾지 못했어요 😅 
    
다른 키워드로 검색해보시거나, 구체적인 요리 이름으로 다시 물어보시면 도움드릴게요! 
예를 들어 "김치찌개 레시피" 또는 "닭가슴살 요리"처럼 말씀해주세요.`;
  }

  private getFallbackSearchResponse(recipes: RecipeReference[]): string {
    return `찾아드린 레시피들이에요! 😊

${recipes.map((r, i) => `${i + 1}. ${r.titleKo}`).join('\n')}

어떤 레시피가 궁금하신가요? "첫 번째 레시피 자세히 알려줘"라고 말씀해주세요!`;
  }

  private getFallbackDetailResponse(recipe: any): string {
    return `${recipe.name_ko || recipe.name} 레시피를 선택하셨군요! 

재료와 만드는 방법을 정리해서 알려드릴게요. 혹시 궁금한 점이 있으시면 언제든 물어보세요! 😊`;
  }

  private getFallbackResponse(): PersonalizedResponse {
    return {
      content: '죄송해요, 일시적으로 응답 생성에 문제가 있어요. 다시 말씀해주시면 도움드릴게요! 😅',
      tone: 'helpful',
      actionRequired: 'none',
    };
  }
}