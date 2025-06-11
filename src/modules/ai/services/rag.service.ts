import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from './ollama.service';
import { VectorService } from '../../vector/services/vector.service';
import { ElasticsearchService } from '../../vector/services/elasticsearch.service';
import { EmbeddingService } from '../../vector/services/embedding.service';

export interface RAGContext {
  documents: Array<{
    content: string;
    metadata: Record<string, any>;
    score: number;
    sourceId?: string;
  }>;
  query: string;
  totalRetrieved: number;
}

export interface RAGResponse {
  answer: string;
  context: RAGContext | null;
  sources: Array<{
    id: string;
    title: string;
    relevanceScore: number;
    snippet: string;
  }>;
  confidence: number;
}

export interface RAGOptions {
  maxDocuments?: number;
  relevanceThreshold?: number;
  includeContext?: boolean;
  model?: string;
  temperature?: number;
}

interface ElasticsearchSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

interface VectorSearchResult {
  sourceId?: string;
  score: number;
  metadata?: Record<string, any>;
}

interface CombinedSearchResult {
  id: string;
  score: number;
  hybridScore: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly vectorService: VectorService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async askQuestion(
    question: string,
    options: RAGOptions = {},
  ): Promise<RAGResponse> {
    const {
      maxDocuments = 5,
      relevanceThreshold = 0.7,
      includeContext = true,
      model = 'llama3.1',
      temperature = 0.7,
    } = options;

    try {
      this.logger.log(`Processing RAG question: ${question}`);

      // 1. 질문을 벡터로 변환
      const questionVector =
        await this.embeddingService.createEmbedding(question);

      // 2. 관련 문서 검색 (Elasticsearch에서)
      const relevantDocs = await this.elasticsearchService.queryVectors(
        questionVector,
        {
          topK: maxDocuments * 2, // 더 많이 가져와서 필터링
          includeMetadata: true,
        },
      );

      // 3. 임계값 이상의 문서만 필터링
      const filteredDocs = relevantDocs
        .filter((doc) => doc.score >= relevanceThreshold)
        .slice(0, maxDocuments);

      if (filteredDocs.length === 0) {
        return this.generateFallbackResponse(question);
      }

      // 4. 컨텍스트 구성
      const context: RAGContext = {
        documents: filteredDocs.map((doc) => ({
          content: doc.metadata?.content || '',
          metadata: doc.metadata || {},
          score: doc.score,
          sourceId: doc.id,
        })),
        query: question,
        totalRetrieved: filteredDocs.length,
      };

      // 5. RAG 프롬프트 생성
      const ragPrompt = this.buildRAGPrompt(question, context);

      // 6. Ollama로 답변 생성
      const answer = await this.ollamaService.generate(ragPrompt, {
        model,
        temperature,
        maxTokens: 1000,
      });

      // 7. 신뢰도 계산
      const confidence = this.calculateConfidence(filteredDocs);

      // 8. 소스 정보 구성
      const sources = this.buildSources(filteredDocs);

      return {
        answer: this.cleanAnswer(answer),
        context: includeContext ? context : null,
        sources,
        confidence,
      };
    } catch (error) {
      this.logger.error('RAG processing failed:', error);
      throw new Error(`RAG 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  async askRecipeQuestion(
    question: string,
    options: RAGOptions = {},
  ): Promise<RAGResponse> {
    // 레시피 전용 RAG - 레시피 관련 문서만 검색
    const recipeOptions = {
      ...options,
      filter: { sourceType: 'recipe' },
    };

    return this.askQuestionWithFilter(question, recipeOptions);
  }

  private async askQuestionWithFilter(
    question: string,
    options: RAGOptions & { filter?: Record<string, any> },
  ): Promise<RAGResponse> {
    const {
      maxDocuments = 5,
      relevanceThreshold = 0.7,
      filter = {},
      model = 'llama3.1',
      temperature = 0.7,
    } = options;

    try {
      // 벡터 검색에 필터 적용
      const questionVector =
        await this.embeddingService.createEmbedding(question);

      const relevantDocs = await this.elasticsearchService.queryVectors(
        questionVector,
        {
          topK: maxDocuments * 2,
          filter,
          includeMetadata: true,
        },
      );

      const filteredDocs = relevantDocs
        .filter((doc) => doc.score >= relevanceThreshold)
        .slice(0, maxDocuments);

      if (filteredDocs.length === 0) {
        return this.generateFallbackResponse(question);
      }

      const context: RAGContext = {
        documents: filteredDocs.map((doc) => ({
          content: doc.metadata?.content || '',
          metadata: doc.metadata || {},
          score: doc.score,
          sourceId: doc.id,
        })),
        query: question,
        totalRetrieved: filteredDocs.length,
      };

      const ragPrompt = this.buildRAGPrompt(question, context);
      const answer = await this.ollamaService.generate(ragPrompt, {
        model,
        temperature,
        maxTokens: 1000,
      });

      return {
        answer: this.cleanAnswer(answer),
        context,
        sources: this.buildSources(filteredDocs),
        confidence: this.calculateConfidence(filteredDocs),
      };
    } catch (error) {
      this.logger.error('Filtered RAG processing failed:', error);
      throw error;
    }
  }

  private buildRAGPrompt(question: string, context: RAGContext): string {
    const contextText = context.documents
      .map((doc, index) => `[문서 ${index + 1}] ${doc.content}`)
      .join('\n\n');

    return `당신은 요리 전문가입니다. 아래 제공된 문서들을 바탕으로 질문에 정확하고 도움이 되는 답변을 해주세요.

관련 문서들:
${contextText}

질문: ${question}

답변 지침:
1. 제공된 문서의 정보만을 사용하여 답변하세요
2. 문서에 없는 정보는 추측하지 마세요
3. 답변은 친근하고 이해하기 쉽게 작성하세요
4. 요리 관련 질문이면 구체적인 조리법이나 팁을 포함하세요
5. 문서에서 찾을 수 없는 정보라면 솔직히 말하세요

답변:`;
  }

  private calculateConfidence(docs: ElasticsearchSearchResult[]): number {
    if (docs.length === 0) return 0;

    const avgScore =
      docs.reduce((sum, doc) => sum + doc.score, 0) / docs.length;
    const docCount = Math.min(docs.length / 5, 1); // 최대 5개 문서일 때 최대점수

    return Math.round((avgScore * 0.7 + docCount * 0.3) * 100) / 100;
  }

  private buildSources(docs: ElasticsearchSearchResult[]): Array<{
    id: string;
    title: string;
    relevanceScore: number;
    snippet: string;
  }> {
    return docs.map((doc) => ({
      id: doc.id,
      title:
        doc.metadata?.title || doc.metadata?.name || `문서 ${doc.id.slice(-8)}`,
      relevanceScore: Math.round(doc.score * 100) / 100,
      snippet: this.extractSnippet(
        doc.metadata?.content?.toString() || '',
        150,
      ),
    }));
  }

  private extractSnippet(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    const snippet = content.substring(0, maxLength);
    const lastSpace = snippet.lastIndexOf(' ');

    return lastSpace > maxLength * 0.8
      ? snippet.substring(0, lastSpace) + '...'
      : snippet + '...';
  }

  private cleanAnswer(answer: string): string {
    // 불필요한 접두사나 반복 제거
    return answer
      .replace(/^답변:\s*/i, '')
      .replace(/^응답:\s*/i, '')
      .trim();
  }

  private async generateFallbackResponse(
    question: string,
  ): Promise<RAGResponse> {
    const fallbackAnswer = await this.ollamaService.generate(
      `다음 질문에 대해 일반적인 요리 지식을 바탕으로 도움이 되는 답변을 해주세요: ${question}`,
      { temperature: 0.8 },
    );

    return {
      answer: `죄송합니다. 관련된 구체적인 레시피 정보를 찾을 수 없어서 일반적인 답변을 드립니다:\n\n${fallbackAnswer}`,
      context: {
        documents: [],
        query: question,
        totalRetrieved: 0,
      },
      sources: [],
      confidence: 0.3,
    };
  }

  // 대화형 RAG - 이전 대화 컨텍스트 유지
  async askWithConversationHistory(
    question: string,
    conversationHistory: Array<{ question: string; answer: string }> = [],
    options: RAGOptions = {},
  ): Promise<RAGResponse> {
    try {
      // 이전 대화를 포함한 확장된 질문 생성
      const contextualQuestion = this.buildContextualQuestion(
        question,
        conversationHistory,
      );

      // 확장된 질문으로 RAG 실행
      const ragResponse = await this.askQuestion(contextualQuestion, options);

      // 원래 질문을 context에 유지
      if (ragResponse.context) {
        ragResponse.context.query = question;
      }

      return ragResponse;
    } catch (error) {
      this.logger.error('Conversational RAG failed:', error);
      throw error;
    }
  }

  private buildContextualQuestion(
    currentQuestion: string,
    history: Array<{ question: string; answer: string }>,
  ): string {
    if (history.length === 0) {
      return currentQuestion;
    }

    const recentHistory = history.slice(-3); // 최근 3개 대화만 포함
    const historyText = recentHistory
      .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
      .join('\n\n');

    return `이전 대화:
${historyText}

현재 질문: ${currentQuestion}

위의 대화 맥락을 고려하여 현재 질문에 답해주세요.`;
  }

  // 하이브리드 검색 (키워드 + 벡터)
  async hybridSearch(
    query: string,
    options: RAGOptions & {
      keywordWeight?: number;
      vectorWeight?: number;
    } = {},
  ): Promise<RAGResponse> {
    const {
      keywordWeight = 0.3,
      vectorWeight = 0.7,
      maxDocuments = 5,
      ...ragOptions
    } = options;

    try {
      // 1. 벡터 검색
      const vectorResults = await this.vectorService.searchVectors({
        query,
        topK: maxDocuments * 2,
        includeMetadata: true,
      });

      // 2. 키워드 검색 (Elasticsearch의 텍스트 검색)
      // 이 부분은 별도의 키워드 검색 구현이 필요합니다

      // 3. 결과 합치기 및 재순위
      const hybridResults = this.combineSearchResults(
        vectorResults,
        [], // 키워드 결과 (구현 필요)
        vectorWeight,
        keywordWeight,
      );

      // 4. RAG 처리
      return this.processRAGWithResults(query, hybridResults, ragOptions);
    } catch (error) {
      this.logger.error('Hybrid search failed:', error);
      throw error;
    }
  }

  private combineSearchResults(
    vectorResults: VectorSearchResult[],
    keywordResults: any[],
    vectorWeight: number,
    keywordWeight: number,
  ): CombinedSearchResult[] {
    // 하이브리드 스코어링 로직
    const combinedResults = new Map<string, CombinedSearchResult>();

    // 벡터 결과 처리
    vectorResults.forEach((result) => {
      const id = result.sourceId || 'unknown';
      combinedResults.set(id, {
        id,
        score: result.score,
        hybridScore: result.score * vectorWeight,
        metadata: result.metadata,
      });
    });

    // 키워드 결과 처리 (구현 필요)
    keywordResults.forEach((result: any) => {
      const id = result.id as string;
      if (combinedResults.has(id)) {
        const existing = combinedResults.get(id)!;
        existing.hybridScore += (result.score as number) * keywordWeight;
      } else {
        combinedResults.set(id, {
          id,
          score: result.score as number,
          hybridScore: (result.score as number) * keywordWeight,
          metadata: result.metadata as Record<string, any>,
        });
      }
    });

    // 하이브리드 점수로 정렬
    return Array.from(combinedResults.values()).sort(
      (a, b) => b.hybridScore - a.hybridScore,
    );
  }

  private async processRAGWithResults(
    query: string,
    results: CombinedSearchResult[],
    options: RAGOptions,
  ): Promise<RAGResponse> {
    const context: RAGContext = {
      documents: results.map((doc) => ({
        content: doc.metadata?.content?.toString() || '',
        metadata: doc.metadata || {},
        score: doc.hybridScore || doc.score,
        sourceId: doc.id,
      })),
      query,
      totalRetrieved: results.length,
    };

    const ragPrompt = this.buildRAGPrompt(query, context);
    const answer = await this.ollamaService.generate(ragPrompt, {
      model: options.model || 'llama3.1',
      temperature: options.temperature || 0.7,
    });

    return {
      answer: this.cleanAnswer(answer),
      context,
      sources: this.buildSources(
        results.map((r) => ({
          id: r.id,
          score: r.score,
          metadata: r.metadata,
        })),
      ),
      confidence: this.calculateConfidence(
        results.map((r) => ({
          id: r.id,
          score: r.score,
          metadata: r.metadata,
        })),
      ),
    };
  }
}
