/**
 * 🦜 LangChain 코어 서비스
 * Ollama LLM과의 기본적인 인터페이스를 제공
 */

import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Ollama } from '@langchain/ollama';
import { LangChainModuleOptions } from '../langchain.module';

@Injectable()
export class LangChainCoreService implements OnModuleInit {
  private readonly logger = new Logger(LangChainCoreService.name);
  private ollama!: Ollama;
  private isReady = false;

  constructor(
    @Inject('LANGCHAIN_OPTIONS') private readonly options: LangChainModuleOptions
  ) {
    this.initializeOllama();
  }

  async onModuleInit() {
    await this.validateConnection();
  }

  /**
   * Ollama LLM 초기화
   */
  private initializeOllama() {
    this.ollama = new Ollama({
      baseUrl: this.options.ollama?.baseUrl || 'http://localhost:11434',
      model: this.options.ollama?.model || 'gemma3n:e4b',
      temperature: this.options.ollama?.temperature || 0.7,
      numPredict: -1, // 무제한 토큰
      numCtx: 8192,   // 컨텍스트 윈도우
      repeatPenalty: 1.1,
      topK: 40,
      topP: 0.9,
    });

    this.logger.log(`🦜 LangChain Ollama 초기화: ${this.options.ollama?.model}`);
  }

  /**
   * 연결 상태 검증
   */
  private async validateConnection(): Promise<void> {
    try {
      const baseUrl = this.options.ollama?.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Ollama connection failed: ${response.status}`);
      }

      const models = await response.json() as { models: { name: string }[] };
      const modelName = this.options.ollama?.model || 'gemma3n:e4b';
      const hasModel = models.models.some((m) => m.name.includes(modelName));

      if (!hasModel) {
        this.logger.warn(`⚠️ Model ${modelName} not found - attempting to pull`);
        await this.pullModel(modelName);
      }

      this.isReady = true;
      this.logger.log(`✅ LangChain 연결 확인됨 - Model: ${modelName}`);

    } catch (error) {
      this.logger.error('❌ LangChain 연결 실패:', error);
      this.isReady = false;
    }
  }

  /**
   * 모델 다운로드
   */
  private async pullModel(modelName: string): Promise<void> {
    try {
      const baseUrl = this.options.ollama?.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model ${modelName}`);
      }
      
      this.logger.log(`✅ Model ${modelName} pulled successfully`);
    } catch (error) {
      this.logger.warn(`Failed to pull model: ${error}`);
    }
  }

  /**
   * 텍스트 생성 (기본)
   */
  async generateText(
    prompt: string, 
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    if (!this.isReady) {
      throw new Error('LangChain service is not ready');
    }

    try {
      // 동적 옵션 적용
      if (options?.temperature !== undefined) {
        this.ollama.temperature = options.temperature;
      }

      const result = await this.ollama.invoke(prompt);

      return result;
    } catch (error) {
      this.logger.error('텍스트 생성 실패:', error);
      throw new Error('Failed to generate text');
    }
  }

  /**
   * JSON 응답 생성 (구조화된 출력용)
   */
  async generateJSON<T = any>(
    prompt: string,
    schema?: any,
    options?: { temperature?: number }
  ): Promise<T> {
    const enhancedPrompt = `${prompt}

IMPORTANT: Your response MUST be valid JSON format only. No markdown, no explanations.
Start with { and end with }. Use proper JSON syntax.`;

    const response = await this.generateText(enhancedPrompt, {
      temperature: options?.temperature || 0.3, // JSON은 낮은 temperature 권장
    });

    try {
      // 마크다운 코드블록 제거
      let cleanResponse = response.trim();
      if (cleanResponse.includes('```json')) {
        cleanResponse = cleanResponse.split('```json')[1]?.split('```')[0] || cleanResponse;
      } else if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.split('```')[1]?.split('```')[0] || cleanResponse;
      }

      return JSON.parse(cleanResponse.trim()) as T;
    } catch (parseError) {
      this.logger.error('JSON 파싱 실패:', parseError);
      this.logger.debug('원본 응답:', response);
      throw new Error('Failed to parse JSON response');
    }
  }

  /**
   * 스트리밍 텍스트 생성
   */
  async *generateStreamingText(
    prompt: string,
    options?: { temperature?: number }
  ): AsyncIterable<{ content: string; done: boolean }> {
    if (!this.isReady) {
      throw new Error('LangChain service is not ready');
    }

    try {
      if (options?.temperature !== undefined) {
        this.ollama.temperature = options.temperature;
      }

      const stream = await this.ollama.stream(prompt);

      for await (const chunk of stream) {
        yield { content: chunk, done: false };
      }

      yield { content: '', done: true };
    } catch (error) {
      this.logger.error('스트리밍 텍스트 생성 실패:', error);
      throw new Error('Failed to generate streaming text');
    }
  }

  /**
   * 상태 확인
   */
  getStatus(): {
    isReady: boolean;
    model: string;
    baseUrl: string;
    configuration: LangChainModuleOptions;
  } {
    return {
      isReady: this.isReady,
      model: this.options.ollama?.model || 'gemma3n:e4b',
      baseUrl: this.options.ollama?.baseUrl || 'http://localhost:11434',
      configuration: this.options,
    };
  }

  /**
   * 연결 재시도
   */
  async reconnect(): Promise<void> {
    this.logger.log('🔄 LangChain 연결 재시도...');
    await this.validateConnection();
  }

  /**
   * 직접 Ollama 인스턴스 접근 (고급 사용)
   */
  getOllamaInstance(): Ollama {
    return this.ollama;
  }
}