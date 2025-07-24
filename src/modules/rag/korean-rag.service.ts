import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { AiService } from '../ai/ai.service';
import axios from 'axios';

@Injectable()
export class KoreanRAGService {
  private readonly logger = new Logger(KoreanRAGService.name);
  private readonly OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  private readonly OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3n:e4b';

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly aiService: AiService,
  ) {}

  /**
   * 한국어 질문에 대한 RAG 응답 생성
   */
  async generateKoreanResponse(userQuery: string): Promise<string> {
    try {
      this.logger.debug(`한국어 RAG 요청: ${userQuery}`);
      
      // 1. 벡터 검색으로 관련 레시피 찾기
      const searchResults = await this.vectorSearch(userQuery);
      
      if (searchResults.length === 0) {
        return "죄송합니다. 관련된 레시피를 찾을 수 없습니다. 다른 검색어로 시도해보세요.";
      }

      // 2. 검색 결과를 AI가 이해할 수 있는 컨텍스트로 변환
      const context = this.formatRecipesForAI(searchResults);
      
      // 3. gemma3n:e4b로 한국어 응답 생성
      const response = await this.generateAIResponse(context, userQuery);
      
      this.logger.debug(`응답 생성 완료: ${response.substring(0, 100)}...`);
      return response;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`RAG 응답 생성 실패: ${errorMsg}`, errorStack);
      return "죄송합니다. 응답을 생성하는 중에 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
  }

  /**
   * 벡터 검색 실행
   */
  private async vectorSearch(query: string, limit: number = 5) {
    // granite-embedding으로 쿼리 벡터화
    const queryVector = await this.generateEmbedding(query);
    
    const searchResult = await (this.elasticsearchService as any).search({
      index: 'recipes',
      body: {
        knn: {
          field: 'embeddingGranite768',
          query_vector: queryVector,
          k: limit,
          num_candidates: limit * 10
        },
        _source: [
          'recipe_id', 'name', 'description', 
          'ingredients_json', 'steps_json', 'tags_json',
          'difficulty', 'minutes', 'n_ingredients'
        ]
      }
    });

    return searchResult.hits.hits.map((hit: any) => ({
      recipe: hit._source,
      score: hit._score
    }));
  }

  /**
   * granite-embedding으로 텍스트 벡터화
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.OLLAMA_URL}/api/embeddings`, {
        model: 'granite-embedding:278m',
        prompt: text
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });

      const embedding = response.data.embedding;
      
      if (!Array.isArray(embedding) || embedding.length !== 768) {
        throw new Error(`잘못된 벡터 차원: ${embedding?.length || 'undefined'}`);
      }

      return embedding;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`임베딩 생성 실패: ${errorMsg}`);
    }
  }

  /**
   * 검색 결과를 AI가 이해할 수 있는 한국어 컨텍스트로 변환
   */
  private formatRecipesForAI(searchResults: any[]): string {
    return searchResults.map((result, index) => {
      const recipe = result.recipe;
      let ingredients: string[] = [];
      let steps: string[] = [];
      let tags: string[] = [];

      try {
        ingredients = JSON.parse(recipe.ingredients_json || '[]');
        steps = JSON.parse(recipe.steps_json || '[]');
        tags = JSON.parse(recipe.tags_json || '[]');
      } catch (error) {
        this.logger.warn(`JSON 파싱 실패: ${recipe.recipe_id}`);
      }

      return `
=== 레시피 ${index + 1}: ${recipe.name} ===
설명: ${recipe.description || '설명 없음'}
재료 (${ingredients.length}개): ${ingredients.slice(0, 10).join(', ')}${ingredients.length > 10 ? '...' : ''}
조리 단계: ${steps.slice(0, 3).join(', ')}${steps.length > 3 ? `... (총 ${steps.length}단계)` : ''}
태그: ${tags.join(', ')}
난이도: ${recipe.difficulty}
소요시간: ${recipe.minutes}분
관련도 점수: ${result.score.toFixed(3)}
      `;
    }).join('\n');
  }

  /**
   * gemma3n:e4b로 한국어 응답 생성
   */
  private async generateAIResponse(context: string, userQuery: string): Promise<string> {
    const prompt = `당신은 친근하고 도움이 되는 한국 요리 전문가입니다.

사용자 질문: "${userQuery}"

다음은 사용자의 질문과 관련된 레시피 검색 결과입니다:
${context}

위의 레시피 정보를 바탕으로 사용자의 질문에 한국어로 친근하게 답변해주세요.

답변 가이드라인:
1. 한국 사용자가 이해하기 쉽도록 자연스러운 한국어 사용
2. 영어 재료명은 한국어로 번역하여 설명 (예: chicken breast → 닭가슴살)
3. 구체적이고 실용적인 조리법 제시
4. 여러 레시피 중 가장 적합한 것을 추천하고 이유 설명
5. 조리 팁이나 대체 재료 제안
6. "~해보세요", "~하시면 됩니다" 등 친근한 존댓말 사용

답변:`;

    try {
      const response = await axios.post(`${this.OLLAMA_URL}/api/generate`, {
        model: this.OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 0.9
        }
      }, {
        timeout: 60000
      });

      return response.data.response.trim();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`AI 응답 생성 실패: ${errorMsg}`);
    }
  }

  /**
   * 스트리밍 응답 생성 (WebSocket용)
   */
  async *generateKoreanResponseStream(userQuery: string) {
    try {
      // 벡터 검색
      yield { type: 'status', message: '관련 레시피 검색 중...' };
      const searchResults = await this.vectorSearch(userQuery);
      
      if (searchResults.length === 0) {
        yield { type: 'response', content: "죄송합니다. 관련된 레시피를 찾을 수 없습니다." };
        return;
      }

      yield { type: 'status', message: `${searchResults.length}개 레시피 발견, AI 응답 생성 중...` };

      // 컨텍스트 구성
      const context = this.formatRecipesForAI(searchResults);
      const prompt = this.buildPrompt(context, userQuery);

      // 스트리밍 응답 생성
      const response = await axios.post(`${this.OLLAMA_URL}/api/generate`, {
        model: this.OLLAMA_MODEL,
        prompt: prompt,
        stream: true,
        options: {
          temperature: 0.7,
          max_tokens: 2000
        }
      }, {
        responseType: 'stream',
        timeout: 120000
      });

      let buffer = '';
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                yield { type: 'response', content: data.response };
              }
              if (data.done) {
                yield { type: 'done' };
                return;
              }
            } catch (e) {
              // JSON 파싱 실패는 무시
            }
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`스트리밍 응답 생성 실패: ${errorMsg}`);
      yield { 
        type: 'error', 
        message: '응답 생성 중 오류가 발생했습니다.' 
      };
    }
  }

  private buildPrompt(context: string, userQuery: string): string {
    return `당신은 친근하고 도움이 되는 한국 요리 전문가입니다.

사용자 질문: "${userQuery}"

다음은 사용자의 질문과 관련된 레시피 검색 결과입니다:
${context}

위의 레시피 정보를 바탕으로 사용자의 질문에 한국어로 친근하게 답변해주세요.

답변 가이드라인:
1. 한국 사용자가 이해하기 쉽도록 자연스러운 한국어 사용
2. 영어 재료명은 한국어로 번역하여 설명
3. 구체적이고 실용적인 조리법 제시  
4. 가장 적합한 레시피 추천
5. 친근한 존댓말 사용

답변:`;
  }

  /**
   * 웹소켓용 한국어 RAG 처리 (고급 버전)
   */
  async processKoreanRAG(context: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🇰🇷 한국어 RAG 처리 시작: ${context.query}`);
      
      // 1. 벡터 검색 실행 (기존 결과가 있으면 사용, 없으면 새로 검색)
      let searchResults = context.searchResults || [];
      if (searchResults.length === 0) {
        searchResults = await this.vectorSearch(context.query);
      }
      
      // 2. 대화 기록을 고려한 컨텍스트 구성
      const conversationContext = this.buildConversationContext(
        context.conversationHistory || []
      );
      
      // 3. 검색 결과를 AI가 이해할 수 있는 형태로 포맷팅
      const recipeContext = this.formatRecipesForAI(searchResults);
      
      // 4. 고급 프롬프트 구성
      const enhancedPrompt = this.buildEnhancedPrompt(
        recipeContext,
        context.query,
        conversationContext,
        context
      );
      
      // 5. AI 응답 생성
      const response = await this.generateAIResponse(recipeContext, context.query);
      
      // 6. 후처리 및 메타데이터 생성
      const processingTime = Date.now() - startTime;
      const confidence = this.calculateConfidence(searchResults, context.query);
      
      return {
        response,
        sources: searchResults.map((result: any) => ({
          recipeId: result.id,
          title: result.name || result.nameKo || 'Untitled Recipe',
          relevanceScore: result._score || 0,
        })),
        confidence,
        reasoning: `${searchResults.length}개의 관련 레시피를 분석하여 답변을 생성했습니다.`,
        suggestions: this.generateSuggestions(searchResults, context.query),
        metadata: {
          processingTime,
          searchResultCount: searchResults.length,
          modelUsed: this.OLLAMA_MODEL,
          contextQuality: confidence,
        },
      };
      
    } catch (error) {
      this.logger.error('한국어 RAG 처리 실패:', error);
      
      return {
        response: '죄송합니다. 요청을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요.',
        sources: [],
        confidence: 0,
        reasoning: '처리 중 오류가 발생했습니다.',
        suggestions: ['다른 검색어로 시도해보세요', '잠시 후 다시 시도해주세요'],
        metadata: {
          processingTime: Date.now() - startTime,
          searchResultCount: 0,
          modelUsed: this.OLLAMA_MODEL,
          contextQuality: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 대화 기록을 컨텍스트로 변환
   */
  private buildConversationContext(history: Array<{role: string, content: string}>): string {
    if (!history || history.length === 0) {
      return '';
    }
    
    const recentHistory = history.slice(-6); // 최근 6개만 사용
    return recentHistory
      .map(turn => `${turn.role === 'user' ? '사용자' : 'AI'}: ${turn.content}`)
      .join('\n');
  }

  /**
   * 고급 프롬프트 구성
   */
  private buildEnhancedPrompt(
    recipeContext: string,
    query: string,
    conversationContext: string,
    context: any
  ): string {
    return `당신은 한국 요리 전문가입니다.

${conversationContext ? `이전 대화:\n${conversationContext}\n` : ''}

현재 사용자 질문: "${query}"

관련 레시피 정보:
${recipeContext}

사용자의 질문에 대해 다음을 고려하여 답변해주세요:
- 이전 대화 맥락 고려
- 구체적이고 실용적인 조리법 제공
- 한국어로 자연스럽게 설명
- 알레르기나 선호도가 있다면 고려
${context.includeNutrition ? '- 영양 정보 포함' : ''}
${context.includeAlternatives ? '- 대안 레시피 제안' : ''}

답변:`;
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(searchResults: any[], query: string): number {
    if (searchResults.length === 0) return 0;
    
    const avgScore = searchResults.reduce((sum, result) => 
      sum + (result._score || 0), 0) / searchResults.length;
    
    const queryLength = query.length;
    const lengthBonus = Math.min(queryLength / 20, 1); // 긴 쿼리일수록 높은 신뢰도
    
    return Math.min((avgScore * 0.7 + lengthBonus * 0.3) * 100, 100);
  }

  /**
   * 추천 질문 생성
   */
  private generateSuggestions(searchResults: any[], query: string): string[] {
    const suggestions = [
      '이 레시피의 칼로리는 얼마나 되나요?',
      '더 쉬운 버전은 없을까요?',
      '다른 재료로 대체할 수 있나요?',
    ];
    
    if (searchResults.length > 0) {
      const firstResult = searchResults[0];
      if (firstResult.cookingTime) {
        suggestions.push(`${firstResult.cookingTime}분보다 빠른 레시피는 있나요?`);
      }
      if (firstResult.difficulty === '어려움') {
        suggestions.push('초보자도 할 수 있는 비슷한 레시피가 있나요?');
      }
    }
    
    return suggestions.slice(0, 4);
  }
}