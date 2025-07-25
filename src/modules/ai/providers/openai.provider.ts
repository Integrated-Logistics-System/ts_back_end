import { Injectable, Logger } from '@nestjs/common';
import { AiProvider, AiResponse, AiStreamResponse, GenerationOptions, OpenAIResponse } from '../interfaces/ai.interfaces';
import { AiModuleOptions } from '../ai.module';

@Injectable()
export class OpenAIProvider implements AiProvider {
    private readonly logger = new Logger(OpenAIProvider.name);
    private config: AiModuleOptions['config'];

    constructor(config: AiModuleOptions['config']) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
        // API 키 유효성 검사 등 추가 가능
    }

    async generateText(prompt: string, options?: GenerationOptions): Promise<AiResponse> {
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

            const data = await response.json() as OpenAIResponse;
            const choice = data.choices[0];
            
            if (!choice) {
                throw new Error('No response choice available');
            }

            return {
                content: choice.message.content,
                model: data.model,
                finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
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

    async *streamText(prompt: string, options?: GenerationOptions): AsyncIterable<AiStreamResponse> {
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
                            } catch {
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
}