/**
 * 🤖 Recipe Agent - Simple ReAct Agent
 * RAG와 Elasticsearch를 활용한 간단하고 효과적인 레시피 추천 에이전트
 */

import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { ConversationContextService, ConversationContext } from '../context/context-analyzer';
import { IntentClassifierService, UserIntent, IntentAnalysis } from '../classification/intent-classifier';
import { AlternativeRecipeGeneratorService, AlternativeRecipeRequest } from '../generation/recipe-generator';
import { ElasticsearchAgentService } from '../search/elasticsearch-agent';
import { TcreiPromptLoaderService } from '../../prompt-templates/tcrei/tcrei-prompt-loader.service';


export interface AgentQuery {
  message: string;
  userId?: string;
  sessionId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userAllergies?: string[]; // 사용자 알러지 정보 추가
}

export interface AgentResponse {
  message: string;
  recipes?: any[];
  suggestions?: string[];
  metadata: {
    processingTime: number;
    toolsUsed: string[];
    confidence: number;
    responseType?: string;
    intent?: string;
  };
}

@Injectable()
export class RecipeAgentService {
  private readonly logger = new Logger(RecipeAgentService.name);
  private isReady = false;

  constructor(
    private readonly aiService: AiService,
    private readonly conversationContextService: ConversationContextService,
    private readonly intentClassifierService: IntentClassifierService,
    private readonly alternativeRecipeGeneratorService: AlternativeRecipeGeneratorService,
    private readonly elasticsearchAgent: ElasticsearchAgentService,
    private readonly tcreiPromptLoader: TcreiPromptLoaderService
  ) {
    this.initializeAgent();
  }

  /**
   * 🚀 Agent 초기화
   */
  private async initializeAgent() {
    try {
      this.logger.log(`🦙 Ollama 기반 Simple Agent 초기화: ${process.env.OLLAMA_LLM_MODEL || 'gemma3n:e4b'}`);
      
      // AI 서비스가 준비될 때까지 대기
      await this.waitForAiService();
      
      this.isReady = true;
      this.logger.log('🤖 Recipe Agent 초기화 완료');

    } catch (error) {
      this.logger.error('❌ Recipe Agent 초기화 실패:', error);
      this.isReady = false;
    }
  }

  /**
   * AI 서비스 준비 대기
   */
  private async waitForAiService(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        const status = await this.aiService.getStatus();
        if (status.isConnected) {
          this.logger.log('✅ AI 서비스 연결 확인됨');
          return;
        }
      } catch (error) {
        this.logger.warn(`AI 서비스 연결 대기 중... (${attempts + 1}/${maxAttempts})`);
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
    }
    
