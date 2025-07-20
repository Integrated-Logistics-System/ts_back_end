// WebSocket Events
export const WEBSOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  
  // Authentication events
  AUTHENTICATE: 'authenticate',
  AUTHENTICATION_SUCCESS: 'authentication_success',
  AUTHENTICATION_FAILED: 'authentication_failed',
  
  // Chat events
  JOIN_CHAT: 'join_chat',
  SEND_MESSAGE: 'send_message',
  CLEAR_HISTORY: 'clear_history',
  CHAT_RESPONSE: 'chat_response',
  
  // LangGraph events
  LANGGRAPH_RECIPE_V2: 'langgraph_recipe_v2',
  LANGGRAPH_RAG_V2: 'langgraph_rag_v2',
  LANGGRAPH_BENCHMARK: 'langgraph_benchmark',
  LANGGRAPH_RESPONSE: 'langgraph_response',
  LANGGRAPH_ERROR: 'langgraph_error',
  
  // Status events
  GET_STATUS: 'get_status',
  PING: 'ping',
  PONG: 'pong',
  STATUS_UPDATE: 'status_update',
  
  // Streaming events
  STREAM_START: 'stream_start',
  STREAM_CHUNK: 'stream_chunk',
  STREAM_END: 'stream_end',
  STREAM_ERROR: 'stream_error',
  
  // Error events
  ERROR: 'error',
  VALIDATION_ERROR: 'validation_error',
  RATE_LIMIT_ERROR: 'rate_limit_error',
} as const;

// System Information
export const SYSTEM_INFO = {
  VERSION: 'LangGraph v0.3.8',
  API_VERSION: '2.0',
  WEBSOCKET_VERSION: '1.0',
  SUPPORTED_FEATURES: [
    'chat',
    'langgraph_recipes',
    'langgraph_rag',
    'streaming',
    'benchmarking',
    'authentication',
    'rate_limiting',
  ],
} as const;

// Configuration Constants
export const WEBSOCKET_CONFIG = {
  // Connection timeouts
  PING_TIMEOUT: 60000, // 60초
  PING_INTERVAL: 25000, // 25초
  CONNECT_TIMEOUT: 45000, // 45초
  UPGRADE_TIMEOUT: 30000, // 30초
  
  // Session limits
  MAX_HISTORY_SIZE: 50,
  MAX_MESSAGE_LENGTH: 10000,
  MAX_QUERY_LENGTH: 1000,
  
  // Rate limiting
  RATE_LIMIT_WINDOW: 60000, // 1분
  RATE_LIMIT_MAX_REQUESTS: 60, // 분당 60개 요청
  
  // Streaming
  STREAM_CHUNK_SIZE: 1000,
  STREAM_TIMEOUT: 120000, // 2분
  
  // Authentication
  AUTH_TOKEN_HEADER: 'authorization',
  AUTH_TOKEN_QUERY: 'token',
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24시간
  
  // Reconnection
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000, // 1초
  
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED_TOKEN: 'AUTH_EXPIRED_TOKEN',
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  
  // Validation errors
  VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_FIELD_TOO_LONG: 'VALIDATION_FIELD_TOO_LONG',
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Service errors
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  LANGGRAPH_ERROR: 'LANGGRAPH_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // Processing errors
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  STREAM_ERROR: 'STREAM_ERROR',
  
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  FEATURE_NOT_SUPPORTED: 'FEATURE_NOT_SUPPORTED',
} as const;

// Default Error Messages
export const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_REQUIRED]: '인증이 필요합니다.',
  [ERROR_CODES.AUTH_INVALID_TOKEN]: '유효하지 않은 토큰입니다.',
  [ERROR_CODES.AUTH_EXPIRED_TOKEN]: '토큰이 만료되었습니다.',
  [ERROR_CODES.AUTH_USER_NOT_FOUND]: '사용자를 찾을 수 없습니다.',
  
  [ERROR_CODES.VALIDATION_MISSING_FIELD]: '필수 필드가 누락되었습니다.',
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: '잘못된 형식입니다.',
  [ERROR_CODES.VALIDATION_FIELD_TOO_LONG]: '필드가 너무 깁니다.',
  
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: '요청 한도를 초과했습니다.',
  
  [ERROR_CODES.SERVICE_UNAVAILABLE]: '서비스를 사용할 수 없습니다.',
  [ERROR_CODES.LANGGRAPH_ERROR]: 'LangGraph 처리 중 오류가 발생했습니다.',
  [ERROR_CODES.AI_SERVICE_ERROR]: 'AI 서비스 오류가 발생했습니다.',
  [ERROR_CODES.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다.',
  
  [ERROR_CODES.PROCESSING_TIMEOUT]: '처리 시간이 초과되었습니다.',
  [ERROR_CODES.PROCESSING_ERROR]: '처리 중 오류가 발생했습니다.',
  [ERROR_CODES.STREAM_ERROR]: '스트리밍 중 오류가 발생했습니다.',
  
  [ERROR_CODES.INTERNAL_ERROR]: '내부 서버 오류가 발생했습니다.',
  [ERROR_CODES.INVALID_REQUEST]: '잘못된 요청입니다.',
  [ERROR_CODES.FEATURE_NOT_SUPPORTED]: '지원하지 않는 기능입니다.',
} as const;

// Response Types
export const RESPONSE_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
  STREAM_START: 'stream_start',
  STREAM_CHUNK: 'stream_chunk',
  STREAM_END: 'stream_end',
} as const;

// Room Names
export const CHAT_ROOMS = {
  GENERAL: 'general_chat',
  RECIPE: 'recipe_chat',
  SUPPORT: 'support_chat',
} as const;

// Metrics Keys
export const METRICS_KEYS = {
  TOTAL_CONNECTIONS: 'total_connections',
  ACTIVE_CONNECTIONS: 'active_connections',
  AUTHENTICATED_CONNECTIONS: 'authenticated_connections',
  TOTAL_MESSAGES: 'total_messages',
  ERROR_COUNT: 'error_count',
  AVERAGE_RESPONSE_TIME: 'average_response_time',
  RATE_LIMIT_HITS: 'rate_limit_hits',
} as const;