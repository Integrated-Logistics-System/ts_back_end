import { Injectable, Logger } from '@nestjs/common';
import { Ollama } from '@langchain/ollama';
import { Tool } from '@langchain/core/tools';
import { AgentExecutor } from 'langchain/agents';
import { PromptTemplate } from '@langchain/core/prompts';
import { RecipeSearchService } from './recipe-search.service';
import { ElasticsearchService, ElasticsearchRecipe } from '../../elasticsearch/elasticsearch.service';
import { ConversationContext } from '../types/langchain.types';

/**
 * 🧠 ReAct (Reasoning + Acting) 패턴 에이전트 서비스
 * 사용자 요청을 단계별로 추론하고 적절한 도구를 사용하여 응답 생성
 */
@Injectable()
export class ReactAgentService {
  private readonly logger = new Logger(ReactAgentService.name);
  private readonly ollama: Ollama;
  private tools: Tool[] = [];
  private reactPrompt: PromptTemplate | null = null;

  constructor(
    private readonly recipeSearchService: RecipeSearchService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {
    // Ollama 모델 초기화 (ReAct 추론용)
    this.ollama = new Ollama({
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3:1.7b',
      temperature: parseFloat(process.env.OLLAMA_TEMPERATURE_REACT || '0.3'), // ReAct는 낮은 온도
    });

    this.initializeAgent();
    this.logger.log('🧠 ReAct Agent Service initialized');
  }

  /**
   * ReAct 에이전트 초기화 (간소화된 버전)
   */
  private async initializeAgent() {
    try {
      // 도구들 정의
      const tools = [
        new RecipeSearchTool(this.recipeSearchService),
        new RecipeDetailTool(this.elasticsearchService),
        new AllergyFilterTool(),
        new CookingTipsTool(),
        new IngredientSubstitutionTool(),
      ];

      // 간단한 ReAct 프롬프트 템플릿
      const prompt = PromptTemplate.fromTemplate(`
당신은 전문적인 AI 셰프입니다. 사용자의 요청을 단계별로 분석하고 적절한 도구를 사용하여 최고의 요리 조언을 제공하세요.

사용자 요청: {input}

다음 형식으로 응답하세요:
1. 먼저 사용자의 요청을 분석하세요
2. 필요한 도구를 사용하세요
3. 결과를 바탕으로 최종 답변을 제공하세요

한국어로 친근하게 답변해주세요.
      `);

      // 도구들을 저장 (수동으로 ReAct 패턴 구현)
      this.tools = tools;
      this.reactPrompt = prompt;

      this.logger.log('✅ ReAct Agent initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize ReAct Agent:', error);
    }
  }

  /**
   * 🌊 ReAct 스트리밍 실행 (간소화된 버전)
   */
  async *executeReactStream(
    input: string, 
    sessionId: string,
    context?: ConversationContext
  ): AsyncGenerator<{ type: string; content: string; metadata?: any; timestamp: number }, void, unknown> {
    const startTime = Date.now();
    this.logger.log(`🧠 [${sessionId}] Starting ReAct execution for: "${input.substring(0, 30)}..."`);

    try {
      // 시작 신호
      yield {
        type: 'react_start',
        content: '🧠 AI가 단계별로 분석을 시작합니다...',
        timestamp: Date.now(),
      };

      // 1단계: 의도 분석
      yield {
        type: 'thought',
        content: `💭 **분석 1**: 사용자가 "${input}"에 대해 요청했습니다. 어떤 도구를 사용해야 할지 분석하겠습니다.`,
        timestamp: Date.now(),
      };

      await new Promise(resolve => setTimeout(resolve, 500));

      // 2단계: 도구 선택 및 실행
      const selectedTool = this.selectBestTool(input, context);
      
      yield {
        type: 'action',
        content: `🔧 **도구 사용**: ${selectedTool.name}을 사용하여 정보를 조회합니다.`,
        timestamp: Date.now(),
      };

      await new Promise(resolve => setTimeout(resolve, 500));

      // 3단계: 도구 실행
      const toolResult = await this.executeTool(selectedTool, input, context);
      
      yield {
        type: 'observation',
        content: `📊 **결과**: ${toolResult.summary}`,
        timestamp: Date.now(),
      };

      await new Promise(resolve => setTimeout(resolve, 500));

      // 4단계: 최종 답변 생성
      const finalAnswer = await this.generateFinalAnswer(input, toolResult, context);

      yield {
        type: 'final_answer',
        content: finalAnswer,
        metadata: {
          processingTime: Date.now() - startTime,
          stepsCount: 4,
          toolsUsed: [selectedTool.name],
        },
        timestamp: Date.now(),
      };

      this.logger.log(`✅ [${sessionId}] ReAct execution completed in ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error(`❌ [${sessionId}] ReAct execution error:`, error);
      
      yield {
        type: 'error',
        content: '죄송합니다. 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 입력에 따라 최적의 도구 선택
   */
  private selectBestTool(input: string, context?: ConversationContext): Tool {
    const inputLower = input.toLowerCase();
    
    if (this.tools.length === 0) {
      throw new Error('도구가 초기화되지 않았습니다.');
    }
    
    // 레시피 상세 조회
    if (inputLower.includes('만드는') || inputLower.includes('조리법') || inputLower.includes('자세히')) {
      const tool = this.tools.find(tool => tool.name === 'recipe_detail_tool');
      return tool as Tool || this.tools[0] as Tool;
    }
    
    // 요리 팁
    if (inputLower.includes('팁') || inputLower.includes('대신') || inputLower.includes('어떻게')) {
      const tool = this.tools.find(tool => tool.name === 'cooking_tips_tool');
      return tool as Tool || this.tools[0] as Tool;
    }
    
    // 재료 대체
    if (inputLower.includes('대체') || inputLower.includes('없는데') || inputLower.includes('대신')) {
      const tool = this.tools.find(tool => tool.name === 'ingredient_substitution_tool');
      return tool as Tool || this.tools[0] as Tool;
    }
    
    // 기본: 레시피 검색
    const tool = this.tools.find(tool => tool.name === 'recipe_search_tool');
    return tool as Tool || this.tools[0] as Tool;
  }

  /**
   * 선택된 도구 실행
   */
  private async executeTool(tool: Tool, input: string, context?: ConversationContext): Promise<{ summary: string; data: any }> {
    try {
      let toolInput: string;
      
      if (tool.name === 'recipe_search_tool') {
        toolInput = JSON.stringify({ keywords: input, limit: 5 });
      } else if (tool.name === 'cooking_tips_tool') {
        toolInput = JSON.stringify({ topic: input });
      } else if (tool.name === 'ingredient_substitution_tool') {
        const ingredients = input.match(/[가-힣]+/g) || [input];
        toolInput = JSON.stringify({ ingredient: ingredients[0] });
      } else {
        toolInput = JSON.stringify({ query: input });
      }

      const result = await (tool as any)._call(toolInput);
      const parsedResult = JSON.parse(result);
      
      return {
        summary: `${tool.name}을 통해 ${parsedResult.success ? '성공적으로' : '부분적으로'} 정보를 조회했습니다.`,
        data: parsedResult
      };
    } catch (error) {
      return {
        summary: `도구 실행 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: null
      };
    }
  }

  /**
   * 최종 답변 생성
   */
  private async generateFinalAnswer(input: string, toolResult: any, context?: ConversationContext): Promise<string> {
    try {
      const contextStr = this.buildContextString(context);
      const promptInput = {
        input: input,
        tool_result: JSON.stringify(toolResult.data, null, 2),
        context: contextStr
      };

      const prompt = PromptTemplate.fromTemplate(`
사용자 요청: {input}
도구 실행 결과: {tool_result}
컨텍스트: {context}

위 정보를 바탕으로 사용자에게 친근하고 도움이 되는 답변을 한국어로 작성해주세요.
레시피가 있다면 구체적으로 설명하고, 요리 팁이 있다면 실용적으로 제공해주세요.
      `);

      const formattedPrompt = await prompt.format(promptInput);
      const response = await this.ollama.invoke(formattedPrompt);
      
      return response;
    } catch (error) {
      return `요청해주신 "${input}"에 대한 정보를 처리했습니다. 자세한 내용은 위의 조회 결과를 참고해주세요.`;
    }
  }


  /**
   * 컨텍스트 정보를 문자열로 변환
   */
  private buildContextString(context?: ConversationContext): string {
    if (!context) return '';

    let contextStr = '';
    
    if (context.allergies && context.allergies.length > 0) {
      contextStr += `알레르기: ${context.allergies.join(', ')}\n`;
    }
    
    if (context.cookingLevel) {
      contextStr += `요리 수준: ${context.cookingLevel}\n`;
    }

    if (context.history && context.history.length > 0) {
      const recentHistory = context.history.slice(-2).map(h => 
        `${h.type}: ${h.text}`
      ).join(', ');
      contextStr += `최근 대화: ${recentHistory}\n`;
    }

    return contextStr.trim();
  }
}

/**
 * 🔍 레시피 검색 도구
 */
class RecipeSearchTool extends Tool {
  name = "recipe_search_tool";
  description = "키워드로 레시피를 검색합니다. keywords(문자열), limit(숫자, 기본값 5)를 JSON으로 입력하세요.";

