import { Socket } from 'socket.io';

// WebSocket-specific interfaces
export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  isAuthenticated?: boolean;
  authTimestamp?: number;
}

export interface WebSocketEventData {
  query?: string;
  allergies?: string[];
  preferences?: string[];
  message?: string;
  iterations?: number;
  queries?: string[];
  roomId?: string;
  metadata?: Record<string, any>;
}

export interface WebSocketResponse {
  message: string;
  timestamp: number;
  userId?: string;
  version: string;
  error?: string;
  metadata?: Record<string, any>;
  type?: 'success' | 'error' | 'info' | 'stream_start' | 'stream_chunk' | 'stream_end';
}

export interface ConnectionStatus {
  authenticated: boolean;
  message: string;
  clientId: string;
  version: string;
  features: string[];
  user?: UserProfile;
  error?: string;
  timestamp: number;
  serverInfo?: {
    uptime: number;
    totalConnections: number;
    activeConnections: number;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  cookingLevel?: string;
  allergies?: string[];
  preferences?: string[];
  joinedAt: number;
}

export interface ClientConnectionInfo {
  socket: AuthenticatedSocket;
  user: UserProfile;
  connectedAt: number;
  lastActivity: number;
  messageCount: number;
  roomIds: Set<string>;
}

export interface WebSocketEventPayload<T = any> {
  data: T;
  userId?: string;
  timestamp: number;
  requestId?: string;
}

export interface StreamingResponse {
  id: string;
  type: 'start' | 'chunk' | 'end' | 'error';
  content: string;
  metadata?: {
    progress?: number;
    totalChunks?: number;
    currentChunk?: number;
    processingTime?: number;
  };
}

export interface BenchmarkResult {
  iteration: number;
  query: string;
  totalTime: number;
  metadata: any;
  hasGeneratedRecipe: boolean;
  responseLength: number;
  timestamp: number;
  userId: string;
  success: boolean;
  error?: string;
}

export interface LangGraphEventData extends WebSocketEventData {
  iterations?: number;
  queries?: string[];
  benchmarkConfig?: {
    maxIterations: number;
    timeout: number;
    collectMetrics: boolean;
  };
}

export interface ChatEventData extends WebSocketEventData {
  message: string;
  conversationId?: string;
  messageType?: 'text' | 'voice' | 'image';
  attachments?: Array<{
    type: string;
    url: string;
    metadata?: Record<string, any>;
  }>;
}

export interface StatusEventData {
  requestedComponents?: string[];
  includePerformanceMetrics?: boolean;
  includeSystemInfo?: boolean;
}

export interface WebSocketError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  requestId?: string;
}

export interface RateLimitInfo {
  requests: number;
  windowStart: number;
  windowSize: number;
  maxRequests: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  authenticatedConnections: number;
  averageSessionDuration: number;
  totalMessages: number;
  messagesPerSecond: number;
  errorRate: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    websocket: boolean;
    authentication: boolean;
    database: boolean;
    ai_service: boolean;
    langgraph: boolean;
  };
  metrics: ConnectionMetrics;
  timestamp: number;
  uptime: number;
}