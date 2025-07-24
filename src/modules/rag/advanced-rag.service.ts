// 고급 RAG 시스템 파이프라인
import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { AiService } from '../ai/ai.service';
import { UserPersonalizationService } from '../user/user-personalization.service';
import axios from 'axios';

export interface RAGContext {
  query: string;
  userId?: string;
  conversationHistory?: ConversationTurn[];
  userPreferences?: any;
  contextType: 'recipe_search' | 'cooking_help' | 'nutrition_advice' | 'general_chat';
  maxResults?: number;
  includeNutrition?: boolean;
  includeAlternatives?: boolean;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface RAGResult {
  response: string;
  sources: SearchResult[];
  confidence: number;
  reasoning: string;
  suggestions: string[];
  metadata: {
    processingTime: number;
    searchStrategy: string;
    modelUsed: string;
    contextQuality: number;
  };
}

export interface SearchResult {
  recipeId: string;
  title: string;
  description: string;
  relevanceScore: number;
  personalizedScore?: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
  nutritionInfo?: any;
  difficulty: string;
  cookingTime: number;
}

@Injectable()
export class AdvancedRAGService {
  private readonly logger = new Logger(AdvancedRAGService.name);
  private readonly OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  private readonly OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma2:2b';

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly aiService: AiService,
    private readonly personalizationService: UserPersonalizationService,
  ) {}

