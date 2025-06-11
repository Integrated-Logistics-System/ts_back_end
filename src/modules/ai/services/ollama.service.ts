import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

export interface OllamaEmbedRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbedResponse {
  embedding: number[];
}

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('ollama.baseUrl') ||
      'http://localhost:11434';
    this.model = this.configService.get<string>('ollama.model') || 'llama3.1';
    this.embeddingModel =
      this.configService.get<string>('ollama.embeddingModel') ||
      'nomic-embed-text';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.configService.get<number>('ollama.timeout') || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async generate(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    },
  ): Promise<string> {
    try {
      const request: OllamaGenerateRequest = {
        model: options?.model || this.model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 1000,
        },
      };

      this.logger.debug(
        `Generating response for prompt: ${prompt.substring(0, 100)}...`,
      );

      const response = await this.client.post<OllamaGenerateResponse>(
        '/api/generate',
        request,
      );

      if (!response.data.done) {
        throw new Error('Ollama generation not completed');
      }

      this.logger.debug(
        `Generated response: ${response.data.response.substring(0, 100)}...`,
      );
      return response.data.response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Error generating response from Ollama:', errorMessage);
      throw new Error(`Failed to generate response: ${errorMessage}`);
    }
  }

  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    try {
      const request: OllamaEmbedRequest = {
        model: model || this.embeddingModel,
        prompt: text,
      };

      this.logger.debug(
        `Generating embedding for text: ${text.substring(0, 100)}...`,
      );

      const response = await this.client.post<OllamaEmbedResponse>(
        '/api/embeddings',
        request,
      );

      this.logger.debug(
        `Generated embedding with ${response.data.embedding.length} dimensions`,
      );
      return response.data.embedding;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Error generating embedding from Ollama:',
        errorMessage,
      );
      throw new Error(`Failed to generate embedding: ${errorMessage}`);
    }
  }

  async generateStreamResponse(
    prompt: string,
    callback: (chunk: string) => void,
    options?: { temperature?: number; maxTokens?: number; model?: string },
  ): Promise<void> {
    try {
      const request: OllamaGenerateRequest = {
        model: options?.model || this.model,
        prompt,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 1000,
        },
      };

      const response = await this.client.post('/api/generate', request, {
        responseType: 'stream',
      });

      const stream = response.data as NodeJS.ReadableStream;

      stream.on('data', (chunk: Buffer) => {
        const lines = chunk
          .toString()
          .split('\n')
          .filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as OllamaGenerateResponse;
            if (data.response) {
              callback(data.response);
            }
          } catch {
            // Ignore parsing errors for incomplete JSON
          }
        }
      });

      return new Promise<void>((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Error generating stream response from Ollama:',
        errorMessage,
      );
      throw new Error(`Failed to generate stream response: ${errorMessage}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      return response.status === 200;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Ollama health check failed:', errorMessage);
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get<OllamaTagsResponse>('/api/tags');
      return (
        response.data.models?.map((model: OllamaModel) => model.name) || []
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error listing Ollama models:', errorMessage);
      return [];
    }
  }
}