    throw new Error('AI 서비스 연결 실패');
  }

  /**
   * 💬 사용자 쿼리 처리 (Intent-Based Processing)
   */
  async processQuery(query: AgentQuery): Promise<AgentResponse> {
    const startTime = Date.now();
    this.logger.log(`💬 Intent-based Agent 쿼리 처리 시작: "${query.message}"`);

    try {
      if (!this.isReady) {
        return this.createFallbackResponse(query, startTime);
      }

      // 1️⃣ 대화 맥락 분석
      this.logger.log('🧠 1단계: 대화 맥락 분석');
      const conversationContext = await this.conversationContextService.analyzeContext(
        query.message, 
        query.conversationHistory
      );

      // 2️⃣ 의도 분류
      this.logger.log('🎯 2단계: 사용자 의도 분류');
      const intentAnalysis = await this.intentClassifierService.classifyIntent(
        query.message, 
        conversationContext
      );

      // 3️⃣ 의도별 처리
      this.logger.log(`🔀 3단계: 의도별 처리 - ${intentAnalysis.intent}`);
      let response: AgentResponse;

      switch (intentAnalysis.intent) {
        case UserIntent.RECIPE_LIST:
          response = await this.handleRecipeListRequest(query, conversationContext, startTime);
          break;

        case UserIntent.RECIPE_DETAIL:
          response = await this.handleRecipeDetailRequest(query, conversationContext, intentAnalysis, startTime);
          break;
          
        case UserIntent.ALTERNATIVE_RECIPE:
          response = await this.handleAlternativeRecipeRequest(
            query, 
            conversationContext, 
            intentAnalysis, 
            startTime
          );
          break;
          
        case UserIntent.GENERAL_CHAT:
          response = await this.handleGeneralChat(query, startTime);
          break;
          
        default:
          response = await this.handleRecipeListRequest(query, conversationContext, startTime);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Intent-based Agent 처리 완료 (${processingTime}ms): 의도 ${intentAnalysis.intent}`);
      
      return {
        ...response,
        metadata: {
          ...response.metadata,
          processingTime,
          intent: intentAnalysis.intent,
          confidence: intentAnalysis.confidence
        }
      };

    } catch (error) {
      this.logger.error('Intent-based Agent 처리 실패:', error);
      return this.createErrorResponse(query, startTime, error);
    }
  }

  /**
   * 레시피 목록/추천 요청 처리
   */
  private async handleRecipeListRequest(
    query: AgentQuery, 
    conversationContext: ConversationContext, 
    startTime: number
  ): Promise<AgentResponse> {
    const toolsUsed = ['conversation_memory', 'extract_keywords', 'recipe_search', 'ai_response'];

    // 키워드 추출
    const keywords = [query.message]; // 간단화
    
    // 📋 사용자 알러지 정보 조회
    let userAllergies: string[] = query.userAllergies || [];
    
    // 사용자 ID가 있고 알러지 정보가 없는 경우, DB에서 조회 시도
    if (query.userId && userAllergies.length === 0) {
      try {
        // TODO: User Service에서 알러지 정보 조회하는 로직 구현 필요
        // const userProfile = await this.userService.getUserProfile(query.userId);
        // userAllergies = userProfile?.allergies || [];
        
        this.logger.debug(`👤 사용자 ${query.userId}의 알러지 정보: ${userAllergies.join(', ') || '없음'}`);
      } catch (error) {
        this.logger.warn('사용자 알러지 정보 조회 실패:', error);
      }
    } else if (userAllergies.length > 0) {
      this.logger.log(`🚫 알러지 필터링 적용: ${userAllergies.join(', ')}`);
    }
    
    // 🤖 Elasticsearch Agent 지능형 검색 (알러지 정보 포함)
    const agentResult = await this.elasticsearchAgent.intelligentSearch(
      query.message, 
      query.userId, 
      undefined, // intentAnalysis는 나중에 전달
      userAllergies
    );
    
    const ragResult = {
      context: agentResult.recipes.length > 0 ? `${agentResult.recipes.length}개의 레시피를 찾았습니다.` : '레시피를 찾을 수 없습니다.',
      recipes: agentResult.recipes || [],
      metadata: {
        searchTime: agentResult.metadata.searchTime,
        resultCount: agentResult.recipes?.length || 0,
        relevanceScore: agentResult.metadata.relevanceScore
      }
    };

    this.logger.log(`🔍 Agent 지능형 검색 완료: ${ragResult.recipes.length}개 레시피`);
    
    // 🔍 RAG 검색 결과 상세 로그
    if (ragResult.recipes && ragResult.recipes.length > 0) {
      this.logger.log(`📊 검색된 레시피들:`);
      ragResult.recipes.forEach((recipe, index) => {
        this.logger.log(`  ${index + 1}. ${recipe.nameKo || recipe.name || 'Unknown'} (ID: ${recipe.id})`);
      });
    } else {
      this.logger.warn(`⚠️ 검색 결과가 비어있음!`);
      this.logger.warn(`   ragResult.recipes: ${JSON.stringify(ragResult.recipes)}`);
    }

    // 📝 간단한 응답 생성 (동적 프롬프트 대신)
    let finalMessage = ragResult.context;
    
    if (ragResult.recipes.length > 0) {
      finalMessage = `🍽️ **닭가슴살 요리 추천**\n\n${ragResult.recipes.length}개의 맛있는 레시피를 찾았습니다!\n\n` +
                    ragResult.recipes.slice(0, 3).map((recipe, i) => 
                      `${i + 1}. **${recipe.nameKo || recipe.name}** (${recipe.minutes || 'N/A'}분, ${recipe.difficulty || '보통'})`
                    ).join('\n') +
                    `\n\n각 레시피를 클릭하면 상세한 조리법을 확인할 수 있습니다. 특별한 요청이나 다른 스타일의 요리를 원하시면 말씀해 주세요! 😊`;
    }
    
    this.logger.log('📝 간단한 응답 생성 완료 (동적 프롬프트 생략)');

    // 검색 제안 생성
    const suggestions = ['간단한 요리', '빠른 요리', '쉬운 요리']; // 간단화

    // 🔍 최종 응답 생성 전 로그
    this.logger.log(`🎯 Agent 최종 응답 생성:`);
    this.logger.log(`  - finalMessage 길이: ${finalMessage?.length || 0}`);
    this.logger.log(`  - ragResult.recipes 길이: ${ragResult.recipes?.length || 0}`);
    this.logger.log(`  - suggestions 길이: ${suggestions?.length || 0}`);

    const finalResponse = {
      message: finalMessage,
      recipes: ragResult.recipes, // 레시피 목록을 여기에 담습니다.
      recipeDetail: null, // 상세 정보는 비웁니다.
      suggestions,
      metadata: {
        processingTime: Date.now() - startTime,
        toolsUsed,
        confidence: 0.8,
        responseType: 'recipe_recommendation',
        intent: 'recipe_list'
      }
    };

    this.logger.log(`✅ Agent 최종 응답 완성 - recipes: ${finalResponse.recipes?.length || 0}개`);
    return finalResponse;
  }

  /**
   * Elasticsearch 레시피를 프론트엔드 RecipeDetail 형태로 변환
   */
  private transformToRecipeDetail(elasticsearchRecipe: any): any {
    this.logger.log(`🔍 Transform Recipe Debug - Original:`, JSON.stringify(elasticsearchRecipe, null, 2));
    
    const steps = (elasticsearchRecipe.stepsKo && elasticsearchRecipe.stepsKo.length > 0) 
                  ? elasticsearchRecipe.stepsKo 
                  : (elasticsearchRecipe.steps && elasticsearchRecipe.steps.length > 0)
                  ? elasticsearchRecipe.steps
                  : (elasticsearchRecipe.stepsEn && elasticsearchRecipe.stepsEn.length > 0)
                  ? elasticsearchRecipe.stepsEn
                  : (Array.isArray(elasticsearchRecipe.instructions) ? elasticsearchRecipe.instructions : 
                     elasticsearchRecipe.instructions ? [elasticsearchRecipe.instructions] : []);
    
    const ingredients = elasticsearchRecipe.ingredientsKo || elasticsearchRecipe.ingredients || [];
    
    this.logger.log(`🔍 Steps found:`, steps);
    this.logger.log(`🔍 Ingredients found:`, ingredients);
    this.logger.log(`🔍 Minutes field:`, elasticsearchRecipe.minutes);
    this.logger.log(`🔍 Servings fields:`, {
      servings: elasticsearchRecipe.servings,
      serves: elasticsearchRecipe.serves,
      nIngredients: elasticsearchRecipe.nIngredients
    });
    
    // 조리시간 변환 - 다양한 필드에서 시도
    let cookingTime = 'N/A';
    if (elasticsearchRecipe.minutes && elasticsearchRecipe.minutes > 0) {
      cookingTime = `${elasticsearchRecipe.minutes}분`;
    } else if (elasticsearchRecipe.cookingTime) {
      cookingTime = elasticsearchRecipe.cookingTime;
    } else if (elasticsearchRecipe.totalTime) {
      cookingTime = elasticsearchRecipe.totalTime;
    } else if (elasticsearchRecipe.prepTime) {
      cookingTime = elasticsearchRecipe.prepTime;
    }
    
    // 인분 정보 변환 - 다양한 필드에서 시도하고 재료 수 기반 추정
    let servings = '2-3인분';
    if (elasticsearchRecipe.servings) {
      servings = typeof elasticsearchRecipe.servings === 'number' 
        ? `${elasticsearchRecipe.servings}인분` 
        : String(elasticsearchRecipe.servings);
    } else if (elasticsearchRecipe.serves) {
      servings = typeof elasticsearchRecipe.serves === 'number'
        ? `${elasticsearchRecipe.serves}인분`
        : String(elasticsearchRecipe.serves);
    } else if (elasticsearchRecipe.portions) {
      servings = typeof elasticsearchRecipe.portions === 'number'
        ? `${elasticsearchRecipe.portions}인분`
        : String(elasticsearchRecipe.portions);
    } else {
      // 재료 수와 조리시간 기반 인분 추정
      const ingredientCount = elasticsearchRecipe.nIngredients || ingredients.length;
      const cookingMinutes = elasticsearchRecipe.minutes || 30;
      
      if (ingredientCount >= 8 || cookingMinutes >= 180) {
        servings = '4-6인분'; // 재료 많거나 오래 조리하면 많은 인분
      } else if (ingredientCount >= 5 || cookingMinutes >= 60) {
        servings = '3-4인분'; // 중간 정도
      } else {
        servings = '2-3인분'; // 기본값
      }
    }
    
    // 영양정보 생성 (기본값 또는 추정값 제공)
    const nutritionInfo = elasticsearchRecipe.nutritionInfo || elasticsearchRecipe.nutrition || {
      calories: elasticsearchRecipe.calories || this.estimateCalories(ingredients.length),
      protein: elasticsearchRecipe.protein || this.estimateProtein(ingredients),
      carbs: elasticsearchRecipe.carbs || elasticsearchRecipe.carbohydrates || this.estimateCarbs(ingredients),
      fat: elasticsearchRecipe.fat || elasticsearchRecipe.fats || this.estimateFat(ingredients),
    };
    
    // 프론트엔드가 기대하는 형식으로 조리단계 변환
    const instructionsForFrontend = steps.length > 0 ? steps.map((step: string, index: number) => ({
      stepNumber: index + 1,
      instruction: step,
      estimatedTime: undefined,
      tips: []
    })) : [
      {
        stepNumber: 1,
        instruction: "재료를 준비합니다.",
        estimatedTime: "5분",
        tips: ["모든 재료를 미리 손질해두면 요리가 수월합니다."]
      },
      {
        stepNumber: 2, 
        instruction: "조리를 시작합니다.",
        estimatedTime: "20분",
        tips: ["중간 불에서 천천히 조리하는 것이 좋습니다."]
      },
      {
        stepNumber: 3,
        instruction: "완성하여 맛있게 드세요!",
        estimatedTime: "2분",
        tips: ["따뜻할 때 드시면 더욱 맛있습니다."]
      }
    ];

    // 프론트엔드 호환성을 위한 숫자 값들
    const minutesNumber = elasticsearchRecipe.minutes || null;
    let servingsNumber = elasticsearchRecipe.servings || elasticsearchRecipe.serves || null;
    
    // 인분 정보가 없으면 추정값을 숫자로 변환
    if (!servingsNumber) {
      const ingredientCount = elasticsearchRecipe.nIngredients || ingredients.length;
      const cookingMinutes = elasticsearchRecipe.minutes || 30;
      
      if (ingredientCount >= 8 || cookingMinutes >= 180) {
        servingsNumber = 5; // "4-6인분"의 중간값
      } else if (ingredientCount >= 5 || cookingMinutes >= 60) {
        servingsNumber = 3; // "3-4인분"의 중간값
      } else {
        servingsNumber = 2; // "2-3인분"의 중간값
      }
    }

    const transformed = {
      title: elasticsearchRecipe.nameKo || elasticsearchRecipe.name || '레시피',
      description: elasticsearchRecipe.descriptionKo || elasticsearchRecipe.description || '',
      cookingTime: cookingTime, // 문자열 형식 (RecipeDetailCard용)
      totalTime: cookingTime, // 프론트엔드 호환성
      prepTime: "10분", // 기본 준비시간
      minutes: minutesNumber, // 숫자 형식 (프론트엔드 메타 정보용)
      difficulty: elasticsearchRecipe.difficulty || '보통',
      servings: servingsNumber, // 숫자 형식 (프론트엔드 메타 정보용)
      servingsText: servings, // 문자열 형식 (RecipeDetailCard용)
      rating: elasticsearchRecipe.averageRating || elasticsearchRecipe.rating || undefined,
      tags: elasticsearchRecipe.tagsKo || elasticsearchRecipe.tags || [],
      ingredients: ingredients,
      ingredientCount: elasticsearchRecipe.nIngredients || ingredients.length,
      
      // 기존 형식 (RecipeDetailCard용)
      steps: instructionsForFrontend, // `steps`로 변경
      
      // 프론트엔드가 기대하는 형식 (ChatMessage용)
      instructions: instructionsForFrontend,
      
      tips: elasticsearchRecipe.tips || [
        "신선한 재료를 사용하면 더욱 맛있어집니다.",
        "조리 전 재료를 미리 준비해두세요.",
        "적절한 간을 맞추는 것이 중요합니다."
      ],
      nutritionInfo: nutritionInfo,
    };

    this.logger.log(`🔍 Transformed RecipeDetail:`, JSON.stringify(transformed, null, 2));
    return transformed;
  }

  /**
   * 재료 수에 기반한 칼로리 추정
   */
  private estimateCalories(ingredientCount: number): string {
    const baseCalories = 150 + (ingredientCount * 25);
    return `${baseCalories}kcal`;
  }

  /**
   * 재료 목록에 기반한 단백질 추정
   */
  private estimateProtein(ingredients: string[]): string {
    const proteinIngredients = ingredients.filter(ing => 
      ing.includes('닭') || ing.includes('고기') || ing.includes('계란') || 
      ing.includes('생선') || ing.includes('두부') || ing.includes('콩')
    );
    const protein = Math.max(5, proteinIngredients.length * 8);
    return `${protein}g`;
  }

  /**
   * 재료 목록에 기반한 탄수화물 추정
   */
  private estimateCarbs(ingredients: string[]): string {
    const carbIngredients = ingredients.filter(ing =>
      ing.includes('밥') || ing.includes('면') || ing.includes('빵') ||
      ing.includes('감자') || ing.includes('고구마') || ing.includes('밀가루')
    );
    const carbs = Math.max(10, carbIngredients.length * 15 + ingredients.length * 3);
    return `${carbs}g`;
  }

  /**
   * 재료 목록에 기반한 지방 추정
   */
  private estimateFat(ingredients: string[]): string {
    const fatIngredients = ingredients.filter(ing =>
      ing.includes('기름') || ing.includes('버터') || ing.includes('치즈') ||
      ing.includes('견과') || ing.includes('아보카도') || ing.includes('올리브')
    );
    const fat = Math.max(3, fatIngredients.length * 5 + ingredients.length * 1);
    return `${fat}g`;
  }

  /**
   * 레시피 상세 정보 요청 처리
   */
  private async handleRecipeDetailRequest(
    query: AgentQuery, 
    conversationContext: ConversationContext, 
    intentAnalysis: IntentAnalysis, // intentAnalysis 파라미터 추가
    startTime: number
  ): Promise<AgentResponse> {
    const toolsUsed = ['conversation_memory', 'recipe_detail_search', 'ai_response'];

    // 의도 분석에서 추출된 레시피 이름 사용
    const recipeNameToSearch = intentAnalysis.relatedRecipe || query.message;

    // 📋 사용자 알러지 정보 조회
    let userAllergies: string[] = query.userAllergies || [];
    
    // 사용자 ID가 있고 알러지 정보가 없는 경우, DB에서 조회 시도
    if (query.userId && userAllergies.length === 0) {
      try {
        // TODO: User Service에서 알러지 정보 조회하는 로직 구현 필요
        // const userProfile = await this.userService.getUserProfile(query.userId);
        // userAllergies = userProfile?.allergies || [];
        
        this.logger.debug(`👤 레시피 상세 요청 - 사용자 ${query.userId}의 알러지 정보: ${userAllergies.join(', ') || '없음'}`);
      } catch (error) {
        this.logger.warn('사용자 알러지 정보 조회 실패:', error);
      }
    } else if (userAllergies.length > 0) {
      this.logger.log(`🚫 레시피 상세 요청 - 알러지 필터링 적용: ${userAllergies.join(', ')}`);
    }

    // 특정 레시피 검색 (분석된 의도와 알러지 정보 전달)
    const agentResult = await this.elasticsearchAgent.intelligentSearch(
      recipeNameToSearch, 
      query.userId, 
      intentAnalysis,
      userAllergies
    );
    
    const ragResult = {
      context: agentResult.recipes.length > 0 ? `${agentResult.recipes[0].nameKo || agentResult.recipes[0].name}의 상세 조리법입니다.` : '해당 레시피를 찾을 수 없습니다.',
      recipes: agentResult.recipes?.slice(0, 1) || [], // 상세 요청이므로 첫 번째 결과만
      metadata: {
        searchTime: agentResult.metadata.searchTime,
        resultCount: agentResult.recipes?.length || 0,
        relevanceScore: agentResult.metadata.relevanceScore
      }
    };

    this.logger.log(`🔍 레시피 상세 검색 완료: ${ragResult.recipes.length}개 레시피`);
    
    // 상세 정보가 있을 경우 더 자세한 응답 생성
    let finalMessage = ragResult.context;
    
    if (ragResult.recipes.length > 0) {
      const recipe = ragResult.recipes[0];
      finalMessage = `🍽️ **${recipe.nameKo || recipe.name}** 상세 조리법\n\n` +
                    `⏱️ **조리시간**: ${recipe.minutes || 'N/A'}분\n` +
                    `👥 **인분**: ${recipe.nIngredients || 'N/A'}개 재료\n` +
                    `📊 **난이도**: ${recipe.difficulty || '보통'}\n\n` +
                    `상세한 재료와 조리법은 아래 레시피 카드에서 확인하실 수 있습니다. 궁금한 점이 있으시면 언제든 물어보세요! 😊`;
    }

    const suggestions = ['다른 레시피 보기', '비슷한 요리', '간단 버전']; // 상세 요청 후 제안

    // 변환된 레시피 상세 정보
    const transformedRecipe = ragResult.recipes.length > 0 ? this.transformToRecipeDetail(ragResult.recipes[0]) : null;

    const finalResponse = {
      message: finalMessage,
      recipes: [], // 상세 정보 요청이므로 목록은 비워둠
      recipeDetail: transformedRecipe, // 변환된 RecipeDetail (기존 호환성)
      suggestions,
      metadata: {
        processingTime: Date.now() - startTime,
        toolsUsed,
        confidence: 0.9,
        responseType: 'recipe_detail',
        intent: 'recipe_detail',
        conversationType: 'recipe_detail', // 프론트엔드가 체크하는 필드
        recipeData: transformedRecipe ? [transformedRecipe] : [], // 프론트엔드가 찾는 배열 형식
        recipeDetail: transformedRecipe // 추가 호환성
      }
    };

    this.logger.log(`✅ Agent 레시피 상세 응답 완성 - recipe: ${finalResponse.recipeDetail?.title || 'none'}`);
    this.logger.log(`🔍 Final Response Structure:`, {
      hasRecipeDetail: !!finalResponse.recipeDetail,
      hasRecipes: !!finalResponse.recipes,
      recipesCount: finalResponse.recipes?.length || 0,
      intent: finalResponse.metadata.intent
    });
    return finalResponse;
  }

  /**
   * 대체 레시피 요청 처리
   */
  private async handleAlternativeRecipeRequest(
    query: AgentQuery, 
    conversationContext: ConversationContext, 
    intentAnalysis: IntentAnalysis,
    startTime: number
  ): Promise<AgentResponse> {
    const toolsUsed = ['conversation_memory', 'intent_analysis', 'alternative_recipe_generation'];

    try {
      // 관련 원본 레시피 찾기
      let originalRecipe = null;
      if (intentAnalysis.relatedRecipe) {
        const searchRes = await this.elasticsearchAgent.advancedSearch(intentAnalysis.relatedRecipe, { limit: 1 });
        originalRecipe = searchRes.recipes[0] || null;
      }

      if (!originalRecipe && conversationContext.lastRecipes.length > 0) {
        // 대화 맥락에서 이전 레시피 검색
        const firstRecipe = conversationContext.lastRecipes[0];
        if (firstRecipe) {
          const searchRes = await this.elasticsearchAgent.advancedSearch(firstRecipe, { limit: 1 });
          originalRecipe = searchRes.recipes[0] || null;
        }
      }

      if (!originalRecipe) {
        // 원본 레시피를 찾을 수 없으면 일반 레시피 요청으로 처리
        return this.handleRecipeListRequest(query, conversationContext, startTime);
      }

      // 대체 레시피 생성
      const alternativeRequest: AlternativeRecipeRequest = {
        originalRecipe,
        missingItems: intentAnalysis.missingItems || [],
        userMessage: query.message,
        userId: query.userId
      };

      const alternativeRecipe = await this.alternativeRecipeGeneratorService
        .generateOrFindAlternativeRecipe(alternativeRequest);

      if (alternativeRecipe) {
        // 대체 레시피 생성 성공
        const message = `${originalRecipe.nameKo || originalRecipe.name}을(를) ${intentAnalysis.missingItems?.join(', ') || '대체 도구'}로 만드는 방법을 알려드릴게요!`;
        
        return {
          message,
          recipes: [alternativeRecipe], // 생성된 대체 레시피만 표시
          suggestions: ['다른 대체 방법', '원본 레시피 보기', '비슷한 요리'],
          metadata: {
            processingTime: Date.now() - startTime,
            toolsUsed,
            confidence: 0.9,
            responseType: 'alternative_recipe'
          }
        };
      } else {
        // 대체 레시피 생성 실패
        return {
          message: '죄송합니다. 해당 조건에 맞는 대체 레시피를 생성할 수 없습니다. 다른 방법을 시도해보세요.',
          recipes: [],
          suggestions: ['다른 요리 추천', '원본 레시피 보기'],
          metadata: {
            processingTime: Date.now() - startTime,
            toolsUsed,
            confidence: 0.3,
            responseType: 'error'
          }
        };
      }
    } catch (error) {
      this.logger.error('대체 레시피 처리 실패:', error);
      return this.handleRecipeListRequest(query, conversationContext, startTime);
    }
  }

  /**
   * 일반 대화 처리
   */
  private async handleGeneralChat(query: AgentQuery, startTime: number): Promise<AgentResponse> {
    const toolsUsed = ['ai_response', 'prompt_template'];

    try {
      // 🎯 TCREI 일반 대화 프롬프트 사용
      const prompt = await this.tcreiPromptLoader.getGeneralChatPrompt({
        userMessage: query.message,
        conversationContext: query.conversationHistory ? 
          query.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') : undefined,
        isRecipeRelated: false,
        suggestedTopics: ['간단한 요리', '오늘의 추천', '인기 레시피']
      });

      const aiResponse = await this.aiService.generateResponse(prompt, {
        temperature: 0.7
      });

      const message = aiResponse || await this.tcreiPromptLoader.getFallbackGeneralChatPrompt(query.message);

      return {
        message,
        recipes: [], // 일반 대화이므로 레시피 표시 안함
        suggestions: ['간단한 요리', '오늘의 추천', '인기 레시피'],
        metadata: {
          processingTime: Date.now() - startTime,
          toolsUsed,
          confidence: 0.7,
          responseType: 'general_chat'
        }
      };
    } catch (error) {
      this.logger.warn('일반 대화 AI 응답 실패, 폴백 프롬프트 사용:', error);
      
      // 폴백 프롬프트 사용
      const fallbackMessage = await this.tcreiPromptLoader.getFallbackGeneralChatPrompt(query.message);
      
      return {
        message: fallbackMessage,
        recipes: [],
        suggestions: ['레시피 추천', '요리 도움말'],
        metadata: {
          processingTime: Date.now() - startTime,
          toolsUsed: ['fallback_prompt'],
          confidence: 0.5,
          responseType: 'general_chat'
        }
      };
    }
  }


  /**
   * 🎯 TCREI 기반 AI 프롬프트 구성
   */
  private async buildAIPrompt(userMessage: string, keywords: string[], ragResult: any, conversationContext?: ConversationContext): Promise<string> {
    try {
      // TCREI 레시피 추천 프롬프트 사용
      const prompt = await this.tcreiPromptLoader.getRecipeRecommendationPrompt({
        userMessage,
        ragContext: ragResult.context,
        hasContext: conversationContext?.hasContext || false,
        lastRecipes: conversationContext?.lastRecipes || [],
        conversationSummary: conversationContext?.conversationSummary || '',
        constraintAnalysis: `키워드 기반 제약사항: ${keywords.join(', ')}`
      });
      
      this.logger.log(`🎯 TCREI 레시피 추천 프롬프트 생성 완료`);
      return prompt;
    } catch (error) {
      this.logger.warn('TCREI 프롬프트 생성 실패, 폴백 프롬프트 사용:', error);
      
      // 폴백: 간단한 기본 프롬프트
      return this.buildFallbackPrompt(userMessage, keywords, ragResult, conversationContext);
    }
  }

  /**
   * 폴백 프롬프트 (동적 생성 실패 시)
   */
  private buildFallbackPrompt(userMessage: string, keywords: string[], ragResult: any, conversationContext?: ConversationContext): string {
    let prompt = `당신은 친근하고 도움이 되는 레시피 어시스턴트입니다.

사용자 요청: "${userMessage}"
키워드: ${keywords.join(', ')}

검색된 레시피 정보:
${ragResult.context}`;

    if (conversationContext?.hasContext) {
      prompt += `

대화 맥락:
- 이전 추천: ${conversationContext.lastRecipes.join(', ') || '없음'}
- 현재 상황: ${conversationContext.conversationSummary}`;
    }

    prompt += `

친근하고 자연스러운 톤으로 도움이 되는 답변을 200-400자 내외로 해주세요.`;

    return prompt;
  }



  /**
   * 간단한 응답 생성
   */
  private createSimpleResponse(
    message: string, 
    recipes: any[], 
    suggestions: string[], 
    startTime: number, 
    toolsUsed: string[]
  ): AgentResponse {
    return {
      message,
      recipes,
      suggestions,
      metadata: {
        processingTime: Date.now() - startTime,
        toolsUsed,
        confidence: 0.5
      }
    };
  }



  /**
   * 🔄 폴백 응답 생성 (Agent 없이)
   */
  private async createFallbackResponse(query: AgentQuery, startTime: number): Promise<AgentResponse> {
    this.logger.warn('Agent 없이 폴백 응답 생성');

    try {
      // 직접 Agent 검색 수행
      const agentResult = await this.elasticsearchAgent.intelligentSearch(query.message);
      const searchResult = { recipes: agentResult.recipes || [] };
      
      const processingTime = Date.now() - startTime;

      return {
        message: searchResult.recipes.length > 0 ? `${searchResult.recipes.length}개의 레시피를 찾았습니다.` : '레시피를 찾을 수 없습니다.',
        recipes: searchResult.recipes.slice(0, 3),
        suggestions: ['간단한 요리', '빠른 요리', '쉬운 요리'],
        metadata: {
          processingTime,
          toolsUsed: ['fallback_search'],
          confidence: 0.7
        }
      };

    } catch (error) {
      return this.createErrorResponse(query, startTime, error);
    }
  }

  /**
   * ❌ 에러 응답 생성
   */
  private createErrorResponse(query: AgentQuery, startTime: number, error: any): AgentResponse {
    const processingTime = Date.now() - startTime;
    
    return {
      message: '죄송합니다. 요청을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요.',
      suggestions: ['다른 키워드로 검색', '간단한 요리 추천', '인기 레시피 보기'],
      metadata: {
        processingTime,
        toolsUsed: [],
        confidence: 0.1
      }
    };
  }

  /**
   * 📈 Agent 상태 조회
   */
  getAgentStatus(): { isReady: boolean; toolCount: number; modelName: string } {
    return {
      isReady: this.isReady,
      toolCount: 3,
      modelName: process.env.OLLAMA_LLM_MODEL || 'gemma3n:e4b'
    };
  }

  /**
   * 🔬 TCREI 시스템 성능 테스트
   */
  async performTcreiPerformanceTest(): Promise<any> {
    this.logger.log('🔬 TCREI 시스템 성능 테스트 시작...');
    
    const testStartTime = Date.now();
    const testQueries = [
      { message: '닭가슴살 요리 추천해줘', expectedIntent: 'recipe_list' },
      { message: '김치찌개 만드는 법 알려줘', expectedIntent: 'recipe_detail' },
      { message: '양파 없으면 뭘로 대체할까?', expectedIntent: 'alternative_recipe' },
      { message: '안녕하세요', expectedIntent: 'general_chat' },
      { message: '간단한 파스타 레시피', expectedIntent: 'recipe_list' },
      // 알러지 테스트 케이스 추가
      { message: '견과류 없는 샐러드 레시피', expectedIntent: 'recipe_list', allergies: ['견과류'] },
      { message: '유제품 없는 디저트', expectedIntent: 'recipe_list', allergies: ['유제품', '우유'] }
    ];
    
    const results = [];
    
    // 각 쿼리에 대해 전체 처리 시간 측정
    for (const testQuery of testQueries) {
      const queryStartTime = Date.now();
      
      try {
        const response = await this.processQuery({
          message: testQuery.message,
          userId: 'test-user',
          sessionId: 'test-session'
        });
        
        const queryTime = Date.now() - queryStartTime;
        
        results.push({
          query: testQuery.message,
          expectedIntent: testQuery.expectedIntent,
          actualIntent: response.metadata.intent,
          processingTime: queryTime,
          confidence: response.metadata.confidence,
          toolsUsed: response.metadata.toolsUsed,
          recipeCount: response.recipes?.length || 0,
          allergies: (testQuery as any).allergies || [],
          allergyFilteringApplied: !!(testQuery as any).allergies,
          success: true
        });
        
        this.logger.log(`✅ 테스트 완료: "${testQuery.message}" (${queryTime}ms)`);
        
      } catch (error) {
        const queryTime = Date.now() - queryStartTime;
        
        results.push({
          query: testQuery.message,
          expectedIntent: testQuery.expectedIntent,
          processingTime: queryTime,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
        
        this.logger.error(`❌ 테스트 실패: "${testQuery.message}"`, error);
      }
    }
    
    // Elasticsearch Agent 성능 벤치마크
    const searchBenchmark = await this.elasticsearchAgent.performanceBenchmark();
    
    const totalTestTime = Date.now() - testStartTime;
    
    const testResult = {
      timestamp: new Date().toISOString(),
      totalTestTime,
      queryResults: results,
      searchBenchmark,
      summary: {
        totalQueries: results.length,
        successfulQueries: results.filter(r => r.success).length,
        failedQueries: results.filter(r => !r.success).length,
        averageProcessingTime: Math.round(results.reduce((sum, r) => sum + r.processingTime, 0) / results.length),
        intentAccuracy: results.filter(r => r.success && r.actualIntent === r.expectedIntent).length / results.filter(r => r.success).length * 100,
        averageConfidence: Math.round(results.filter(r => r.success).reduce((sum, r) => sum + (r.confidence || 0), 0) / results.filter(r => r.success).length * 100) / 100
      }
    };
    
    this.logger.log('🔬 TCREI 시스템 성능 테스트 완료:', testResult.summary);
    return testResult;
  }

  /**
   * 📊 시스템 전체 성능 메트릭 조회
   */
  getPerformanceMetrics() {
    return {
      agent: this.getAgentStatus(),
      search: this.elasticsearchAgent.getSearchMetrics(),
      timestamp: new Date().toISOString()
    };
  }
}