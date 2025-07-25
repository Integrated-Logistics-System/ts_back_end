import { Injectable, Logger } from '@nestjs/common';
import { AiProvider, AiResponse, AiStreamResponse, GenerationOptions, OllamaGenerateResponse, OllamaStreamChunk } from '../interfaces/ai.interfaces';
import { AiModuleOptions } from '../ai.module';

@Injectable()
export class OllamaProvider implements AiProvider {
    private readonly logger = new Logger(OllamaProvider.name);
    private config: AiModuleOptions['config'];

    constructor(config: AiModuleOptions['config']) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        try {
            const response = await fetch(`${this.config.url}/api/tags`);
            if (!response.ok) {
                throw new Error(`Ollama connection failed: ${response.status}`);
            }

            const models = await response.json() as { models: { name: string }[] };
            const hasModel = models.models.some((m) => m.name.includes(this.config.model!));

            if (!hasModel) {
                this.logger.warn(`Model ${this.config.model} not found, pulling...`);
                await this.pullModel();
            }
        } catch (error: unknown) {
            throw new Error(`Ollama initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async pullModel(): Promise<void> {
        const response = await fetch(`${this.config.url}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: this.config.model }),
        });

        if (!response.ok) {
            throw new Error(`Failed to pull model ${this.config.model}`);
        }
    }

    async generateText(prompt: string, options?: GenerationOptions): Promise<AiResponse> {
        const constrainedPrompt = this.addConstraints(prompt);

        const response = await fetch(`${this.config.url}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                prompt: constrainedPrompt,
                stream: false,
                options: {
                    temperature: options?.temperature || 0.7,
                    num_predict: options?.maxTokens || parseInt(process.env.OLLAMA_MAX_TOKENS || '4000'),
                    stop: [...(options?.stopSequences || []), 'http://', 'https://', 'www.', 'youtube.com'],
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status}`);
        }

        const data = await response.json() as OllamaGenerateResponse;

        return {
            content: data.response,
            model: this.config.model!,
            finishReason: data.done ? 'stop' : 'length',
            usage: {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
                totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            },
        };
    }

    async *streamText(prompt: string, options?: GenerationOptions): AsyncIterable<AiStreamResponse> {
        const constrainedPrompt = this.addConstraints(prompt);

        const response = await fetch(`${this.config.url}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                prompt: constrainedPrompt,
                stream: true,
                options: {
                    temperature: options?.temperature || 0.7,
                    num_predict: options?.maxTokens || parseInt(process.env.OLLAMA_MAX_TOKENS || '4000'),
                    stop: ['http://', 'https://', 'www.', 'youtube.com'],
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama stream request failed: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Failed to get response reader');
        }

        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line) as OllamaStreamChunk;
                        yield {
                            content: data.response || '',
                            done: data.done || false,
                        };

                        if (data.done) return;
                    } catch {
                        // JSON 파싱 에러 무시
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    private addConstraints(prompt: string): string {
        return `${prompt}

중요한 제약사항:
- 어떤 URL, 링크, 웹 주소도 포함하지 마세요
- 유튜브 링크나 외부 사이트 링크를 생성하지 마세요
- 존재하지 않는 링크를 만들어내지 마세요
- 텍스트 기반의 레시피 정보에만 집중하세요`;
    }
}