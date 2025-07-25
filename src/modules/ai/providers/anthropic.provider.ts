import { Injectable, Logger } from '@nestjs/common';
import { AiProvider, AiResponse, AiStreamResponse, GenerationOptions, AnthropicResponse } from '../interfaces/ai.interfaces';
import { AiModuleOptions } from '../ai.module';

@Injectable()
export class AnthropicProvider implements AiProvider {
    private readonly logger = new Logger(AnthropicProvider.name);
    private config: AiModuleOptions['config'];

    constructor(config: AiModuleOptions['config']) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (!this.config.apiKey) {
            throw new Error('Anthropic API key is required');
        }
        // API 키 유효성 검사 등 추가 가능
    }

    async generateText(prompt: string, options?: GenerationOptions): Promise<AiResponse> {
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

            const data = await response.json() as AnthropicResponse;
            const content = data.content?.[0]?.text || '';

            return {
                content,
                model: data.model,
                finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'error',
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

    async *streamText(prompt: string, options?: GenerationOptions): AsyncIterable<AiStreamResponse> {
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
            this.logger.error('Anthropic streaming failed:', error);
            throw new Error(`Anthropic streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}