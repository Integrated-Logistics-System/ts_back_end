import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  processingTime: number;
}

export interface BatchEmbeddingRequest {
  texts: string[];
  model?: string;
  batchSize?: number;
}

export interface BatchEmbeddingResponse {
  embeddings: Array<{
    text: string;
    embedding: number[];
    index: number;
  }>;
  totalProcessed: number;
  totalTime: number;
  averageTime: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaBaseUrl: string;
  private readonly defaultModel = 'nomic-embed-text';
  private readonly expectedDimensions = 384;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1초

  constructor(private readonly configService: ConfigService) {
    this.ollamaBaseUrl = this.configService.get<string>('OLLAMA_URL', 'http://localhost:11434');
    this.logger.log(`🤖 Embedding Service initialized with Ollama URL: ${this.ollamaBaseUrl}`);
  }

  /**
   * 단일 텍스트에 대한 임베딩 생성
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    
    this.logger.log(`🔍 Generating embedding for text: "${request.text.substring(0, 100)}..." using model: ${model}`);

    try {
      const response = await this.callOllamaEmbedding(request.text, model);
      const embedding = response.data.embedding;
      
      // 차원 검증
      this.validateEmbeddingDimensions(embedding, model);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.log(`✅ Embedding generated successfully. Dimensions: ${embedding.length}, Time: ${processingTime}ms`);
      
      return {
        embedding,
        dimensions: embedding.length,
        processingTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to generate embedding: ${errorMessage}`);
      throw new Error(`Embedding generation failed: ${errorMessage}`);
    }
  }

  /**
   * 배치 임베딩 생성 (여러 텍스트를 순차적으로 처리)
   */
  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResponse> {
    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    const batchSize = request.batchSize || 10;
    
    this.logger.log(`🔄 Starting batch embedding generation for ${request.texts.length} texts, batch size: ${batchSize}`);

    const results: Array<{ text: string; embedding: number[]; index: number }> = [];
    const totalTexts = request.texts.length;
    
    try {
      // 배치별로 처리
      for (let i = 0; i < totalTexts; i += batchSize) {
        const batch = request.texts.slice(i, i + batchSize);
        this.logger.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalTexts / batchSize)} (${batch.length} items)`);
        
        // 배치 내 병렬 처리
        const batchPromises = batch.map(async (text, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            const embeddingResponse = await this.generateEmbedding({ text, model });
            return {
              text,
              embedding: embeddingResponse.embedding,
              index: globalIndex
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`❌ Failed to process item ${globalIndex}: ${errorMessage}`);
            // 실패한 항목도 결과에 포함 (빈 배열로)
            return {
              text,
              embedding: [],
              index: globalIndex
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // 진행률 로깅
        const progress = ((i + batch.length) / totalTexts * 100).toFixed(1);
        this.logger.log(`📈 Progress: ${progress}% (${i + batch.length}/${totalTexts})`);
        
        // 배치 간 대기 (Ollama 서버 부하 방지)
        if (i + batchSize < totalTexts) {
          await this.sleep(100);
        }
      }

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / results.length;
      const successCount = results.filter(r => r.embedding.length > 0).length;
      
      this.logger.log(`✅ Batch embedding completed. Success: ${successCount}/${totalTexts}, Total time: ${totalTime}ms, Avg: ${averageTime.toFixed(2)}ms`);
      
      return {
        embeddings: results,
        totalProcessed: results.length,
        totalTime,
        averageTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Batch embedding failed: ${errorMessage}`);
      throw new Error(`Batch embedding generation failed: ${errorMessage}`);
    }
  }

  /**
   * 쿼리 임베딩 생성 (검색용)
   */
  async embedQuery(query: string): Promise<number[]> {
    this.logger.log(`🔍 Generating query embedding: "${query}"`);
    
    const response = await this.generateEmbedding({ text: query });
    return response.embedding;
  }

  /**
   * 문서 임베딩 생성 (인덱싱용)
   */
  async embedDocument(document: string): Promise<number[]> {
    this.logger.log(`📄 Generating document embedding (${document.length} chars)`);
    
    const response = await this.generateEmbedding({ text: document });
    return response.embedding;
  }

  /**
   * Ollama API 호출 (재시도 로직 포함)
   */
  private async callOllamaEmbedding(text: string, model: string): Promise<AxiosResponse<any>> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`🔄 Attempt ${attempt}/${this.maxRetries} for embedding generation`);
        
        const response = await axios.post(
          `${this.ollamaBaseUrl}/api/embeddings`,
          {
            model,
            prompt: text,
          },
          {
            timeout: 30000, // 30초 타임아웃
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        return response;

      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`⚠️ Attempt ${attempt} failed: ${errorMessage}`);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt; // 지수 백오프
          this.logger.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    const lastErrorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
    throw new Error(`All ${this.maxRetries} attempts failed. Last error: ${lastErrorMessage}`);
  }

  /**
   * 임베딩 차원 검증
   */
  private validateEmbeddingDimensions(embedding: number[], model: string): void {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding: empty or non-array result');
    }

    if (model === this.defaultModel && embedding.length !== this.expectedDimensions) {
      this.logger.warn(
        `⚠️ Unexpected embedding dimensions: expected ${this.expectedDimensions}, got ${embedding.length} for model ${model}`
      );
    }

    // NaN이나 무한값 검사
    const hasInvalidValues = embedding.some(val => !isFinite(val));
    if (hasInvalidValues) {
      throw new Error('Invalid embedding: contains NaN or infinite values');
    }
  }

  /**
   * 서비스 상태 확인
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    ollamaConnection: boolean;
    defaultModel: string;
    expectedDimensions: number;
    lastChecked: string;
  }> {
    try {
      // 간단한 테스트 임베딩 생성
      const testEmbedding = await this.generateEmbedding({ 
        text: 'health check test' 
      });

      return {
        status: 'healthy',
        ollamaConnection: true,
        defaultModel: this.defaultModel,
        expectedDimensions: this.expectedDimensions,
        lastChecked: new Date().toISOString(),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Health check failed: ${errorMessage}`);
      
      return {
        status: 'unhealthy',
        ollamaConnection: false,
        defaultModel: this.defaultModel,
        expectedDimensions: this.expectedDimensions,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * 유틸리티: 지연 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 임베딩 캐시 키 생성
   */
  generateCacheKey(text: string, model: string = this.defaultModel): string {
    const textHash = Buffer.from(text).toString('base64').substring(0, 20);
    return `embedding:${model}:${textHash}`;
  }
}