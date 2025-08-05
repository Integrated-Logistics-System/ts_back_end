export interface GenerationOptions {
    temperature?: number;
    stopSequences?: string[];
}

// LangChain과 호환되는 간단한 인터페이스만 유지
export interface StreamChunk {
    content: string;
    done: boolean;
}