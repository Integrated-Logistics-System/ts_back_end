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

export interface GenerationOptions {
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
}

export interface OllamaGenerateResponse {
    response: string;
    done: boolean;
    prompt_eval_count?: number;
    eval_count?: number;
}

export interface OllamaStreamChunk {
    response?: string;
    done?: boolean;
}

export interface OpenAIResponse {
    choices: Array<{
        message: { content: string };
        finish_reason: string;
    }>;
    model: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface AnthropicResponse {
    content?: Array<{ text: string }>;
    model: string;
    stop_reason: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
}

export interface AiProvider {
    initialize(): Promise<void>;
    generateText(prompt: string, options?: GenerationOptions): Promise<AiResponse>;
    streamText(prompt: string, options?: GenerationOptions): AsyncIterable<AiStreamResponse>;
}