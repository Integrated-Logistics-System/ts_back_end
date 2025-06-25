import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from '../ollama/ollama.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { AllergenService } from '../allergen/allergen.service';

export interface RAGRecipeRequest {
  query: string;
  userAllergies?: string[];
  preferences?: string[];
  maxRecipes?: number;
}

export interface RAGRecipeResponse {
  aiResponse: string;
  sourceRecipes: Array<{
    recipe: any;
    allergyInfo: {
      isSafe: boolean;
      warnings: string[];
      riskyIngredients: string[];
    };
  }>;
  searchMetadata: {
    totalFound: number;
    safeRecipes: number;
    filteredOut: number;
  };
}

@Injectable()
export class LangchainService {
  private readonly logger = new Logger(LangchainService.name);

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly redisService: RedisService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly allergenService: AllergenService,
  ) {
    this.logger.log('🚀 LangchainService initialized');
  }

  // ================== 메인 RAG 메서드 ==================

  /**
   * 완전한 RAG 기반 레시피 검색
   */
  async searchRecipesWithAI(request: RAGRecipeRequest): Promise<RAGRecipeResponse> {
    try {
      this.logger.log(`🔍 RAG Search: "${request.query}" | Allergies: ${request.userAllergies?.join(', ') || 'none'}`);

      // 1. RETRIEVAL: 레시피 검색
      const translatedQuery = await this.translateQuery(request.query);
      const rawRecipes = await this.searchRecipes(translatedQuery, request.maxRecipes || 10);

      // 2. RETRIEVAL: 알레르기 필터링
      const filteredRecipes = await this.filterRecipesBySafety(rawRecipes, request.userAllergies || []);

      // 3. AUGMENTED: 컨텍스트 구성
      const context = this.buildContext(filteredRecipes, request);

      // 4. GENERATION: AI 응답 생성
      const aiResponse = await this.generateResponse(request.query, context, request.userAllergies);

      return {
        aiResponse,
        sourceRecipes: filteredRecipes,
        searchMetadata: {
          totalFound: rawRecipes.length,
          safeRecipes: filteredRecipes.length,
          filteredOut: rawRecipes.length - filteredRecipes.length
        }
      };

    } catch (error) {
      this.logger.error('RAG search failed:', error);
      return this.getErrorResponse();
    }
  }

  /**
   * 대화형 메모리 기반 처리
   */
  async processWithMemory(userId: string, message: string): Promise<string> {
    try {
      this.logger.log(`💬 Processing message for user ${userId}: ${message}`);

      // 레시피 요청인지 확인
      if (this.isRecipeRequest(message)) {
        return await this.handleRecipeRequest(userId, message);
      }

      // 일반 대화 처리
      return await this.handleGeneralChat(userId, message);

    } catch (error) {
      this.logger.error(`Processing error for user ${userId}:`, error);
      return this.getFallbackResponse(message);
    }
  }

  // ================== 번역 및 검색 ==================

  /**
   * 한국어 → 영어 번역
   */
  private async translateQuery(koreanQuery: string): Promise<string> {
    try {
      const prompt = `Translate this Korean recipe search query to English. Keep it simple and focused on ingredients and cooking methods.

Korean: "${koreanQuery}"
English:`;

      const translation = await this.ollamaService.generateResponse(prompt);
      const cleaned = this.cleanTranslation(translation);

      this.logger.log(`🌐 Translation: "${koreanQuery}" → "${cleaned}"`);
      return cleaned;

    } catch (error) {
      this.logger.warn('Translation failed, using fallback:', error.message);
      return this.fallbackTranslation(koreanQuery);
    }
  }

  /**
   * 레시피 검색
   */
  private async searchRecipes(query: string, limit: number): Promise<any[]> {
    try {
      const recipes = await this.elasticsearchService.searchRecipes(query, {}, limit * 2);
      this.logger.log(`📚 Found ${recipes.length} recipes for: "${query}"`);
      return recipes;
    } catch (error) {
      this.logger.warn('Recipe search failed:', error.message);
      return this.getMockRecipes(query);
    }
  }

  /**
   * 알레르기 기반 레시피 필터링
   */
  private async filterRecipesBySafety(
    recipes: any[],
    userAllergies: string[]
  ): Promise<Array<{
    recipe: any;
    allergyInfo: {
      isSafe: boolean;
      warnings: string[];
      riskyIngredients: string[];
    };
  }>> {
    const results = [];

    for (const recipe of recipes) {
      try {
        const ingredients = this.extractIngredients(recipe);

        if (userAllergies.length === 0) {
          // 알레르기 없으면 모든 레시피 안전
          results.push({
            recipe,
            allergyInfo: {
              isSafe: true,
              warnings: [],
              riskyIngredients: []
            }
          });
        } else {
          // 알레르기 체크
          const allergyCheck = await this.allergenService.checkRecipeAgainstAllergies(
            ingredients,
            userAllergies
          );

          results.push({
            recipe,
            allergyInfo: {
              isSafe: allergyCheck.isSafe,
              warnings: allergyCheck.warnings,
              riskyIngredients: allergyCheck.conflicts.map(c => c.ingredient)
            }
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to check recipe safety: ${error.message}`);
        // 에러 시 안전하지 않은 것으로 처리
        results.push({
          recipe,
          allergyInfo: {
            isSafe: false,
            warnings: ['알레르기 검사 실패'],
            riskyIngredients: []
          }
        });
      }
    }

    // 안전한 레시피 우선 정렬
    return results.sort((a, b) => {
      if (a.allergyInfo.isSafe && !b.allergyInfo.isSafe) return -1;
      if (!a.allergyInfo.isSafe && b.allergyInfo.isSafe) return 1;
      return 0;
    });
  }

  // ================== AI 응답 생성 ==================

  /**
   * 컨텍스트 구성
   */
  private buildContext(
    safeRecipes: Array<{ recipe: any; allergyInfo: any }>,
    request: RAGRecipeRequest
  ): string {
    if (safeRecipes.length === 0) {
      return `사용자가 "${request.query}"를 요청했지만 조건에 맞는 안전한 레시피를 찾을 수 없었습니다.`;
    }

    let context = `사용자 요청: "${request.query}"\n`;

    if (request.userAllergies && request.userAllergies.length > 0) {
      context += `알레르기 제한: ${request.userAllergies.join(', ')}\n`;
    }

    context += `\n추천 가능한 레시피 (${safeRecipes.length}개):\n\n`;

    safeRecipes.slice(0, 5).forEach((result, index) => {
      const recipe = result.recipe;
      context += `${index + 1}. ${recipe.name || recipe.name_ko || '레시피'}\n`;

      if (recipe.description) {
        context += `   - ${recipe.description}\n`;
      }

      if (recipe.minutes) {
        context += `   - 조리시간: ${recipe.minutes}분\n`;
      }

      const ingredients = this.extractIngredients(recipe);
      if (ingredients.length > 0) {
        context += `   - 주재료: ${ingredients.slice(0, 3).join(', ')}\n`;
      }

      context += '\n';
    });

    return context;
  }

  /**
   * AI 응답 생성
   */
  private async generateResponse(
    userQuery: string,
    context: string,
    userAllergies?: string[]
  ): Promise<string> {
    const allergyNote = userAllergies && userAllergies.length > 0
      ? `\n중요: 사용자는 ${userAllergies.join(', ')} 알레르기가 있으므로 이를 반드시 고려하여 안전한 레시피만 추천하세요.`
      : '';

    const prompt = `당신은 친근하고 전문적인 AI 요리사입니다. 사용자의 요청에 맞는 레시피를 추천해주세요.${allergyNote}

${context}

사용자 질문: "${userQuery}"

다음 가이드라인을 따라 응답하세요:
1. 친근하고 도움이 되는 톤 사용
2. 추천 레시피 2-3개를 구체적으로 소개
3. 조리 시간과 특징 언급
4. 알레르기가 있다면 안전성 강조
5. 한국어로 자연스럽게 작성

응답:`;

    try {
      const response = await this.ollamaService.generateResponse(prompt);
      return response || this.getFallbackRecipeResponse(context, userAllergies);
    } catch (error) {
      this.logger.warn('AI response generation failed:', error.message);
      return this.getFallbackRecipeResponse(context, userAllergies);
    }
  }

  // ================== 대화형 처리 ==================

  /**
   * 레시피 요청 처리
   */
  private async handleRecipeRequest(userId: string, message: string): Promise<string> {
    try {
      // 메시지에서 알레르기 정보 추출
      const allergies = this.extractAllergiesFromMessage(message);

      // RAG 검색 실행
      const ragResponse = await this.searchRecipesWithAI({
        query: message,
        userAllergies: allergies,
        maxRecipes: 3
      });

      // 대화 기록에 저장
      await this.saveToMemory(userId, message, ragResponse.aiResponse);

      return ragResponse.aiResponse;

    } catch (error) {
      this.logger.error(`Recipe request failed for user ${userId}:`, error);
      return '죄송합니다. 레시피 검색 중 문제가 발생했습니다. 다시 시도해주세요.';
    }
  }

  /**
   * 일반 채팅 처리
   */
  private async handleGeneralChat(userId: string, message: string): Promise<string> {
    try {
      // 채팅 기록 조회
      const history = await this.getChatHistory(userId, 3);

      // 컨텍스트 구성
      let context = "You are a helpful AI cooking assistant. Please respond in Korean naturally.\n\n";

      if (history.length > 0) {
        context += "Recent conversation:\n";
        history.forEach(item => {
          context += `Human: ${item.human}\n`;
          context += `Assistant: ${item.ai}\n`;
        });
        context += "\n";
      }

      context += `Human: ${message}\nAssistant:`;

      // AI 응답 생성
      const response = await this.ollamaService.generateResponse(context);

      // 메모리에 저장
      await this.saveToMemory(userId, message, response);

      return response;

    } catch (error) {
      this.logger.error(`General chat failed for user ${userId}:`, error);
      return this.getFallbackResponse(message);
    }
  }

  // ================== 메모리 관리 ==================

  /**
   * 대화 기록 저장
   */
  private async saveToMemory(userId: string, human: string, ai: string): Promise<void> {
    try {
      const historyKey = `chat_memory:${userId}`;
      const entry = JSON.stringify({
        human,
        ai,
        timestamp: new Date().toISOString(),
      });

      await this.redisService.lpush(historyKey, entry);
      await this.redisService.ltrim(historyKey, 0, 19); // 최대 20개 보관
      await this.redisService.expire(historyKey, 7 * 24 * 60 * 60); // 7일
    } catch (error) {
      this.logger.warn(`Failed to save to memory for user ${userId}:`, error.message);
    }
  }

  /**
   * 대화 기록 조회
   */
  async getChatHistory(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const historyKey = `chat_memory:${userId}`;
      const history = await this.redisService.lrange(historyKey, 0, limit - 1);

      return history.map(item => {
        try {
          return JSON.parse(item);
        } catch (error) {
          return null;
        }
      }).filter(item => item !== null);
    } catch (error) {
      this.logger.error(`Error fetching chat history for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * 메모리 초기화
   */
  async clearMemory(userId: string): Promise<void> {
    try {
      await this.redisService.del(`chat_memory:${userId}`);
      this.logger.log(`Memory cleared for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error clearing memory for user ${userId}:`, error);
    }
  }

  // ================== 유틸리티 메서드 ==================

  /**
   * 레시피 요청 여부 판단
   */
  private isRecipeRequest(message: string): boolean {
    const recipeKeywords = [
      '요리', '레시피', '만들', '조리', '음식', '먹', '끓', '볶', '굽', '튀김',
      '파스타', '밥', '국', '찌개', '스프', '샐러드', '디저트', '추천', '해줘'
    ];

    return recipeKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * 레시피에서 재료 추출
   */
  private extractIngredients(recipe: any): string[] {
    const ingredients = [];

    if (recipe.ingredients) {
      if (Array.isArray(recipe.ingredients)) {
        ingredients.push(...recipe.ingredients);
      } else if (typeof recipe.ingredients === 'string') {
        ingredients.push(...recipe.ingredients.split(/[,;\n]/).map(i => i.trim()).filter(i => i));
      }
    }

    return [...new Set(ingredients)];
  }

  /**
   * 메시지에서 알레르기 정보 추출
   */
  private extractAllergiesFromMessage(message: string): string[] {
    const allergies = [];
    const allergyMap = {
      '글루텐': ['글루텐', '밀가루', '밀'],
      '견과류': ['견과류', '땅콩', '아몬드', '호두'],
      '유제품': ['유제품', '우유', '치즈', '버터'],
      '해산물': ['해산물', '새우', '게', '조개'],
      '달걀': ['달걀', '계란'],
      '대두': ['대두', '콩']
    };

    Object.entries(allergyMap).forEach(([allergy, keywords]) => {
      if (keywords.some(keyword => message.includes(keyword))) {
        allergies.push(allergy);
      }
    });

    return allergies;
  }

  /**
   * 번역문 정리
   */
  private cleanTranslation(translation: string): string {
    return translation
      .replace(/^(번역|결과|영어|English):?\s*/i, '')
      .replace(/["']/g, '')
      .trim() || 'recipe';
  }

  /**
   * 폴백 번역
   */
  private fallbackTranslation(korean: string): string {
    const simpleMap: { [key: string]: string } = {
      '닭가슴살': 'chicken breast',
      '파스타': 'pasta',
      '라면': 'ramen',
      '볶음밥': 'fried rice',
      '김치찌개': 'kimchi stew'
    };

    for (const [ko, en] of Object.entries(simpleMap)) {
      if (korean.includes(ko)) {
        return en;
      }
    }

    return 'recipe';
  }

  /**
   * 모조 레시피 (검색 실패 시)
   */
  private getMockRecipes(query: string): any[] {
    return [
      {
        name: `${query} Recipe 1`,
        description: 'A delicious and easy recipe',
        minutes: 30,
        ingredients: ['ingredient 1', 'ingredient 2']
      },
      {
        name: `${query} Recipe 2`,
        description: 'Another tasty option',
        minutes: 45,
        ingredients: ['ingredient 3', 'ingredient 4']
      }
    ];
  }

  /**
   * 에러 응답
   */
  private getErrorResponse(): RAGRecipeResponse {
    return {
      aiResponse: '죄송합니다. 레시피 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      sourceRecipes: [],
      searchMetadata: {
        totalFound: 0,
        safeRecipes: 0,
        filteredOut: 0
      }
    };
  }

  /**
   * 폴백 레시피 응답
   */
  private getFallbackRecipeResponse(context: string, userAllergies?: string[]): string {
    if (context.includes('찾을 수 없었습니다')) {
      return `죄송합니다. ${userAllergies?.join(', ')} 알레르기를 고려한 안전한 레시피를 찾을 수 없었습니다. 다른 요리를 시도해보시겠어요?`;
    }

    return `요청하신 레시피를 찾았습니다! ${userAllergies && userAllergies.length > 0 ? `${userAllergies.join(', ')} 알레르기를 고려하여 ` : ''}안전한 레시피들을 준비했어요.`;
  }

  /**
   * 일반 폴백 응답
   */
  private getFallbackResponse(message: string): string {
    if (message.includes('안녕') || message.includes('hello')) {
      return '안녕하세요! AI 요리 어시스턴트입니다! 🍳 어떤 요리를 도와드릴까요?';
    }

    if (message.includes('고마워') || message.includes('thank')) {
      return '천만에요! 맛있는 요리 되세요! 😊';
    }

    return '죄송합니다. 현재 일시적인 문제가 있어요. 다시 시도해주세요! 🙏';
  }
}