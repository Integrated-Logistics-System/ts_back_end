import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { AiModuleOptions } from './ai.module';
import { AiProvider, AiResponse, AiStreamResponse, GenerationOptions } from './interfaces/ai.interfaces';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';

function isErrorWithMessage(error: unknown): error is { message: string } {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
    );
}

@Injectable()
export class AiService implements OnModuleInit {
    private readonly logger = new Logger(AiService.name);
    private isConnected = false;
    private provider: string;
    private config: AiModuleOptions['config'];
    private aiProvider: AiProvider;

    constructor(@Inject('AI_OPTIONS') private readonly options: AiModuleOptions) {
        this.provider = options.provider;
        this.config = options.config;
        this.aiProvider = this.createProvider();
    }

    async onModuleInit() {
        await this.initializeConnection();
    }

    // ================== 연결 관리 ==================

    private createProvider(): AiProvider {
        switch (this.provider) {
            case 'ollama':
                return new OllamaProvider(this.config);
            case 'openai':
                return new OpenAIProvider(this.config);
            case 'anthropic':
                return new AnthropicProvider(this.config);
            default:
                throw new Error(`Unsupported AI provider: ${this.provider}`);
        }
    }

    private async initializeConnection(): Promise<void> {
        try {
            await this.aiProvider.initialize();
            this.isConnected = true;
            this.logger.log(`🤖 AI Service initialized - Provider: ${this.provider}, Model: ${this.config.model}`);
        } catch (error: unknown) {
            this.logger.warn(`AI service initialization failed, using fallback mode: ${this.getErrorMessage(error)}`);
            this.isConnected = false;
        }
    }

    // ================== 텍스트 생성 ==================

    async generateResponse(prompt: string, options?: GenerationOptions): Promise<string> {
        const response = await this.generateText(prompt, options);
        return response.content;
    }

    async generateText(prompt: string, options?: GenerationOptions): Promise<AiResponse> {
        if (!this.isConnected) {
            return this.getFallbackResponse(prompt);
        }

        try {
            return await this.aiProvider.generateText(prompt, options);
        } catch (error: unknown) {
            this.logger.error(`Text generation failed: ${this.getErrorMessage(error)}`);
            return this.getFallbackResponse(prompt);
        }
    }

    async *streamText(prompt: string, options?: GenerationOptions): AsyncIterable<AiStreamResponse> {
        if (!this.isConnected) {
            yield* this.getFallbackStream(prompt);
            return;
        }

        try {
            yield* this.aiProvider.streamText(prompt, options);
        } catch (error: unknown) {
            this.logger.error(`Stream generation failed: ${this.getErrorMessage(error)}`);
            yield* this.getFallbackStream(prompt);
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