import { registerAs } from '@nestjs/config';

export const ollamaConfig = registerAs('ollama', () => ({
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'qwen2.5:latest',
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10),
  keepAlive: process.env.OLLAMA_KEEP_ALIVE || '24h',
  options: {
    temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
    top_p: parseFloat(process.env.OLLAMA_TOP_P || '0.9'),
    top_k: parseInt(process.env.OLLAMA_TOP_K || '40', 10),
    repeat_penalty: parseFloat(process.env.OLLAMA_REPEAT_PENALTY || '1.1'),
    num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '4096', 10),
  },
  models: {
    chat: process.env.OLLAMA_MODEL || 'qwen2.5:latest',
    embedding: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    code: process.env.OLLAMA_CODE_MODEL || 'qwen2.5-coder:latest',
  },
}));
