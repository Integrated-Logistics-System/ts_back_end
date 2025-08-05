import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { AiModuleOptions } from './ai.module';
import { GenerationOptions } from './interfaces/ai.interfaces';
import { Ollama } from '@langchain/ollama';

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
    private config: AiModuleOptions['config'];
    private ollama: Ollama;

    constructor(@Inject('AI_OPTIONS') private readonly options: AiModuleOptions) {
        this.config = options.config;
        
        // LangChain Ollama 초기화
        this.ollama = new Ollama({
            baseUrl: this.config.url || 'http://localhost:11434',
            model: this.config.model || 'gemma3n:e4b',
            temperature: 0.7,
        });
    }

    async onModuleInit() {
        await this.initializeConnection();
    }

    // ================== 연결 관리 ==================

    private async initializeConnection(): Promise<void> {
        try {
            // Ollama 서버 연결 테스트
            const response = await fetch(`${this.config.url}/api/tags`);
            if (!response.ok) {
                throw new Error(`Ollama connection failed: ${response.status}`);
            }

            // 모델 존재 확인
            const models = await response.json() as { models: { name: string }[] };
            const hasModel = models.models.some((m) => m.name.includes(this.config.model!));

            if (!hasModel) {
                this.logger.warn(`Model ${this.config.model} not found, attempting to pull...`);
                await this.pullModel();
            }

            this.isConnected = true;
            this.logger.log(`🤖 AI Service initialized - Model: ${this.config.model}`);
        } catch (error: unknown) {
            this.logger.warn(`AI service initialization failed, using fallback mode: ${this.getErrorMessage(error)}`);
            this.isConnected = false;
        }
    }

    public async pullModel(): Promise<void> {
        try {
            const response = await fetch(`${this.config.url}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: this.config.model }),
            });

            if (!response.ok) {
                throw new Error(`Failed to pull model ${this.config.model}`);
            }
            
            this.logger.log(`✅ Model ${this.config.model} pulled successfully`);
        } catch (error) {
            this.logger.warn(`Failed to pull model: ${this.getErrorMessage(error)}`);
        }
    }

    // ================== 텍스트 생성 ==================

    async generateResponse(prompt: string, options?: GenerationOptions): Promise<string> {
        try {
            // JSON 응답 전용 프롬프트 강화
            const enhancedPrompt = this.enhancePromptForJson(prompt);
            
            // 옵션이 있으면 temperature 동적 설정
            if (options?.temperature !== undefined) {
                this.ollama.temperature = options.temperature;
            }
            
            // LangChain Ollama 사용
            const response = await this.ollama.invoke(enhancedPrompt);
            return response;
        } catch (error) {
            this.logger.warn(`AI generation failed: ${this.getErrorMessage(error)}`);
            // 폴백 응답 사용
            return this.generateFallbackContent(prompt);
        }
    }

    /**
     * JSON 응답을 위한 프롬프트 강화
     */
    private enhancePromptForJson(prompt: string): string {
        // JSON 응답이 필요한 프롬프트인지 확인
        if (prompt.includes('JSON') || prompt.includes('json') || prompt.includes('{')) {
            return `System: You must respond with ONLY valid JSON. No markdown code blocks. No explanations. No \`\`\`json or \`\`\`. Just the JSON object.

${prompt}

Remember: ONLY JSON output. NO markdown formatting.`;
        }
        
        // URL 제약사항 추가
        return `${prompt}

중요한 제약사항:
- 어떤 URL, 링크, 웹 주소도 포함하지 마세요
- 유튜브 링크나 외부 사이트 링크를 생성하지 마세요
- 존재하지 않는 링크를 만들어내지 마세요
- 텍스트 기반의 레시피 정보에만 집중하세요`;
    }

    async *streamText(prompt: string, options?: GenerationOptions): AsyncIterable<{ content: string; done: boolean }> {
        try {
            const enhancedPrompt = this.enhancePromptForJson(prompt);
            
            if (options?.temperature !== undefined) {
                this.ollama.temperature = options.temperature;
            }
            
            // LangChain의 스트림 기능 사용
            const stream = await this.ollama.stream(enhancedPrompt);
            
            for await (const chunk of stream) {
                yield {
                    content: chunk,
                    done: false
                };
            }
            
            yield {
                content: '',
                done: true
            };
        } catch (error) {
            this.logger.error(`Stream generation failed: ${this.getErrorMessage(error)}`);
            yield* this.getFallbackStream(prompt);
        }
    }

    // ================== 폴백 응답 ==================

    private async *getFallbackStream(prompt: string): AsyncIterable<{ content: string; done: boolean }> {
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
        model: string | undefined;
        config: { url?: string; timeout?: number };
    }> {
        return {
            isConnected: this.isConnected,
            model: this.config.model,
            config: {
                url: this.config.url,
                timeout: this.config.timeout,
            },
        };
    }

    async reconnect(): Promise<void> {
        this.logger.log('Attempting to reconnect AI service...');
        await this.initializeConnection();
    }
}