/**
 * 서비스 관련 인터페이스 정의
 */

export interface ElasticsearchConfig {
  node: string;
  maxRetries?: number;
  requestTimeout?: number;
  sniffOnStart?: boolean;
}

export interface ElasticsearchSearchOptions {
  index: string;
  body: any;
  size?: number;
  from?: number;
  sort?: any[];
  _source?: string[] | boolean;
}

export interface OllamaConfig {
  baseUrl: string;
  defaultModel: string;
  timeout?: number;
  keepAlive?: string;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

export interface OllamaResponse {
  response: string;
  done: boolean;
  model: string;
  created_at: string;
  context?: number[];
}

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
}
