import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { AiModuleOptions } from './ai.module';

function isErrorWithMessage(error: unknown): error is { message: string } {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
    );
}

export interface AiResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    finishReason: 'stop' | 'length' | 'error';
}

export interface AiStreamResponse {
    content: string;
    done: boolean;
}

interface OllamaGenerateResponse {
    response: string;
    done: boolean;
    prompt_eval_count?: number;
    eval_count?: number;
}

@Injectable()
export class AiService implements OnModuleInit {
    private readonly logger = new Logger(AiService.name);
    private isConnected = false;
    private provider: string;
    private config: AiModuleOptions['config'];

    constructor(@Inject('AI_OPTIONS') private readonly options: AiModuleOptions) {
        this.provider = options.provider;
        this.config = options.config;
    }

    async onModuleInit() {
        await this.initializeConnection();
    }

    // ================== 연결 관리 ==================

    private async initializeConnection(): Promise<void> {
        try {
            switch (this.provider) {
                case 'ollama':
                    await this.initializeOllama();
                    break;
                case 'openai':
                    await this.initializeOpenAI();
                    break;
                case 'anthropic':
                    await this.initializeAnthropic();
                    break;
                default:
                    throw new Error(`Unsupported AI provider: ${this.provider}`);
            }

            this.isConnected = true;
            this.logger.log(`🤖 AI Service initialized - Provider: ${this.provider}, Model: ${this.config.model}`);
        } catch (error: unknown) {
            this.logger.warn(`AI service initialization failed, using fallback mode: ${this.getErrorMessage(error)}`);
            this.isConnected = false;
        }
    }

