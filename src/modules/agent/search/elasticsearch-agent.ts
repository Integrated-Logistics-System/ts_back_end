import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '../../elasticsearch/elasticsearch.service';
import { AiService } from '../../ai/ai.service';
// PromptLoaderService 제거 - 간소화된 검색 의도 분석 사용
import { IntentAnalysis } from '../classification/intent-classifier';

export interface SearchIntent {
  type: 'recipe_search' | 'ingredient_search' | 'cuisine_search' | 'dietary_search';
  confidence: number;
  extractedTerms: string[];
  filters: SearchFilters;
  reasoning: string;
}

export interface SearchFilters {
  cuisine?: string;
  difficulty?: string;
  maxCookingTime?: number;
  dietaryRestrictions?: string[];
  ingredients?: string[];
  excludeIngredients?: string[];
}

export interface AgentSearchResult {
  recipes: any[];
  intent: SearchIntent;
  metadata: {
    totalResults: number;
    searchTime: number;
    relevanceScore: number;
  };
}

/**
 * 🔍 Elasticsearch Agent (최적화 버전)
 * AI 기반 지능형 검색 에이전트 - 성능 최적화 및 캐싱 지원
 */
@Injectable()
export class ElasticsearchAgentService {
  private readonly logger = new Logger(ElasticsearchAgentService.name);
  
  // 검색 결과 캐시 (메모리 기반)
  private readonly searchCache = new Map<string, { result: AgentSearchResult; timestamp: number }>();
  private readonly searchCacheMaxSize = 50;
  private readonly searchCacheTtl = 180000; // 3분
  
