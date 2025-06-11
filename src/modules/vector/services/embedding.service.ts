import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openai: OpenAI;
  private readonly embeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.embeddingModel =
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ||
      'text-embedding-3-large';
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(
        `Failed to create embedding for text: ${text.substring(0, 100)}...`,
        error,
      );
      throw error;
    }
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      if (texts.length === 0) {
        return [];
      }

      // OpenAI has a limit on batch size, so we'll process in chunks
      const batchSize = 100;
      const embeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        const response = await this.openai.embeddings.create({
          model: this.embeddingModel,
          input: batch,
          encoding_format: 'float',
        });

        if (!response.data) {
          throw new Error('No embedding data returned from OpenAI');
        }

        const batchEmbeddings = response.data.map((item) => item.embedding);
        embeddings.push(...batchEmbeddings);
      }

      return embeddings;
    } catch (error) {
      this.logger.error(
        `Failed to create embeddings for ${texts.length} texts`,
        error,
      );
      throw error;
    }
  }

  async createQueryEmbedding(query: string): Promise<number[]> {
    return this.createEmbedding(query);
  }

  getEmbeddingDimensions(): number {
    // text-embedding-3-large has 3072 dimensions
    // text-embedding-3-small has 1536 dimensions
    // text-embedding-ada-002 has 1536 dimensions
    switch (this.embeddingModel) {
      case 'text-embedding-3-large':
        return 3072;
      case 'text-embedding-3-small':
      case 'text-embedding-ada-002':
        return 1536;
      default:
        return 1536; // Default to 1536 for unknown models
    }
  }

  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  /**
   * Preprocess text for better embedding quality
   */
  preprocessText(text: string): string {
    if (!text) return '';

    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Remove very short text (less than 3 characters)
    if (text.length < 3) {
      throw new Error('Text too short for meaningful embedding');
    }

    // Limit text length (OpenAI has token limits)
    const maxLength = 8000; // Conservative limit
    if (text.length > maxLength) {
      text = text.substring(0, maxLength);
      this.logger.warn(
        `Text truncated to ${maxLength} characters for embedding`,
      );
    }

    return text;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}