  constructor(private recipeSearchService: RecipeSearchService) {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      const params = JSON.parse(input);
      const keywords = params.keywords || params.query || '';
      const limit = params.limit || 5;

      const result = await this.recipeSearchService.searchAndProcessRecipes(
        keywords,
        undefined,
        limit
      );

      return JSON.stringify({
        success: true,
        found: result.recipes.length,
        recipes: result.recipes.slice(0, 5).map(r => ({
          id: (r as any)._id || 'unknown',
          name: r.nameKo || r.nameEn,
          description: (r.descriptionKo || r.descriptionEn || '').substring(0, 100),
          cookingTime: r.cookingTime,
          difficulty: r.difficulty,
          category: r.category,
        }))
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `검색 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
}

/**
 * 📖 레시피 상세 조회 도구
 */
class RecipeDetailTool extends Tool {
  name = "recipe_detail_tool";
  description = "특정 레시피의 상세 정보를 조회합니다. recipeId(문자열)를 JSON으로 입력하세요.";

  constructor(private elasticsearchService: ElasticsearchService) {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      const params = JSON.parse(input);
      const recipeId = params.recipeId || params.id;

      if (!recipeId) {
        return JSON.stringify({
          success: false,
          error: 'recipeId가 필요합니다.'
        });
      }

      const recipe = await this.elasticsearchService.getRecipeById(recipeId);

      if (!recipe) {
        return JSON.stringify({
          success: false,
          error: '레시피를 찾을 수 없습니다.'
        });
      }

      return JSON.stringify({
        success: true,
        recipe: {
          id: (recipe as any)._id || 'unknown',
          name: recipe.nameKo || recipe.nameEn,
          description: recipe.descriptionKo || recipe.descriptionEn,
          ingredients: recipe.ingredientsKo || recipe.ingredientsEn || [],
          steps: recipe.stepsKo || recipe.stepsEn || [],
          cookingTime: recipe.cookingTime,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
          category: recipe.category,
          tags: recipe.tags || [],
          nutrition: recipe.nutrition,
        }
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
}

/**
 * 🚫 알레르기 필터링 도구
 */
class AllergyFilterTool extends Tool {
  name = "allergy_filter_tool";
  description = "레시피 목록에서 특정 알레르기 성분을 필터링합니다. recipes(배열), allergies(배열)를 JSON으로 입력하세요.";

  async _call(input: string): Promise<string> {
    try {
      const params = JSON.parse(input);
      const recipes = params.recipes || [];
      const allergies = params.allergies || [];

      if (!Array.isArray(recipes) || !Array.isArray(allergies)) {
        return JSON.stringify({
          success: false,
          error: 'recipes와 allergies는 배열이어야 합니다.'
        });
      }

      const filteredRecipes = recipes.filter((recipe: any) => {
        const ingredients = [
          ...(recipe.ingredientsKo || []),
          ...(recipe.ingredientsEn || []),
          recipe.name || '',
          recipe.description || ''
        ].join(' ').toLowerCase();

        return !allergies.some((allergy: string) => 
          ingredients.includes(allergy.toLowerCase()) ||
          allergy.toLowerCase().includes(ingredients)
        );
      });

      return JSON.stringify({
        success: true,
        original_count: recipes.length,
        filtered_count: filteredRecipes.length,
        removed_count: recipes.length - filteredRecipes.length,
        filtered_recipes: filteredRecipes,
        removed_allergies: allergies
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `필터링 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
}

/**
 * 💡 요리 팁 도구
 */
class CookingTipsTool extends Tool {
  name = "cooking_tips_tool";
  description = "특정 요리나 상황에 대한 요리 팁을 제공합니다. topic(문자열)을 JSON으로 입력하세요.";

  async _call(input: string): Promise<string> {
    try {
      const params = JSON.parse(input);
      const topic = params.topic || params.query || '';

      // 요리 팁 데이터베이스 (실제로는 외부 API나 DB에서 가져올 수 있음)
      const tips = {
        '닭가슴살': [
          '조리 전 소금물에 30분 담가두면 부드러워집니다',
          '내부 온도 74도까지 익혀야 안전합니다',
          '마리네이드를 이용해 맛과 부드러움을 동시에!'
        ],
        '파스타': [
          '물에 소금을 넣고 끓이면 면이 더 쫄깃해집니다',
          '면수를 조금 남겨두었다가 소스와 섞으면 더 부드럽게 섞입니다',
          '알 덴테는 면 중심에 얇은 하얀 선이 보일 때입니다'
        ],
        '계란': [
          '완전히 찬 계란을 끓는 물에 넣으면 껍질이 잘 벗겨집니다',
          '삶은 계란은 찬물에 바로 담그면 노른자가 예쁘게 나옵니다',
          '신선한 계란일수록 흰자가 퍼지지 않습니다'
        ]
      };

      // 관련 팁 찾기
      const relevantTips = Object.entries(tips).filter(([key]) => 
        topic.toLowerCase().includes(key) || key.includes(topic.toLowerCase())
      );

      if (relevantTips.length === 0) {
        return JSON.stringify({
          success: true,
          topic,
          tips: ['요리할 때는 항상 위생을 우선으로 하세요', '맛을 보면서 조리하는 것이 중요합니다', '재료의 신선도가 맛을 좌우합니다'],
          note: '일반적인 요리 팁을 제공했습니다.'
        });
      }

      const allTips = relevantTips.flatMap(([, tipList]) => tipList);

      return JSON.stringify({
        success: true,
        topic,
        tips: allTips,
        categories: relevantTips.map(([category]) => category)
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `팁 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
}

/**
 * 🔄 재료 대체 도구
 */
class IngredientSubstitutionTool extends Tool {
  name = "ingredient_substitution_tool";
  description = "특정 재료의 대체재를 찾습니다. ingredient(문자열)를 JSON으로 입력하세요.";

  async _call(input: string): Promise<string> {
    try {
      const params = JSON.parse(input);
      const ingredient = params.ingredient || params.item || '';

      // 재료 대체 데이터베이스
      const substitutions = {
        '버터': ['식용유', '마가린', '코코넛오일', '아보카도오일'],
        '우유': ['두유', '아몬드밀크', '코코넛밀크', '오트밀크'],
        '달걀': ['아쿠아파바', '아마씨겔', '치아씨겔', '바나나 1/2개'],
        '밀가루': ['쌀가루', '아몬드가루', '코코넛가루', '귀리가루'],
        '설탕': ['꿀', '메이플시럽', '스테비아', '코코넛설탕'],
        '소금': ['간장', '된장', '허브솔트', '레몬즙'],
        '양파': ['대파', '마늘', '셜롯', '양파가루'],
        '마늘': ['마늘가루', '아사포에티다', '생강', '양파'],
        '생강': ['생강가루', '갈랑갈', '터메릭', '마늘'],
        '레몬': ['라임', '식초', '레몬즙', '구연산'],
      };

      const found = Object.entries(substitutions).find(([key]) => 
        ingredient.toLowerCase().includes(key) || key.includes(ingredient.toLowerCase())
      );

      if (!found) {
        return JSON.stringify({
          success: true,
          ingredient,
          substitutes: [],
          note: `${ingredient}의 직접적인 대체재 정보가 없습니다. 비슷한 맛이나 기능을 하는 재료를 찾아보세요.`
        });
      }

      const [originalIngredient, substitutes] = found;

      return JSON.stringify({
        success: true,
        ingredient: originalIngredient,
        substitutes: substitutes.map((sub, index) => ({
          name: sub,
          ratio: '1:1', // 기본 비율
          note: index === 0 ? '가장 권장되는 대체재' : ''
        })),
        tips: [`${originalIngredient} 대신 사용할 때는 소량부터 시작하세요`, '맛을 보면서 조절하는 것이 중요합니다']
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `대체재 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
}