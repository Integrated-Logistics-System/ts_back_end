import { registerAs } from '@nestjs/config';

export const openaiConfig = registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  embeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large',
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10),
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
}));