    private async initializeOllama(): Promise<void> {
        try {
            const response = await fetch(`${this.config.url}/api/tags`);
            if (!response.ok) {
                throw new Error(`Ollama connection failed: ${response.status}`);
            }

            const models = await response.json() as { models: { name: string }[] };
            const hasModel = models.models.some((m) => m.name.includes(this.config.model!));

            if (!hasModel) {
                this.logger.warn(`Model ${this.config.model} not found, pulling...`);
                await this.pullOllamaModel();
            }
        } catch (error: unknown) {
            throw new Error(`Ollama initialization failed: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
        }
    }

    private async pullOllamaModel(): Promise<void> {
        const response = await fetch(`${this.config.url}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: this.config.model }),
        });

        if (!response.ok) {
            throw new Error(`Failed to pull model ${this.config.model}`);
        }
    }

    private async initializeOpenAI(): Promise<void> {
        // OpenAI 초기화 로직
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
        // API 키 유효성 검사 등
    }

    private async initializeAnthropic(): Promise<void> {
        // Anthropic 초기화 로직
        if (!this.config.apiKey) {
            throw new Error('Anthropic API key is required');
        }
        // API 키 유효성 검사 등
    }

    // ================== 텍스트 생성 ==================

    async generateResponse(prompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
        stopSequences?: string[];
    }): Promise<string> {
        const response = await this.generateText(prompt, options);
        return response.content;
    }

    async generateText(prompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
        stopSequences?: string[];
    }): Promise<AiResponse> {
        if (!this.isConnected) {
            return this.getFallbackResponse(prompt);
        }

        try {
            switch (this.provider) {
                case 'ollama':
                    return await this.generateWithOllama(prompt, options);
                case 'openai':
                    return await this.generateWithOpenAI(prompt, options);
                case 'anthropic':
                    return await this.generateWithAnthropic(prompt, options);
                default:
                    throw new Error(`Unsupported provider: ${this.provider}`);
            }
        } catch (error: unknown) {
            this.logger.error(`Text generation failed: ${this.getErrorMessage(error)}`);
            return this.getFallbackResponse(prompt);
        }
    }

    async *streamText(prompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
    }): AsyncIterable<AiStreamResponse> {
        if (!this.isConnected) {
            yield* this.getFallbackStream(prompt);
            return;
        }

        try {
            switch (this.provider) {
                case 'ollama':
                    yield* this.streamWithOllama(prompt, options);
                    break;
                case 'openai':
                    yield* this.streamWithOpenAI(prompt, options);
                    break;
                case 'anthropic':
                    yield* this.streamWithAnthropic(prompt, options);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${this.provider}`);
            }
        } catch (error: unknown) {
            this.logger.error(`Stream generation failed: ${this.getErrorMessage(error)}`);
            yield* this.getFallbackStream(prompt);
        }
    }

    // ================== Provider별 구현 ==================

    private async generateWithOllama(prompt: string, options?: { temperature?: number; maxTokens?: number; stopSequences?: string[] }): Promise<AiResponse> {
        const response = await fetch(`${this.config.url}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                prompt,
                stream: false,
                options: {
                    temperature: options?.temperature || 0.7,
                    num_predict: options?.maxTokens || parseInt(process.env.OLLAMA_MAX_TOKENS || '4000'),
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

    private async *streamWithOllama(prompt: string, options?: { temperature?: number; maxTokens?: number }): AsyncIterable<AiStreamResponse> {
        const response = await fetch(`${this.config.url}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                prompt,
                stream: true,
                options: {
                    temperature: options?.temperature || 0.7,
                    num_predict: options?.maxTokens || parseInt(process.env.OLLAMA_MAX_TOKENS || '4000'),
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

interface OllamaStreamChunk {
    response?: string;
    done?: boolean;
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
                    } catch (_e) { // eslint-disable-line @typescript-eslint/no-unused-vars
                        // JSON 파싱 에러 무시
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    private async generateWithOpenAI(prompt: string, options?: { temperature?: number; maxTokens?: number; stopSequences?: string[] }): Promise<AiResponse> {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.maxTokens || 1000,
                    stop: options?.stopSequences,
                }),
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const choice = data.choices[0];

            return {
                content: choice.message.content,
                model: data.model,
                finishReason: choice.finish_reason === 'stop' ? 'stop' : choice.finish_reason,
                usage: {
                    promptTokens: data.usage?.prompt_tokens || 0,
                    completionTokens: data.usage?.completion_tokens || 0,
                    totalTokens: data.usage?.total_tokens || 0,
                },
            };
        } catch (error) {
            this.logger.error('OpenAI generation failed:', error);
            throw new Error(`OpenAI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async *streamWithOpenAI(prompt: string, options?: { temperature?: number; maxTokens?: number }): AsyncIterable<AiStreamResponse> {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.maxTokens || 1000,
                    stream: true,
                }),
            });

            if (!response.ok) {
                throw new Error(`OpenAI stream API error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to get OpenAI response reader');
            }

            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim());

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                yield { content: '', done: true };
                                return;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices[0]?.delta;
                                if (delta?.content) {
                                    yield {
                                        content: delta.content,
                                        done: false,
                                    };
                                }
                            } catch (_e) {
                                // JSON 파싱 에러 무시
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            this.logger.error('OpenAI streaming failed:', error);
            throw new Error(`OpenAI streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async generateWithAnthropic(prompt: string, options?: { temperature?: number; maxTokens?: number; stopSequences?: string[] }): Promise<AiResponse> {
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.config.model || 'claude-3-sonnet-20240229',
                    max_tokens: options?.maxTokens || 1000,
                    temperature: options?.temperature || 0.7,
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    stop_sequences: options?.stopSequences,
                }),
            });

            if (!response.ok) {
                throw new Error(`Anthropic API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.content?.[0]?.text || '';

            return {
                content,
                model: data.model,
                finishReason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason,
                usage: {
                    promptTokens: data.usage?.input_tokens || 0,
                    completionTokens: data.usage?.output_tokens || 0,
                    totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
                },
            };
        } catch (error) {
            this.logger.error('Anthropic generation failed:', error);
            throw new Error(`Anthropic generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async *streamWithAnthropic(prompt: string, options?: { temperature?: number; maxTokens?: number }): AsyncIterable<AiStreamResponse> {
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.config.model || 'claude-3-sonnet-20240229',
                    max_tokens: options?.maxTokens || 1000,
                    temperature: options?.temperature || 0.7,
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    stream: true,
                }),
            });

            if (!response.ok) {
                throw new Error(`Anthropic stream API error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to get Anthropic response reader');
            }

            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim());

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                yield { content: '', done: true };
                                return;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                    yield {
                                        content: parsed.delta.text,
                                        done: false,
                                    };
                                } else if (parsed.type === 'message_stop') {
                                    yield { content: '', done: true };
                                    return;
                                }
                            } catch (_e) {
                                // JSON 파싱 에러 무시
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            this.logger.error('Anthropic streaming failed:', error);
            throw new Error(`Anthropic streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ================== 폴백 응답 ==================

    private getFallbackResponse(prompt: string): AiResponse {
        const response = this.generateFallbackContent(prompt);

        return {
            content: response,
            model: 'fallback',
            finishReason: 'stop',
            usage: {
                promptTokens: 0,
                completionTokens: response.length / 4, // 대략적인 토큰 수
                totalTokens: response.length / 4,
            },
        };
    }

    private async *getFallbackStream(prompt: string): AsyncIterable<AiStreamResponse> {
        const response = this.generateFallbackContent(prompt);
        const words = response.split(' ');

        for (let i = 0; i < words.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 50));
            yield {
                content: words[i] + ' ',
                done: i === words.length - 1,
            };
        }
    }

    private generateFallbackContent(prompt: string): string {
        const lowerPrompt = prompt.toLowerCase();

        if (lowerPrompt.includes('안녕') || lowerPrompt.includes('hello')) {
            return '안녕하세요! AI 요리 어시스턴트입니다. 어떤 요리를 도와드릴까요? 🍳';
        }

        if (lowerPrompt.includes('요리') || lowerPrompt.includes('레시피')) {
            return '요리에 대해 궁금하신 것이 있으시군요! 구체적으로 어떤 요리나 재료에 대해 알고 싶으신가요?';
        }

        if (lowerPrompt.includes('음식') || lowerPrompt.includes('재료')) {
            return '음식과 재료에 관한 질문이시네요! 어떤 종류의 요리법이나 재료 조합에 대해 도움이 필요하신가요?';
        }

        if (lowerPrompt.includes('고마워') || lowerPrompt.includes('thank')) {
            return '천만에요! 맛있는 요리 되세요! 다른 궁금한 것이 있으시면 언제든 말씀해주세요. 😊';
        }

        return '죄송합니다. 현재 AI 서비스에 일시적인 문제가 있어 적절한 응답을 드리기 어렵습니다. 잠시 후 다시 시도해주세요.';
    }
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (isErrorWithMessage(error)) {
            return error.message;
        }
        return 'An unknown error occurred';
    }


    // ================== 상태 관리 ==================

    async getStatus(): Promise<{
        isConnected: boolean;
        provider: string;
        model: string | undefined;
        config: AiModuleOptions['config'];
    }> {
        return {
            isConnected: this.isConnected,
            provider: this.provider,
            model: this.config.model,
            config: {
                url: this.config.url,
                timeout: this.config.timeout,
                // API 키는 보안상 제외
            },
        };
    }

    async reconnect(): Promise<void> {
        this.logger.log('Attempting to reconnect AI service...');
        await this.initializeConnection();
    }
}