  /**
   * 고급 RAG 파이프라인 실행
   */
  async processAdvancedRAG(context: RAGContext): Promise<RAGResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`고급 RAG 처리 시작: ${context.query}`);

      // 1. 쿼리 분석 및 의도 파악
      const queryAnalysis = await this.analyzeQuery(context);
      
      // 2. 개인화된 검색 전략 결정
      const searchStrategy = await this.determineSearchStrategy(context, queryAnalysis);
      
      // 3. 다중 검색 실행 (벡터 + 키워드 + 하이브리드)
      const searchResults = await this.executeMultiModalSearch(context, searchStrategy);
      
      // 4. 결과 순위 재조정 (개인화 + 컨텍스트)
      const rankedResults = await this.reRankResults(searchResults, context);
      
      // 5. 컨텍스트 품질 평가 및 개선
      const optimizedContext = await this.optimizeContext(rankedResults, context);
      
      // 6. 고급 프롬프트 엔지니어링
      const enhancedPrompt = await this.buildEnhancedPrompt(optimizedContext, context);
      
      // 7. AI 응답 생성 (다단계 검증)
      const response = await this.generateVerifiedResponse(enhancedPrompt, context);
      
      // 8. 후처리 및 개선 제안
      const finalResult = await this.postProcessResponse(response, optimizedContext, context);

      const processingTime = Date.now() - startTime;
      
      return {
        ...finalResult,
        metadata: {
          ...finalResult.metadata,
          processingTime,
          searchStrategy: searchStrategy.name,
          modelUsed: this.OLLAMA_MODEL,
          contextQuality: optimizedContext.quality,
        },
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`고급 RAG 처리 실패: ${errorMsg}`, errorStack);
      throw new Error(`고급 RAG 처리 중 오류 발생: ${errorMsg}`);
    }
  }

  /**
   * 쿼리 분석 및 의도 파악
   */
  private async analyzeQuery(context: RAGContext) {
    const analysisPrompt = `
사용자 질문을 분석하여 의도와 특성을 파악해주세요.

질문: "${context.query}"
컨텍스트 타입: ${context.contextType}

분석 결과를 JSON 형태로 반환해주세요:
{
  "intent": "recipe_search|cooking_help|nutrition_advice|ingredient_substitute|general_chat",
  "complexity": "simple|medium|complex",
  "specificity": "vague|specific|very_specific",
  "entities": {
    "ingredients": [],
    "cuisine_type": "",
    "cooking_method": "",
    "dietary_restrictions": [],
    "time_constraints": "",
    "difficulty_preference": ""
  },
  "emotional_tone": "casual|urgent|curious|frustrated",
  "follow_up_potential": true/false
}`;

    try {
      const response = await this.callOllamaAPI(analysisPrompt, {
        temperature: 0.3,
        max_tokens: 500,
      });

      return JSON.parse(response);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`쿼리 분석 실패, 기본값 사용: ${errorMsg}`);
      return {
        intent: 'recipe_search',
        complexity: 'medium',
        specificity: 'specific',
        entities: {},
        emotional_tone: 'casual',
        follow_up_potential: true,
      };
    }
  }

  /**
   * 검색 전략 결정
   */
  private async determineSearchStrategy(context: RAGContext, queryAnalysis: any) {
    const strategies = {
      vector_primary: {
        name: 'vector_primary',
        vectorWeight: 0.8,
        keywordWeight: 0.2,
        usePersonalization: true,
        expandQuery: false,
      },
      hybrid_balanced: {
        name: 'hybrid_balanced',
        vectorWeight: 0.6,
        keywordWeight: 0.4,
        usePersonalization: true,
        expandQuery: true,
      },
      keyword_focused: {
        name: 'keyword_focused',
        vectorWeight: 0.3,
        keywordWeight: 0.7,
        usePersonalization: false,
        expandQuery: true,
      },
      personalized_deep: {
        name: 'personalized_deep',
        vectorWeight: 0.7,
        keywordWeight: 0.3,
        usePersonalization: true,
        expandQuery: true,
        boostPersonalHistory: true,
      },
    };

    // 쿼리 분석 결과에 따라 전략 선택
    if (queryAnalysis.complexity === 'complex' && context.userId) {
      return strategies.personalized_deep;
    } else if (queryAnalysis.specificity === 'vague') {
      return strategies.hybrid_balanced;
    } else if (queryAnalysis.entities && Object.keys(queryAnalysis.entities).length > 3) {
      return strategies.keyword_focused;
    } else {
      return strategies.vector_primary;
    }
  }

  /**
   * 다중 모달 검색 실행
   */
  private async executeMultiModalSearch(context: RAGContext, strategy: any): Promise<SearchResult[]> {
    const searches = [];

    // 1. 벡터 검색
    if (strategy.vectorWeight > 0) {
      searches.push(this.vectorSearch(context.query, context.maxResults || 10));
    }

    // 2. 키워드 검색
    if (strategy.keywordWeight > 0) {
      searches.push(this.keywordSearch(context.query, context.maxResults || 10));
    }

    // 3. 개인화된 검색 (사용자가 있는 경우)
    if (strategy.usePersonalization && context.userId) {
      searches.push(this.personalizedSearch(context.query, context.userId, context.maxResults || 5));
    }

    // 4. 의미적 확장 검색
    if (strategy.expandQuery) {
      const expandedQuery = await this.expandQuery(context.query);
      searches.push(this.vectorSearch(expandedQuery, Math.floor((context.maxResults || 10) / 2)));
    }

    // 모든 검색 병렬 실행
    const results = await Promise.allSettled(searches);
    
    // 결과 통합 및 중복 제거
    const combinedResults: SearchResult[] = [];
    const seenIds = new Set<string>();

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        result.value.forEach((item: SearchResult) => {
          if (!seenIds.has(item.recipeId)) {
            seenIds.add(item.recipeId);
            combinedResults.push({
              ...item,
              relevanceScore: this.adjustScoreByStrategy(item.relevanceScore, strategy, index),
            });
          }
        });
      }
    });

    return combinedResults;
  }

  /**
   * 결과 순위 재조정
   */
  private async reRankResults(results: SearchResult[], context: RAGContext): Promise<SearchResult[]> {
    if (!context.userId) {
      return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // 개인화 점수 계산
    const personalizedResults = await Promise.all(
      results.map(async (result) => {
        const personalizedScore = await this.personalizationService.calculatePersonalizedScore(
          context.userId!,
          result.recipeId,
          result.relevanceScore
        );

        return {
          ...result,
          personalizedScore,
          finalScore: (result.relevanceScore * 0.6) + (personalizedScore * 0.4),
        };
      })
    );

    return personalizedResults.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * 컨텍스트 최적화
   */
  private async optimizeContext(results: SearchResult[], context: RAGContext) {
    const maxContextLength = 4000; // 토큰 제한
    let currentLength = 0;
    const optimizedResults: SearchResult[] = [];
    
    // 품질 점수가 높은 순으로 컨텍스트 구성
    const sortedResults = results.sort((a, b) => (b.personalizedScore || b.relevanceScore) - (a.personalizedScore || a.relevanceScore));
    
    for (const result of sortedResults) {
      const resultText = this.formatResultForContext(result);
      if (currentLength + resultText.length <= maxContextLength) {
        optimizedResults.push(result);
        currentLength += resultText.length;
      } else {
        break;
      }
    }

    // 컨텍스트 품질 평가
    const quality = this.evaluateContextQuality(optimizedResults, context);

    return {
      results: optimizedResults,
      quality,
      totalLength: currentLength,
    };
  }

  /**
   * 고급 프롬프트 엔지니어링
   */
  private async buildEnhancedPrompt(optimizedContext: any, context: RAGContext): Promise<string> {
    const systemPrompt = this.getSystemPrompt(context.contextType);
    const userContext = context.userId ? await this.getUserContextInfo(context.userId) : '';
    const conversationHistory = this.formatConversationHistory(context.conversationHistory || []);
    const searchContext = this.formatSearchContext(optimizedContext.results);

    return `${systemPrompt}

${userContext}

${conversationHistory}

사용자 질문: "${context.query}"

관련 레시피 정보:
${searchContext}

응답 지침:
1. 한국어로 친근하고 자연스럽게 답변
2. 검색된 레시피 중 가장 적합한 것을 추천하고 이유 설명
3. 구체적이고 실용적인 조리 방법 제시
4. 사용자의 상황과 선호도를 고려한 맞춤형 조언
5. 필요시 대체 재료나 조리법 변형 제안
6. 영양 정보나 건강 관련 팁 포함 (관련성이 있는 경우)

답변:`;
  }

  /**
   * 검증된 응답 생성
   */
  private async generateVerifiedResponse(prompt: string, context: RAGContext): Promise<any> {
    // 1차 응답 생성
    const primaryResponse = await this.callOllamaAPI(prompt, {
      temperature: 0.7,
      max_tokens: 1500,
    });

    // 응답 품질 검증
    const qualityScore = await this.evaluateResponseQuality(primaryResponse, context);

    // 품질이 낮으면 재생성
    if (qualityScore < 0.7) {
      this.logger.debug('응답 품질이 낮아 재생성합니다.');
      const improvedPrompt = `${prompt}

이전 응답의 품질이 부족했습니다. 다음 점을 개선하여 더 나은 답변을 생성해주세요:
1. 더 구체적이고 실용적인 정보 제공
2. 사용자의 질문에 더 직접적으로 대답
3. 검색된 레시피 정보를 더 효과적으로 활용
4. 친근하고 도움이 되는 톤 유지

개선된 답변:`;

      return await this.callOllamaAPI(improvedPrompt, {
        temperature: 0.6,
        max_tokens: 1500,
      });
    }

    return primaryResponse;
  }

  /**
   * 응답 후처리 및 개선 제안
   */
  private async postProcessResponse(response: string, optimizedContext: any, context: RAGContext): Promise<RAGResult> {
    // 관련 제안 생성
    const suggestions = await this.generateSuggestions(response, context);
    
    // 신뢰도 계산
    const confidence = this.calculateConfidence(optimizedContext, context);
    
    // 추론 과정 설명
    const reasoning = this.generateReasoning(optimizedContext.results, context);

    return {
      response: response.trim(),
      sources: optimizedContext.results,
      confidence,
      reasoning,
      suggestions,
      metadata: {
        processingTime: 0, // 실제 처리 시간은 상위에서 계산
        searchStrategy: '',
        modelUsed: this.OLLAMA_MODEL,
        contextQuality: optimizedContext.quality,
      },
    };
  }

  // Private helper methods
  private async vectorSearch(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const queryVector = await this.generateEmbedding(query);
      
      const searchResult = await (this.elasticsearchService as any).search({
        index: 'recipes',
        body: {
          knn: {
            field: 'embeddingGranite768',
            query_vector: queryVector,
            k: limit,
            num_candidates: limit * 5,
          },
          _source: ['recipe_id', 'name', 'description', 'ingredients_json', 'steps_json', 'tags_json', 'difficulty', 'minutes', 'n_ingredients'],
        },
      });

      return searchResult.hits.hits.map((hit: any) => this.formatElasticsearchResult(hit));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`벡터 검색 실패: ${errorMsg}`);
      return [];
    }
  }

  private async keywordSearch(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const searchResult = await (this.elasticsearchService as any).search({
        index: 'recipes',
        body: {
          query: {
            multi_match: {
              query,
              fields: ['name^3', 'description^2', 'ingredients_text', 'tags_text'],
              type: 'best_fields',
            },
          },
          size: limit,
        },
      });

      return searchResult.hits.hits.map((hit: any) => this.formatElasticsearchResult(hit));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`키워드 검색 실패: ${errorMsg}`);
      return [];
    }
  }

  private async personalizedSearch(query: string, userId: string, limit: number): Promise<SearchResult[]> {
    // 개인화된 검색 로직 구현
    // 사용자의 선호도, 과거 행동, 알레르기 정보 등을 반영
    return [];
  }

  private async expandQuery(query: string): Promise<string> {
    const expansionPrompt = `다음 검색어와 의미적으로 유사하거나 관련된 키워드들을 추가하여 확장된 검색어를 만들어주세요.

원본 검색어: "${query}"

확장 지침:
1. 유사한 재료나 조리법 추가
2. 관련된 요리 스타일이나 지역 특색 포함
3. 동의어나 대체 표현 사용
4. 너무 길지 않게 자연스럽게 확장

확장된 검색어:`;

    try {
      const expandedQuery = await this.callOllamaAPI(expansionPrompt, {
        temperature: 0.5,
        max_tokens: 100,
      });
      return expandedQuery.trim();
    } catch (error) {
      return query; // 확장 실패시 원본 반환
    }
  }

  private adjustScoreByStrategy(score: number, strategy: any, searchIndex: number): number {
    // 검색 전략에 따른 점수 조정
    const weights = [strategy.vectorWeight, strategy.keywordWeight, strategy.usePersonalization ? 0.8 : 0, 0.6];
    return score * (weights[searchIndex] || 1.0);
  }

  private formatResultForContext(result: SearchResult): string {
    return `제목: ${result.title}
설명: ${result.description}
재료: ${result.ingredients.slice(0, 5).join(', ')}
난이도: ${result.difficulty}
시간: ${result.cookingTime}분
`;
  }

  private evaluateContextQuality(results: SearchResult[], context: RAGContext): number {
    // 컨텍스트 품질 평가 로직
    if (results.length === 0) return 0;
    
    const avgScore = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
    const diversity = new Set(results.map(r => r.difficulty)).size / 3; // 난이도 다양성
    const relevanceThreshold = results.filter(r => r.relevanceScore > 0.7).length / results.length;
    
    return (avgScore * 0.5) + (diversity * 0.2) + (relevanceThreshold * 0.3);
  }

  private getSystemPrompt(contextType: string): string {
    const prompts = {
      recipe_search: '당신은 한국 요리 전문가로서 사용자가 원하는 레시피를 찾아주고 요리 방법을 친절하게 안내합니다.',
      cooking_help: '당신은 요리 도움 전문가로서 사용자의 요리 과정에서 발생하는 문제를 해결해줍니다.',
      nutrition_advice: '당신은 영양 전문가로서 건강한 식단과 영양 정보를 제공합니다.',
      general_chat: '당신은 친근한 요리 어시스턴트로서 음식과 요리에 관한 모든 질문에 답변합니다.',
    };
    
    return prompts[contextType as keyof typeof prompts] || prompts.general_chat;
  }

  private async getUserContextInfo(userId: string): Promise<string> {
    // 사용자 컨텍스트 정보 조회
    return '';
  }

  private formatConversationHistory(history: ConversationTurn[]): string {
    if (history.length === 0) return '';
    
    const recentHistory = history.slice(-5); // 최근 5개만
    return `이전 대화:
${recentHistory.map(turn => `${turn.role}: ${turn.content}`).join('\n')}
`;
  }

  private formatSearchContext(results: SearchResult[]): string {
    return results.map((result, index) => `
${index + 1}. ${result.title}
   - 설명: ${result.description}
   - 재료: ${result.ingredients.slice(0, 8).join(', ')}
   - 난이도: ${result.difficulty}, 시간: ${result.cookingTime}분
   - 관련도: ${result.relevanceScore.toFixed(2)}
`).join('\n');
  }

  private async evaluateResponseQuality(response: string, context: RAGContext): Promise<number> {
    // 응답 품질 평가 (길이, 관련성, 구체성 등)
    const length = response.length;
    const hasSpecificInfo = /\d+분|\d+개|단계|재료/.test(response);
    const isRelevant = response.includes(context.query.slice(0, 10));
    
    let score = 0.5;
    if (length > 100 && length < 2000) score += 0.2;
    if (hasSpecificInfo) score += 0.2;
    if (isRelevant) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private async generateSuggestions(response: string, context: RAGContext): Promise<string[]> {
    // 관련 제안 생성
    return [
      '비슷한 다른 레시피도 찾아보시겠어요?',
      '이 요리의 영양 정보가 궁금하시나요?',
      '조리 시간을 단축하는 방법을 알려드릴까요?',
    ];
  }

  private calculateConfidence(optimizedContext: any, context: RAGContext): number {
    return Math.min(optimizedContext.quality * 100, 95);
  }

  private generateReasoning(results: SearchResult[], context: RAGContext): string {
    return `${results.length}개의 관련 레시피를 검색하여 사용자의 질문에 가장 적합한 정보를 선별했습니다. 검색 결과의 평균 관련도는 ${(results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length * 100).toFixed(1)}%입니다.`;
  }

  private formatElasticsearchResult(hit: any): SearchResult {
    const source = hit._source;
    return {
      recipeId: source.recipe_id,
      title: source.name,
      description: source.description || '',
      relevanceScore: hit._score || 0,
      ingredients: this.parseJSONField(source.ingredients_json, []),
      steps: this.parseJSONField(source.steps_json, []),
      tags: this.parseJSONField(source.tags_json, []),
      difficulty: source.difficulty || 'medium',
      cookingTime: source.minutes || 30,
    };
  }

  private parseJSONField(jsonString: string, defaultValue: any): any {
    try {
      return JSON.parse(jsonString || '[]');
    } catch {
      return defaultValue;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.OLLAMA_URL}/api/embeddings`, {
        model: 'granite-embedding:278m',
        prompt: text,
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      });

      return response.data.embedding;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`임베딩 생성 실패: ${errorMsg}`);
    }
  }

  private async callOllamaAPI(prompt: string, options: any): Promise<string> {
    try {
      const response = await axios.post(`${this.OLLAMA_URL}/api/generate`, {
        model: this.OLLAMA_MODEL,
        prompt,
        stream: false,
        options,
      }, {
        timeout: 60000,
      });

      return response.data.response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Ollama API 호출 실패: ${errorMsg}`);
    }
  }

  /**
   * 벡터 검색 실행 (웹소켓용)
   */
  async performVectorSearch(options: {
    query: string;
    k?: number;
    vectorWeight?: number;
    textWeight?: number;
    useHybridSearch?: boolean;
    minScore?: number;
    allergies?: string[];
    preferences?: string[];
  }): Promise<{ results: SearchResult[]; searchTime: number; maxScore: number; }> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🔍 벡터 검색 시작: "${options.query}"`);
      
      // Elasticsearch 벡터 검색 실행
      const vectorSearchResult = await this.elasticsearchService.vectorSearch({
        query: options.query,
        k: options.k || 10,
        vectorWeight: options.vectorWeight || 0.7,
        textWeight: options.textWeight || 0.3,
        useHybridSearch: options.useHybridSearch !== false,
        minScore: options.minScore || 0.3,
        allergies: options.allergies || [],
        preferences: options.preferences || [],
      });

      // 결과를 SearchResult 형태로 변환
      const formattedResults: SearchResult[] = vectorSearchResult.results.map(result => ({
        recipeId: result.id,
        title: result.name || result.nameKo || 'Untitled Recipe',
        description: result.description || result.descriptionKo || '',
        relevanceScore: result._score || 0,
        personalizedScore: result.combinedScore || result._score || 0,
        ingredients: Array.isArray(result.ingredients) ? result.ingredients : 
                    Array.isArray(result.ingredientsKo) ? result.ingredientsKo : [],
        steps: Array.isArray(result.steps) ? result.steps : 
               typeof result.steps === 'string' ? [result.steps] : 
               Array.isArray(result.stepsKo) ? result.stepsKo : [],
        tags: Array.isArray(result.tags) ? result.tags : 
              Array.isArray(result.tagsKo) ? result.tagsKo : [],
        difficulty: result.difficulty || '보통',
        cookingTime: result.minutes || 0,
        nutritionInfo: (result as any).nutritionInfo,
      }));

      const searchTime = Date.now() - startTime;
      
      this.logger.log(`✅ 벡터 검색 완료: ${formattedResults.length}개 결과, ${searchTime}ms`);
      
      return {
        results: formattedResults,
        searchTime,
        maxScore: vectorSearchResult.maxScore || 0,
      };
      
    } catch (error) {
      this.logger.error('벡터 검색 실패:', error);
      return {
        results: [],
        searchTime: Date.now() - startTime,
        maxScore: 0,
      };
    }
  }
}