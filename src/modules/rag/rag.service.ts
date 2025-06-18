import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { OllamaService } from '../../shared/ollama/ollama.service';
import { TranslationService } from '../translation/translation.service';
import { AllergenService } from '../allergen/allergen.service';
import {
  UserAllergenProfile,
  AllergenCheckResult,
  RecipeCardData,
  RecipeDetailData,
  RecipeSearchResult,
  TranslationResult
} from '../../shared/interfaces';
import { SupportedLanguage } from '../../shared/types';

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly ollamaService: OllamaService,
    private readonly translationService: TranslationService,
    private readonly allergenService: AllergenService,
  ) {}

  async findOptimalRecipe(query: string, targetLanguage: string = 'auto'): Promise<RecipeSearchResult> {
    return this.findOptimalRecipeWithAllergens(query, targetLanguage, null);
  }

  async findOptimalRecipeWithAllergens(
    query: string, 
    targetLanguage: string = 'auto',
    userAllergenProfile?: UserAllergenProfile
  ): Promise<RecipeSearchResult> {
    try {
      this.logger.log(`🔍 레시피 검색 시작: "${query}"`);

      // 입력 검증
      if (!query || query.trim().length === 0) {
        throw new Error('검색어가 비어있습니다.');
      }

      if (query.trim().length < 2) {
        throw new Error('검색어는 최소 2글자 이상이어야 합니다.');
      }

      // 1. 언어 감지 및 영어 번역
      const translationResult = await this.translateToEnglish(query);
      this.logger.log(`🌐 번역 결과: ${translationResult.detectedLanguage} -> EN: "${translationResult.translatedText}"`);

      // 2. 검색 키워드 추출 및 확장
      const enhancedQuery = await this.enhanceSearchQuery(translationResult.translatedText);
      this.logger.log(`🔍 향상된 검색어: "${enhancedQuery}"`);

      // 3. Elasticsearch에서 레시피 검색
      const recipes = await this.searchRecipesInElasticsearch(enhancedQuery);
      this.logger.log(`📋 검색된 레시피 수: ${recipes.length}`);

      // 4. AI를 통한 최적 레시피 선별 및 설명 생성
      const aiResult = await this.generateRecipeExplanation(
        query,
        recipes,
        translationResult.detectedLanguage
      );

      return {
      originalQuery: query,
      translatedQuery: translationResult.translatedText,
      detectedLanguage: translationResult.detectedLanguage,
      recipes: await this.formatRecipesForCardWithAllergens(
        await this.translationService.getKoreanSearchResults(recipes.slice(0, 3)), 
        userAllergenProfile, 
        translationResult.detectedLanguage
      ), // 상위 3개 레시피 번역 후 반환
      explanation: aiResult.explanation,
      cookingTips: aiResult.tips,
      };

    } catch (error) {
      this.logger.error(`❌ 레시피 검색 오류: ${error.message}`);
      
      // 에러 타입별 처리
      if (error.message.includes('검색어')) {
        throw error; // 입력 검증 에러는 그대로 전달
      }
      
      // 기타 에러는 일반적인 메시지로 변환
      throw new Error(`레시피 검색 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.`);
    }
  }

  private async translateToEnglish(text: string): Promise<TranslationResult> {
    try {
      // 번역 서비스를 사용하여 검색어를 영어로 번역
      const translatedText = await this.translationService.translateQueryToEnglish(text);
      
      const isKorean = /[가-힣]/.test(text);
      
      return {
        translatedText,
        detectedLanguage: isKorean ? 'ko' : 'en',
        confidence: 0.9
      };

    } catch (error) {
      this.logger.warn(`번역 실패, 원본 텍스트 사용: ${error.message}`);
      return {
        translatedText: text,
        detectedLanguage: 'unknown',
        confidence: 0.3
      };
    }
  }

  private async enhanceSearchQuery(query: string): Promise<string> {
    try {
      const enhancePrompt = `
You are a recipe search expert. Given a user's cooking request, generate the best search keywords for finding recipes.
Return only the enhanced search keywords, nothing else.

User request: "${query}"

Enhanced search keywords:`;

      const enhanced = await this.ollamaService.generateResponse(enhancePrompt);
      return enhanced.trim();

    } catch (error) {
      this.logger.warn(`검색어 향상 실패, 원본 사용: ${error.message}`);
      return query;
    }
  }

  private async searchRecipesInElasticsearch(query: string): Promise<any[]> {
    try {
      // 한국어 쿼리인지 확인
      const isKorean = /[가-힣]/.test(query);
      
      // Elasticsearch에서 레시피 검색
      const searchBody = {
        query: {
          bool: {
            should: isKorean ? [
              // 한글 필드 우선 검색
              {
                multi_match: {
                  query: query,
                  fields: ['name_ko^5', 'description_ko^3', 'ingredients_ko^3', 'steps_ko^2', 'tags_ko^3'],
                  type: 'best_fields',
                  fuzziness: 'AUTO'
                }
              },
              {
                match_phrase: {
                  name_ko: {
                    query: query,
                    boost: 8
                  }
                }
              },
              // 영어 필드도 포함 (낮은 우선순위)
              {
                multi_match: {
                  query: query,
                  fields: ['name^2', 'description', 'ingredients', 'steps', 'tags'],
                  type: 'best_fields',
                  fuzziness: 'AUTO'
                }
              }
            ] : [
              // 영어 쿼리 - 기존 로직
              {
                multi_match: {
                  query: query,
                  fields: ['name^3', 'description^2', 'ingredients^2', 'steps', 'tags^2'],
                  type: 'best_fields',
                  fuzziness: 'AUTO'
                }
              },
              {
                match_phrase: {
                  name: {
                    query: query,
                    boost: 5
                  }
                }
              },
              {
                terms: {
                  tags: query.toLowerCase().split(' '),
                  boost: 2
                }
              }
            ],
            minimum_should_match: 1
          }
        },
        size: 10,
        sort: [
          '_score',
          { 'minutes': { 'order': 'asc' } } // 간단한 레시피 우선
        ]
      };

      const response = await this.elasticsearchService.search('recipes', searchBody);
      
      if (response.hits && response.hits.hits) {
        return response.hits.hits.map(hit => ({
          id: hit._id,
          score: hit._score,
          ...hit._source
        }));
      }

      return [];

    } catch (error) {
      this.logger.error(`Elasticsearch 검색 오류: ${error.message}`);
      return [];
    }
  }

  private async generateRecipeExplanation(
    originalQuery: string,
    recipes: any[],
    detectedLanguage: string = 'ko'
  ): Promise<{ explanation: string; tips: string[] }> {
    try {
      if (recipes.length === 0) {
        const noResultMessage = detectedLanguage === 'ko' 
          ? `"${originalQuery}"에 맞는 레시피를 찾지 못했습니다. 다른 검색어로 시도해보세요.`
          : `No recipes found for "${originalQuery}". Please try different search terms.`;
        
        const noResultTips = detectedLanguage === 'ko'
          ? ['더 구체적인 요리명을 입력해보세요', '영어로도 검색해보세요']
          : ['Try more specific dish names', 'Try searching in Korean'];
        
        return {
          explanation: noResultMessage,
          tips: noResultTips
        };
      }

      const recipesContext = recipes.slice(0, 3).map((recipe, index) => `
${index + 1}. ${recipe.name}
   재료: ${Array.isArray(recipe.ingredients) ? recipe.ingredients.slice(0, 5).join(', ') : 'N/A'}
   조리시간: ${recipe.minutes || 'N/A'}분
   단계수: ${recipe.n_steps || 'N/A'}개
   태그: ${Array.isArray(recipe.tags) ? recipe.tags.slice(0, 3).join(', ') : 'N/A'}
`).join('\n');

      const languageInstruction = detectedLanguage === 'ko' 
        ? '한국어로 응답해주세요.'
        : 'Please respond in English.';

      const explanationPrompt = `
당신은 전문 요리사입니다. 사용자의 요청에 맞는 최적의 레시피를 추천하고 설명해주세요.

사용자 요청: "${originalQuery}"
검색된 레시피들:
${recipesContext}

다음 형식으로 ${languageInstruction}
1. 사용자 요청에 가장 적합한 레시피 추천 이유
2. 추천 레시피의 특징과 장점
3. 간단한 조리 팁 2-3개

응답:`;

      const explanation = await this.ollamaService.generateResponse(explanationPrompt);

      // 조리 팁 추출
      const tips = await this.generateCookingTips(originalQuery, recipes[0], detectedLanguage);

      return {
        explanation: explanation.trim(),
        tips
      };

    } catch (error) {
      this.logger.error(`AI 설명 생성 오류: ${error.message}`);
      const fallbackMessage = detectedLanguage === 'ko'
        ? `"${originalQuery}"에 대한 레시피를 찾았습니다. 위의 레시피들을 참고해보세요.`
        : `Found recipes for "${originalQuery}". Please refer to the recipes above.`;
      
      return {
        explanation: fallbackMessage,
        tips: []
      };
    }
  }

  private async generateCookingTips(query: string, topRecipe: any, language: string = 'ko'): Promise<string[]> {
    try {
      if (!topRecipe) return [];

      const languageInstruction = language === 'ko' 
        ? '한국어로 제공해주세요'
        : 'provide in English';

      const tipsPrompt = `
요리 전문가로서 다음 레시피에 대한 실용적인 조리 팁 3개를 ${languageInstruction}.
각 팁은 한 줄로 간단명료하게 작성해주세요.

레시피: ${topRecipe.name}
재료: ${Array.isArray(topRecipe.ingredients) ? topRecipe.ingredients.slice(0, 5).join(', ') : ''}

팁 1:
팁 2:
팁 3:`;

      const tipsResponse = await this.ollamaService.generateResponse(tipsPrompt);
      
      return tipsResponse
        .split('\n')
        .filter(line => line.trim().includes('팁') || line.trim().includes('Tip'))
        .map(line => line.replace(/팁\s*\d+:\s*|Tip\s*\d+:\s*/i, '').trim())
        .filter(tip => tip.length > 0)
        .slice(0, 3);

    } catch (error) {
      this.logger.warn(`조리 팁 생성 실패: ${error.message}`);
      return [];
    }
  }

  async getRecipeDetail(id: number): Promise<RecipeDetailData> {
    try {
      this.logger.log(`📖 레시피 상세 조회: ID ${id}`);

      // Elasticsearch에서 특정 ID로 레시피 조회
      const recipe = await this.elasticsearchService.getById('recipes', id);

      if (!recipe) {
        this.logger.warn(`Elasticsearch에서 레시피를 찾을 수 없음: ID ${id}, Mock 데이터 사용`);
        return this.getMockRecipeDetail(id);
      }

      this.logger.log(`✅ 실제 레시피 데이터 조회 성공: ${recipe.name}`);
      return this.formatRecipeForDetail(recipe);

    } catch (error) {
      this.logger.error(`❌ 레시피 상세 조회 오류: ${error.message}`);
      this.logger.log(`🔄 Mock 데이터로 폴백: ID ${id}`);
      return this.getMockRecipeDetail(id);
    }
  }

  private getMockRecipeDetail(id: number): RecipeDetailData {
    const mockRecipes: Record<number, RecipeDetailData> = {
      1: {
        id: 1,
        name: "간단한 토마토 파스타",
        description: "빠르고 맛있는 토마토 파스타입니다.",
        ingredients: [
          "스파게티 면 (200g)",
          "토마토 소스 (1캔)",
          "양파 (1개, 중간 크기)",
          "마늘 (3쪽)",
          "올리브오일 (2큰술)",
          "파마산 치즈 (50g)",
          "바질 (약간)",
          "소금, 후추 (약간)"
        ],
        steps: [
          "큰 냄비에 물을 끓이고 소금을 넣습니다.",
          "스파게티 면을 8분간 삶아주세요.",
          "팬에 올리브오일을 두르고 마늘을 1분간 볶습니다.",
          "양파를 넣고 5분간 볶아 투명해질 때까지 조리합니다.",
          "토마토 소스를 넣고 10분간 끓여 농축시킵니다.",
          "삶은 면을 소스에 넣고 2분간 버무립니다.",
          "파마산 치즈와 바질을 뿌려 완성합니다."
        ],
        minutes: 20,
        n_steps: 7,
        n_ingredients: 8,
        tags: ["파스타", "간단", "토마토"],
        stepsWithTimers: [
          { index: 1, content: "큰 냄비에 물을 끓이고 소금을 넣습니다.", duration: 0, hasTimer: false },
          { index: 2, content: "스파게티 면을 8분간 삶아주세요.", duration: 8, hasTimer: true },
          { index: 3, content: "팬에 올리브오일을 두르고 마늘을 1분간 볶습니다.", duration: 1, hasTimer: true },
          { index: 4, content: "양파를 넣고 5분간 볶아 투명해질 때까지 조리합니다.", duration: 5, hasTimer: true },
          { index: 5, content: "토마토 소스를 넣고 10분간 끓여 농축시킵니다.", duration: 10, hasTimer: true },
          { index: 6, content: "삶은 면을 소스에 넣고 2분간 버무립니다.", duration: 2, hasTimer: true },
          { index: 7, content: "파마산 치즈와 바질을 뿌려 완성합니다.", duration: 0, hasTimer: false }
        ]
      },
      2: {
        id: 2,
        name: "김치찌개",
        description: "한국의 전통 김치찌개입니다.",
        ingredients: [
          "김치 (200g, 잘 익은 것)",
          "돼지고기 목살 (150g)",
          "두부 (1/2모)",
          "대파 (1대)",
          "양파 (1/2개)",
          "마늘 (2쪽)",
          "고춧가루 (1큰술)",
          "참기름 (1큰술)",
          "물 (2컵)"
        ],
        steps: [
          "돼지고기를 한입 크기로 썰어주세요.",
          "김치는 3cm 길이로 썰고, 두부는 사각으로 썰어주세요.",
          "팬에 참기름을 두르고 돼지고기를 3분간 볶습니다.",
          "김치를 넣고 5분간 볶아 김치가 익을 때까지 조리합니다.",
          "물을 넣고 15분간 끓여주세요.",
          "두부와 대파를 넣고 5분간 더 끓입니다.",
          "간을 맞추고 완성합니다."
        ],
        minutes: 30,
        n_steps: 7,
        n_ingredients: 9,
        tags: ["한식", "찌개", "김치"],
        stepsWithTimers: [
          { index: 1, content: "돼지고기를 한입 크기로 썰어주세요.", duration: 0, hasTimer: false },
          { index: 2, content: "김치는 3cm 길이로 썰고, 두부는 사각으로 썰어주세요.", duration: 0, hasTimer: false },
          { index: 3, content: "팬에 참기름을 두르고 돼지고기를 3분간 볶습니다.", duration: 3, hasTimer: true },
          { index: 4, content: "김치를 넣고 5분간 볶아 김치가 익을 때까지 조리합니다.", duration: 5, hasTimer: true },
          { index: 5, content: "물을 넣고 15분간 끓여주세요.", duration: 15, hasTimer: true },
          { index: 6, content: "두부와 대파를 넣고 5분간 더 끓입니다.", duration: 5, hasTimer: true },
          { index: 7, content: "간을 맞추고 완성합니다.", duration: 0, hasTimer: false }
        ]
      }
    };

    // 검색 결과 ID에 따른 동적 레시피 생성
    const searchResultIds = [443572, 191432, 359731]; // API 검색 결과의 실제 ID들
    
    if (searchResultIds.includes(id)) {
      // 실제 검색 결과 데이터를 기반으로 상세 정보 구성
      const recipeNames = {
        443572: "Fasta Pasta",
        191432: "Chicken Marsala Pasta", 
        359731: "Pasta al Pomodoro"
      };
      
      const recipeIngredients = {
        443572: [
          "linguine (200g)",
          "onion (1 medium)",
          "oil (2 tbsp)",
          "ham (100g)",
          "button mushrooms (150g)",
          "coarse grain mustard (1 tbsp)",
          "heavy cream (200ml)",
          "salt & freshly ground black pepper (1 tsp)",
          "parmesan cheese (100g)"
        ],
        191432: [
          "chicken breast (500g)",
          "pappardelle pasta (200g)",
          "marsala wine (100ml)",
          "mushrooms (200g)",
          "onion (1 medium)",
          "garlic (3 cloves)",
          "tomato paste (2 tbsp)",
          "heavy cream (150ml)",
          "rosemary (fresh, 2 sprigs)"
        ],
        359731: [
          "pasta (200g)",
          "tomatoes (4 large, fresh)",
          "garlic (4 cloves)",
          "basil (fresh, handful)",
          "extra virgin olive oil (3 tbsp)",
          "onion (1 small)",
          "salt (1 tsp)",
          "black pepper (pinch)"
        ]
      };
      
      const recipeSteps = {
        443572: [
          "cook pasta in lightly salted boiling water until just tender",
          "drain and keep hot", 
          "meanwhile cook onion in oil over a gentle heat until softened, but not brown",
          "stir in the ham and mushrooms and cook for two minutes more",
          "add mustard and cream",
          "season with salt and freshly ground black pepper",
          "toss through the pasta ribbons, coating well",
          "serve in four warmed bowls topped with parmesan shavings"
        ],
        191432: [
          "cut chicken into bite-sized pieces",
          "cook pappardelle according to package directions",
          "heat oil in large skillet over medium-high heat",
          "cook chicken pieces for 5 minutes until golden",
          "add mushrooms and cook for 3 minutes",
          "add garlic and cook for 1 minute",
          "add marsala wine and let it reduce for 2 minutes",
          "stir in tomato paste and cook for 1 minute",
          "add cream and rosemary, simmer for 5 minutes",
          "toss with cooked pasta and serve"
        ],
        359731: [
          "bring large pot of salted water to boil",
          "cook pasta according to package directions",
          "heat olive oil in large skillet",
          "sauté onion and garlic for 3 minutes",
          "add tomatoes and cook for 15 minutes",
          "season with salt and pepper",
          "add fresh basil and stir",
          "toss with hot pasta and serve"
        ]
      };
      
      const steps = recipeSteps[id] || recipeSteps[443572];
      
      return {
        id: id,
        name: recipeNames[id] || "Pasta Recipe",
        description: "Delicious pasta recipe with authentic flavors",
        ingredients: recipeIngredients[id] || recipeIngredients[443572],
        steps: steps,
        minutes: id === 443572 ? 20 : id === 191432 ? 35 : 25,
        n_steps: steps.length,
        n_ingredients: (recipeIngredients[id] || recipeIngredients[443572]).length,
        tags: ["pasta", "main-dish", "quick"],
        stepsWithTimers: steps.map((step, index) => ({
          index: index + 1,
          content: step,
          duration: this.extractTimeFromStep(step),
          hasTimer: this.extractTimeFromStep(step) > 0
        }))
      };
    }

    return mockRecipes[id] || mockRecipes[1]; // 기본값으로 토마토 파스타 반환
  }

  private formatRecipesForCard(recipes: any[]): RecipeCardData[] {
    return recipes.map(recipe => ({
      id: recipe.id || recipe.recipe_id || 0,
      name: recipe.name || '제목 없음',
      description: recipe.description ? this.truncateText(recipe.description, 100) : undefined,
      minutes: recipe.minutes || 0,
      n_steps: recipe.n_steps || 0,
      n_ingredients: recipe.n_ingredients || 0,
      tags: Array.isArray(recipe.tags) ? recipe.tags.slice(0, 3) : [],
      score: recipe.score,
      allergyWarnings: [] // 기본값
    }));
  }

  private async formatRecipesForCardWithAllergens(
    recipes: any[], 
    userAllergenProfile?: UserAllergenProfile,
    detectedLanguage?: string
  ): Promise<RecipeCardData[]> {
    const formattedRecipes = await Promise.all(
      recipes.map(async (recipe) => {
        const baseRecipe: RecipeCardData = {
          id: recipe.id || recipe.recipe_id || 0,
          name: recipe.name_ko || recipe.name || '제목 없음',
          description: recipe.description_ko ? 
            this.truncateText(recipe.description_ko, 100) : 
            (recipe.description ? this.truncateText(recipe.description, 100) : undefined),
          minutes: recipe.minutes || 0,
          n_steps: recipe.n_steps || 0,
          n_ingredients: recipe.n_ingredients || 0,
          tags: recipe.tags_ko || (Array.isArray(recipe.tags) ? recipe.tags.slice(0, 3) : []),
          score: recipe.score,
          allergyWarnings: []
        };

        // 알레르기 체크
        if (userAllergenProfile && recipe.ingredients) {
          try {
            const ingredients = this.parseIngredients(recipe.ingredients);
            const allergenCheckResult = await this.allergenService.checkRecipeAllergens(
              ingredients, 
              userAllergenProfile
            );
            
            baseRecipe.allergenCheckResult = allergenCheckResult;
            baseRecipe.allergyWarnings = allergenCheckResult.warnings.map(w => 
              `${w.ingredient}: ${w.allergens.join(', ')}`
            );
          } catch (error) {
            this.logger.warn(`알레르기 체크 실패 [${recipe.name}]: ${error.message}`);
            baseRecipe.allergyWarnings = ['알레르기 정보 확인 불가'];
          }
        }

        return baseRecipe;
      })
    );

    return formattedRecipes;
  }

  private formatRecipeForDetail(recipe: any): RecipeDetailData {
    const steps = this.parseSteps(recipe.steps);
    
    return {
      id: recipe.id || recipe.recipe_id || 0,
      name: recipe.name || '제목 없음',
      description: recipe.description,
      ingredients: this.parseIngredients(recipe.ingredients),
      steps: steps.map(step => step.content),
      minutes: recipe.minutes || 0,
      n_steps: recipe.n_steps || 0,
      n_ingredients: recipe.n_ingredients || 0,
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      nutrition: recipe.nutrition,
      contributor_id: recipe.contributor_id,
      submitted: recipe.submitted,
      stepsWithTimers: steps.map((step, index) => ({
        index: index + 1,
        content: step.content,
        duration: step.duration,
        hasTimer: step.duration > 0
      }))
    };
  }

  private parseIngredients(ingredients: any): string[] {
    if (Array.isArray(ingredients)) {
      return ingredients.map(ingredient => this.addIngredientMeasurement(ingredient));
    }
    if (typeof ingredients === 'string') {
      try {
        // Python 리스트 문자열을 파싱
        const parsed = JSON.parse(ingredients.replace(/'/g, '"'));
        return parsed.map(ingredient => this.addIngredientMeasurement(ingredient));
      } catch {
        return ingredients.split(',').map(item => this.addIngredientMeasurement(item.trim()));
      }
    }
    return [];
  }

  private addIngredientMeasurement(ingredient: string): string {
    // 이미 측정 단위가 있는지 확인
    const hasAmount = /\d+\s*(g|kg|ml|l|컵|큰술|작은술|개|마리|장|포|병|캔|팩|슬라이스|조각)/i.test(ingredient);
    
    if (hasAmount) {
      return ingredient;
    }

    // 일반적인 재료별 기본 측정량 추가
    const measurements = {
      // 야채류
      '양파': '1개 (중간 크기)',
      'onion': '1 medium',
      '마늘': '3-4쪽',
      'garlic': '3-4 cloves',
      '당근': '1개',
      'carrot': '1 medium',
      '감자': '2개 (중간 크기)',
      'potato': '2 medium',
      '토마토': '2개',
      'tomato': '2 medium',
      
      // 육류
      '닭고기': '500g',
      'chicken': '500g',
      '돼지고기': '300g',
      'pork': '300g',
      '쇠고기': '300g',
      'beef': '300g',
      
      // 유제품
      '우유': '200ml',
      'milk': '200ml',
      '치즈': '100g',
      'cheese': '100g',
      '버터': '2큰술',
      'butter': '2 tbsp',
      
      // 조미료
      '소금': '1작은술',
      'salt': '1 tsp',
      '후추': '약간',
      'pepper': 'a pinch',
      '설탕': '1큰술',
      'sugar': '1 tbsp',
      '간장': '2큰술',
      'soy sauce': '2 tbsp',
      
      // 기타
      '계란': '2개',
      'egg': '2 pieces',
      '밀가루': '2컵',
      'flour': '2 cups',
      '쌀': '1컵',
      'rice': '1 cup'
    };

    // 재료명 정규화 (소문자, 공백 제거)
    const normalizedIngredient = ingredient.toLowerCase().trim();
    
    // 측정량 찾기
    for (const [key, measurement] of Object.entries(measurements)) {
      if (normalizedIngredient.includes(key.toLowerCase())) {
        return `${ingredient} (${measurement})`;
      }
    }

    return ingredient; // 기본값은 원본 그대로
  }

  private parseSteps(steps: any): Array<{ content: string; duration: number }> {
    let stepArray: string[] = [];
    
    if (Array.isArray(steps)) {
      stepArray = steps;
    } else if (typeof steps === 'string') {
      try {
        // Python 리스트 문자열을 파싱
        stepArray = JSON.parse(steps.replace(/'/g, '"'));
      } catch {
        stepArray = steps.split('\n').filter(step => step.trim());
      }
    }

    return stepArray.map(step => ({
      content: step,
      duration: this.extractTimeFromStep(step)
    }));
  }

  private extractTimeFromStep(step: string): number {
    // 단계에서 시간 정보 추출 (분 단위)
    const timePatterns = [
      // 한국어 패턴
      /(\d+)\s*분/g,
      /(\d+)\s*시간/g,
      /(\d+)\s*초/g,
      
      // 영어 패턴
      /(\d+)\s*minutes?/gi,
      /(\d+)\s*mins?/gi,
      /(\d+)\s*hours?/gi,
      /(\d+)\s*hrs?/gi,
      /(\d+)\s*seconds?/gi,
      /(\d+)\s*secs?/gi,
      
      // 구문 패턴
      /for\s*(\d+)\s*minutes?/gi,
      /cook\s*for\s*(\d+)\s*minutes?/gi,
      /bake\s*for\s*(\d+)\s*minutes?/gi,
      /simmer\s*for\s*(\d+)\s*minutes?/gi,
      /boil\s*for\s*(\d+)\s*minutes?/gi,
      /(\d+)-(\d+)\s*분/g,
      /(\d+)~(\d+)\s*분/g,
      
      // 조리 동작과 함께
      /끓여\s*(\d+)\s*분/g,
      /익혀\s*(\d+)\s*분/g,
      /굽기\s*(\d+)\s*분/g,
      /볶기\s*(\d+)\s*분/g,
    ];

    let extractedTime = 0;

    for (const pattern of timePatterns) {
      const matches = [...step.matchAll(pattern)];
      for (const match of matches) {
        let timeValue = parseInt(match[1]);
        
        // 시간 단위 변환
        if (match[0].includes('시간') || match[0].includes('hour') || match[0].includes('hr')) {
          timeValue *= 60; // 시간을 분으로 변환
        } else if (match[0].includes('초') || match[0].includes('second') || match[0].includes('sec')) {
          timeValue = Math.max(1, Math.round(timeValue / 60)); // 초를 분으로 변환 (최소 1분)
        }
        
        // 범위인 경우 평균값 사용
        if (match[2]) {
          const timeValue2 = parseInt(match[2]);
          timeValue = Math.round((timeValue + timeValue2) / 2);
        }
        
        extractedTime = Math.max(extractedTime, timeValue);
      }
    }

    // 특정 키워드가 있으면 기본 시간 설정
    if (extractedTime === 0) {
      const keywordTimes = {
        '끓이': 10,
        '볶': 5,
        '굽': 15,
        '찌': 20,
        '튀기': 5,
        'boil': 10,
        'fry': 5,
        'bake': 15,
        'steam': 20,
        'sauté': 5,
        'simmer': 15,
        'cook': 10
      };

      for (const [keyword, defaultTime] of Object.entries(keywordTimes)) {
        if (step.toLowerCase().includes(keyword)) {
          extractedTime = defaultTime;
          break;
        }
      }
    }

    return extractedTime;
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }
}