  // 검색 성능 메트릭
  private searchMetrics = {
    totalSearches: 0,
    cacheHits: 0,
    averageSearchTime: 0
  };

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly aiService: AiService
  ) {
    this.logger.log('🔍 Elasticsearch Agent 초기화 완료 (검색 캐싱 활성화)');
    
    // 캐시 정리 작업 (5분마다)
    setInterval(() => this.cleanupSearchCache(), 300000);
  }

  /**
   * 검색 캐시 정리
   */
  private cleanupSearchCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.searchCache.entries()) {
      if ((now - value.timestamp) > this.searchCacheTtl) {
        this.searchCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.log(`🧹 검색 캐시 정리 완료: ${cleaned}개 항목 제거`);
    }
  }

  /**
   * 검색 성능 메트릭 조회
   */
  getSearchMetrics() {
    return {
      ...this.searchMetrics,
      cacheHitRate: this.searchMetrics.totalSearches > 0 
        ? (this.searchMetrics.cacheHits / this.searchMetrics.totalSearches * 100).toFixed(2) + '%'
        : '0%',
      cachedEntries: this.searchCache.size,
      averageSearchTimeMs: Math.round(this.searchMetrics.averageSearchTime)
    };
  }

  /**
   * 🔬 성능 벤치마크 테스트
   */
  async performanceBenchmark(testQueries: string[] = [
    '닭가슴살 요리',
    '김치찌개 만들기',
    '파스타 레시피',
    '간단한 아침식사',
    '다이어트 요리'
  ]): Promise<any> {
    this.logger.log('🔬 성능 벤치마크 테스트 시작...');
    
    interface BenchmarkResult {
      query: string;
      firstRun: {
        time: number;
        recipeCount: number;
        relevanceScore: number;
      };
      secondRun?: {
        time: number;
        cached: boolean;
      };
    }
    
    const results: BenchmarkResult[] = [];
    const startTime = Date.now();
    
    // 첫 번째 실행 (캐시 미스)
    for (const query of testQueries) {
      const queryStart = Date.now();
      const result = await this.intelligentSearch(query);
      const queryTime = Date.now() - queryStart;
      
      results.push({
        query,
        firstRun: {
          time: queryTime,
          recipeCount: result.recipes.length,
          relevanceScore: result.metadata.relevanceScore
        }
      });
    }
    
    // 두 번째 실행 (캐시 히트 예상)
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      if (!query) continue; // 안전성 체크
      
      const queryStart = Date.now();
      await this.intelligentSearch(query);
      const queryTime = Date.now() - queryStart;
      
      const result = results[i];
      if (result) {
        result.secondRun = {
          time: queryTime,
          cached: queryTime < 50 // 50ms 이하면 캐시로 간주
        };
      }
    }
    
    const totalTime = Date.now() - startTime;
    const metrics = this.getSearchMetrics();
    
    // 안전한 계산을 위한 필터링
    const resultsWithSecondRun = results.filter(r => r.secondRun);
    
    const benchmarkResult = {
      testDuration: totalTime,
      totalQueries: testQueries.length * 2,
      results,
      performanceMetrics: metrics,
      summary: {
        averageFirstRunTime: Math.round(results.reduce((sum, r) => sum + r.firstRun.time, 0) / results.length),
        averageSecondRunTime: resultsWithSecondRun.length > 0 
          ? Math.round(resultsWithSecondRun.reduce((sum, r) => sum + (r.secondRun?.time || 0), 0) / resultsWithSecondRun.length)
          : 0,
        cacheHitRate: metrics.cacheHitRate,
        performanceImprovement: resultsWithSecondRun.length > 0 
          ? resultsWithSecondRun.filter(r => r.secondRun?.cached).length / resultsWithSecondRun.length * 100
          : 0
      }
    };
    
    this.logger.log('🔬 성능 벤치마크 테스트 완료:', benchmarkResult.summary);
    return benchmarkResult;
  }

  /**
   * 🧠 지능형 검색 실행 (캐싱 지원, 알러지 필터링 포함)
   */
  async intelligentSearch(
    userQuery: string, 
    userId?: string, 
    intentAnalysis?: IntentAnalysis,
    userAllergies?: string[]
  ): Promise<AgentSearchResult> {
    const startTime = Date.now();
    this.searchMetrics.totalSearches++;
    
    // 캐시 키 생성 (사용자 쿼리, 의도, 알러지 정보 기반)
    const allergiesKey = userAllergies?.sort().join(',') || 'no-allergies';
    const cacheKey = `search_${userQuery.toLowerCase().trim()}_${intentAnalysis?.intent || 'default'}_${allergiesKey}`;
    
    // 캐시에서 결과 확인
    const cachedResult = this.searchCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < this.searchCacheTtl) {
      this.searchMetrics.cacheHits++;
      this.logger.log(`⚡ 캐시 히트: "${userQuery}" (${Date.now() - startTime}ms)`);
      return cachedResult.result;
    }
    
    this.logger.log(`🔍 Elasticsearch Agent 검색 시작: "${userQuery}"`);

    try {
      // 1단계: 검색 의도 분석 (전달된 의도가 없거나 recipe_detail이 아닌 경우에만)
      let searchIntent: SearchIntent;
      if (intentAnalysis && intentAnalysis.intent === 'recipe_detail') {
        searchIntent = { ...this.getDefaultIntent(userQuery), type: 'recipe_search' as const, reasoning: '상세 정보 요청으로 직접 검색' };
        this.logger.debug(`🎯 기본 검색 의도 사용: recipe_detail 요청으로 인해 recipe_search 적용`);
      } else {
        this.logger.debug(`🔍 검색 의도 분석 시작: "${userQuery}"`);
        searchIntent = await this.analyzeSearchIntent(userQuery);
        this.logger.debug(`📊 분석된 키워드: [${searchIntent.extractedTerms.join(', ')}]`);
      }
      
      this.logger.log(`🎯 검색 의도: ${searchIntent.type} (신뢰도: ${searchIntent.confidence})`);
      this.logger.log(`💡 검색 근거: ${searchIntent.reasoning}`);
      
      if (Object.keys(searchIntent.filters).length > 0) {
        this.logger.debug(`🔧 적용된 필터: ${JSON.stringify(searchIntent.filters, null, 2)}`);
      }

      // 2단계: 검색 실행
      this.logger.debug(`⚙️ Elasticsearch 검색 실행 중...`);
      const searchResult = await this.elasticsearchService.advancedSearch(userQuery, { 
        limit: 10,
        allergies: userAllergies, // 알러지 정보 전달
        ...this.convertFiltersToOptions(searchIntent.filters)
      });

      // 3단계: 결과 후처리 (알러지 필터링 포함)
      const optimizedResults = this.postProcessResults(
        searchResult.recipes, 
        userQuery, 
        searchIntent, 
        userAllergies
      );

      const totalTime = Date.now() - startTime;
      
      // 성능 메트릭 업데이트
      this.searchMetrics.averageSearchTime = 
        (this.searchMetrics.averageSearchTime * (this.searchMetrics.totalSearches - 1) + totalTime) / this.searchMetrics.totalSearches;
      
      this.logger.log(`✅ Elasticsearch Agent 검색 완료: ${optimizedResults.length}개 결과 (${totalTime}ms)`);

      const result: AgentSearchResult = {
        recipes: optimizedResults,
        intent: searchIntent,
        metadata: {
          totalResults: searchResult.total || searchResult.recipes.length,
          searchTime: totalTime,
          relevanceScore: this.calculateOverallRelevance(optimizedResults, userQuery)
        }
      };
      
      // 검색 결과를 캐시에 저장 (성공적인 결과만)
      if (optimizedResults.length > 0) {
        // 캐시 크기 제한
        if (this.searchCache.size >= this.searchCacheMaxSize) {
          const entries = Array.from(this.searchCache.entries());
          if (entries.length > 0) {
            const oldestEntry = entries.sort(([,a], [,b]) => a.timestamp - b.timestamp)[0];
            if (oldestEntry) {
              this.searchCache.delete(oldestEntry[0]);
            }
          }
        }
        
        this.searchCache.set(cacheKey, { result, timestamp: Date.now() });
      }
      
      return result;

    } catch (error) {
      this.logger.error('Elasticsearch Agent 검색 실패:', error);
      // 폴백: 기본 검색
      return this.fallbackSearch(userQuery);
    }
  }

  /**
   * 🎯 검색 의도 분석 (간소화된 키워드 기반)
   */
  private async analyzeSearchIntent(userQuery: string): Promise<SearchIntent> {
    // 간소화된 키워드 기반 의도 분석
    return this.analyzeSearchIntentByKeywords(userQuery);
  }

  /**
   * 키워드 기반 검색 의도 분석
   */
  private analyzeSearchIntentByKeywords(userQuery: string): SearchIntent {
    const queryLower = userQuery.toLowerCase();
    const extractedTerms = userQuery.split(' ').filter(term => term.length > 1);
    
    // 검색 타입 결정
    let type: SearchIntent['type'] = 'recipe_search';
    let confidence = 0.7;
    
    if (queryLower.includes('재료') || queryLower.includes('ingredient')) {
      type = 'ingredient_search';
      confidence = 0.8;
    } else if (queryLower.includes('요리') || queryLower.includes('cuisine') || 
               ['한식', '중식', '일식', '양식'].some(cuisine => queryLower.includes(cuisine))) {
      type = 'cuisine_search';
      confidence = 0.8;
    } else if (queryLower.includes('비건') || queryLower.includes('vegetarian') || 
               queryLower.includes('다이어트') || queryLower.includes('저칼로리')) {
      type = 'dietary_search';
      confidence = 0.8;
    }

    // 기본 필터 추출
    const filters: SearchFilters = {};
    
    // 조리시간 추출
    const timeMatch = queryLower.match(/(\d+)분/);
    if (timeMatch && timeMatch[1]) {
      filters.maxCookingTime = parseInt(timeMatch[1]);
    }
    
    // 난이도 추출
    if (queryLower.includes('쉬운') || queryLower.includes('간단')) {
      filters.difficulty = '쉬움';
    } else if (queryLower.includes('어려운') || queryLower.includes('복잡')) {
      filters.difficulty = '어려움';
    }

    return {
      type,
      confidence,
      extractedTerms,
      filters,
      reasoning: `키워드 기반 분석: ${type} (${extractedTerms.join(', ')})`
    };
  }

  /**
   * 🧹 JSON 응답에서 마크다운 코드 블록 제거
   */
  private cleanJsonResponse(response: string): string {
    let cleaned = response.trim();
    
    // 마크다운 코드 블록 제거
    cleaned = cleaned.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');
    cleaned = cleaned.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
    
    // JSON 객체만 추출
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned.trim();
  }

  /**
   * 📊 검색 타입 매핑
   */
  private mapSearchType(typeString: string): SearchIntent['type'] {
    switch (typeString) {
      case 'recipe_search': return 'recipe_search';
      case 'ingredient_search': return 'ingredient_search';
      case 'cuisine_search': return 'cuisine_search';
      case 'dietary_search': return 'dietary_search';
      default: return 'recipe_search';
    }
  }

  /**
   * 🎛️ 필터 파싱
   */
  private parseFilters(filters: any): SearchFilters {
    return {
      cuisine: filters.cuisine,
      difficulty: filters.difficulty,
      maxCookingTime: filters.maxCookingTime,
      dietaryRestrictions: filters.dietaryRestrictions || [],
      ingredients: filters.ingredients || [],
      excludeIngredients: filters.excludeIngredients || []
    };
  }

  /**
   * 🔧 결과 후처리 (알러지 필터링 포함)
   */
  private postProcessResults(
    results: any[], 
    userQuery: string, 
    intent: SearchIntent, 
    userAllergies?: string[]
  ): any[] {
    // 1. 알러지 필터링 (최우선)
    const safeRecipes = this.filterByAllergies(results, userAllergies);
    
    // 2. 다양성 확보
    const diversified = this.ensureDiversity(safeRecipes);
    
    // 3. 의도 기반 필터링
    const filtered = this.applyIntentBasedFiltering(diversified, intent);

    return filtered.slice(0, 6); // 상위 6개만 반환
  }

  /**
   * 🚫 알러지 필터링 (안전한 레시피만 선별)
   */
  private filterByAllergies(results: any[], userAllergies?: string[]): any[] {
    if (!userAllergies || userAllergies.length === 0) {
      return results; // 알러지 정보가 없으면 모든 결과 반환
    }

    this.logger.log(`🚫 알러지 필터링 시작: ${userAllergies.join(', ')}`);

    const safeRecipes = results.filter(recipe => {
      // 레시피 재료 정보 수집
      const ingredients = [
        ...(recipe.ingredientsKo || []),
        ...(recipe.ingredients || []),
        ...(recipe.tags || [])
      ].join(' ').toLowerCase();

      // 알러지 유발 성분 확인
      const hasAllergen = userAllergies.some(allergy => {
        const allergyLower = allergy.toLowerCase();
        
        // 주요 알러지 성분 매핑
        const allergyKeywords = this.getAllergyKeywords(allergyLower);
        
        return allergyKeywords.some(keyword => 
          ingredients.includes(keyword.toLowerCase())
        );
      });

      if (hasAllergen) {
        this.logger.debug(`❌ 알러지 성분 포함: ${recipe.nameKo || recipe.name}`);
        return false;
      }

      return true;
    });

    this.logger.log(`✅ 알러지 필터링 완료: ${results.length}개 → ${safeRecipes.length}개`);
    return safeRecipes;
  }

  /**
   * 🔍 알러지 성분별 키워드 매핑
   */
  private getAllergyKeywords(allergy: string): string[] {
    const allergyMap: { [key: string]: string[] } = {
      // 견과류
      '견과류': ['견과', '아몬드', '호두', '땅콩', '피스타치오', '캐슈', '마카다미아', '헤이즐넛', '밤', '잣'],
      '땅콩': ['땅콩', 'peanut'],
      '아몬드': ['아몬드', 'almond'],
      '호두': ['호두', 'walnut'],
      
      // 해산물
      '해산물': ['새우', '게', '랍스터', '굴', '조개', '홍합', '전복', '문어', '오징어'],
      '새우': ['새우', 'shrimp', 'prawn'],
      '게': ['게', 'crab'],
      '조개': ['조개', '굴', '홍합', 'clam', 'oyster', 'mussel'],
      
      // 유제품
      '유제품': ['우유', '치즈', '버터', '크림', '요거트', '생크림', '연유', 'milk', 'cheese', 'butter'],
      '우유': ['우유', '밀크', 'milk'],
      '치즈': ['치즈', 'cheese'],
      '버터': ['버터', 'butter'],
      
      // 계란
      '계란': ['계란', '달걀', '메추리알', 'egg'],
      '달걀': ['계란', '달걀', '메추리알', 'egg'],
      
      // 글루텐
      '글루텐': ['밀', '밀가루', '빵', '면', '파스타', '라면', '우동', '글루텐', 'gluten', 'wheat'],
      '밀': ['밀', '밀가루', '글루텐', 'wheat', 'gluten'],
      
      // 콩류
      '콩': ['대두', '콩', '두부', '된장', '간장', '콩나물', 'soy', 'tofu'],
      '대두': ['대두', '콩', '두부', '된장', '간장', 'soy'],
      
      // 기타
      '토마토': ['토마토', 'tomato'],
      '감자': ['감자', 'potato'],
      '당근': ['당근', 'carrot']
    };

    // 직접 매칭되는 키워드 찾기
    if (allergyMap[allergy]) {
      return allergyMap[allergy];
    }

    // 부분 매칭 시도
    for (const [key, keywords] of Object.entries(allergyMap)) {
      if (key.includes(allergy) || allergy.includes(key)) {
        return keywords;
      }
    }

    // 매칭되지 않으면 원본 알러지명 그대로 사용
    return [allergy];
  }

  /**
   * 🌈 다양성 확보
   */
  private ensureDiversity(results: any[]): any[] {
    const seen = new Set<string>();
    const diversified = [];

    for (const recipe of results) {
      const key = this.generateDiversityKey(recipe);
      if (!seen.has(key) && diversified.length < 10) {
        seen.add(key);
        diversified.push(recipe);
      }
    }

    return diversified;
  }

  /**
   * 🔑 다양성 키 생성
   */
  private generateDiversityKey(recipe: any): string {
    const cuisine = recipe.tags?.find((tag: string) => 
      ['한식', '중식', '일식', '양식', '이탈리안', '프렌치'].includes(tag)
    ) || 'general';
    
    const mainIngredient = recipe.ingredientsKo?.[0]?.split(' ')[0] || 'unknown';
    
    return `${cuisine}-${mainIngredient}`;
  }

  /**
   * 🎯 의도 기반 추가 필터링
   */
  private applyIntentBasedFiltering(results: any[], intent: SearchIntent): any[] {
    return results.filter(recipe => {
      // 조리시간 제약
      if (intent.filters.maxCookingTime && recipe.minutes > intent.filters.maxCookingTime) {
        return false;
      }

      // 식단 제약사항
      if (intent.filters.dietaryRestrictions && intent.filters.dietaryRestrictions.length > 0) {
        const hasRestriction = intent.filters.dietaryRestrictions.some(restriction =>
          recipe.tags?.includes(restriction) || 
          recipe.descriptionKo?.includes(restriction)
        );
        if (!hasRestriction) return false;
      }

      // 제외 재료
      if (intent.filters.excludeIngredients && intent.filters.excludeIngredients.length > 0) {
        const hasExcludedIngredient = intent.filters.excludeIngredients.some(excluded =>
          recipe.ingredientsKo?.some((ingredient: string) => 
            ingredient.toLowerCase().includes(excluded.toLowerCase())
          )
        );
        if (hasExcludedIngredient) return false;
      }

      return true;
    });
  }

  /**
   * 📊 전체 관련성 점수 계산
   */
  private calculateOverallRelevance(results: any[], userQuery: string): number {
    if (!results.length) return 0;

    const scores = results.map(recipe => {
      let score = 0;
      
      // 제목 매칭
      if (recipe.nameKo?.toLowerCase().includes(userQuery.toLowerCase())) {
        score += 0.4;
      }
      
      // 재료 매칭
      const matchingIngredients = recipe.ingredientsKo?.filter((ing: string) =>
        userQuery.toLowerCase().includes(ing.toLowerCase()) ||
        ing.toLowerCase().includes(userQuery.toLowerCase())
      ) || [];
      score += (matchingIngredients.length / (recipe.ingredientsKo?.length || 1)) * 0.3;
      
      // 평점 반영  
      score += ((recipe.rating || 0) / 5) * 0.3;
      
      return Math.min(1, score);
    });

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * 🔄 폴백 검색
   */
  private async fallbackSearch(userQuery: string): Promise<AgentSearchResult> {
    this.logger.log('🔄 폴백 검색 실행');
    
    const basicResult = await this.elasticsearchService.advancedSearch(userQuery, { limit: 10 });
    
    return {
      recipes: basicResult.recipes,
      intent: this.getDefaultIntent(userQuery),
      metadata: {
        totalResults: basicResult.total || basicResult.recipes.length,
        searchTime: 0,
        relevanceScore: 0.5
      }
    };
  }

  /**
   * 🎯 기본 의도 생성
   */
  private getDefaultIntent(userQuery: string): SearchIntent {
    return {
      type: 'recipe_search',
      confidence: 0.5,
      extractedTerms: userQuery.split(' '),
      filters: {},
      reasoning: '기본 레시피 검색'
    };
  }

  /**
   * 🔧 필터를 검색 옵션으로 변환
   */
  private convertFiltersToOptions(filters: SearchFilters): any {
    const options: any = {};
    
    if (filters.maxCookingTime) {
      options.maxCookingTime = filters.maxCookingTime;
    }
    if (filters.difficulty) {
      options.difficulty = filters.difficulty;
    }
    if (filters.cuisine) {
      options.cuisine = filters.cuisine;
    }
    
    return options;
  }

  // ========== 레거시 호환성 메서드들 ==========

  /**
   * 📋 ID로 레시피 조회
   */
  async getRecipeById(recipeId: string): Promise<any | null> {
    try {
      return await this.elasticsearchService.getRecipeById(recipeId);
    } catch (error) {
      this.logger.error('레시피 ID 조회 실패:', error);
      return null;
    }
  }

  /**
   * 🔍 기존 검색 API 래핑 (레거시 호환성)
   */
  async searchRecipes(query: string, options: any): Promise<any> {
    try {
      // 지능형 검색이 실패하면 기존 검색 사용
      const agentResult = await this.intelligentSearch(query);
      if (agentResult.recipes.length > 0) {
        return {
          recipes: agentResult.recipes,
          total: agentResult.metadata.totalResults,
          page: options.page || 1,
          limit: options.limit || 10
        };
      }
      // 폴백
      return await this.elasticsearchService.searchRecipes(query, options);
    } catch (error) {
      this.logger.error('Agent 검색 실패, 기본 검색 사용:', error);
      return await this.elasticsearchService.searchRecipes(query, options);
    }
  }

  /**
   * ⭐ 인기 레시피 조회
   */
  async getTopRatedRecipes(limit: number): Promise<any[]> {
    try {
      return await this.elasticsearchService.getTopRatedRecipes(limit);
    } catch (error) {
      this.logger.error('인기 레시피 조회 실패:', error);
      return [];
    }
  }

  /**
   * 🎯 개인화된 추천 레시피
   */
  async getRecommendedRecipes(userId: string, preferences: string[], allergies: string[], limit: number): Promise<any[]> {
    try {
      return await this.elasticsearchService.getRecommendedRecipes(userId, preferences, allergies, limit);
    } catch (error) {
      this.logger.error('추천 레시피 조회 실패:', error);
      return [];
    }
  }

  /**
   * 🔄 유사 레시피 조회
   */
  async getSimilarRecipes(recipeId: string, limit: number): Promise<any[]> {
    try {
      return await this.elasticsearchService.getSimilarRecipes(recipeId, limit);
    } catch (error) {
      this.logger.error('유사 레시피 조회 실패:', error);
      return [];
    }
  }

  /**
   * 💾 레시피 저장 (기능 제거됨 - 에러 처리)
   */
  async saveRecipe(recipe: any): Promise<void> {
    this.logger.warn('레시피 저장 기능이 제거되었습니다. 읽기 전용 모드에서 실행 중입니다.');
    throw new Error('Recipe management functionality has been removed - running in read-only mode');
  }

  /**
   * 🔍 고급 검색 (레거시 호환)
   */
  async advancedSearch(query: string, options: any): Promise<any> {
    try {
      // 지능형 검색 우선 시도
      const agentResult = await this.intelligentSearch(query);
      if (agentResult.recipes.length > 0) {
        return {
          recipes: agentResult.recipes.slice(0, options.limit || 10),
          total: agentResult.metadata.totalResults
        };
      }
      // 폴백
      return await this.elasticsearchService.advancedSearch(query, options);
    } catch (error) {
      this.logger.error('고급 검색 실패:', error);
      return await this.elasticsearchService.advancedSearch(query, options);
    }
  }
}