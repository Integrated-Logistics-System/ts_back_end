import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { CacheOptionsInterface } from './interfaces/cache-options.interface';
import { CACHE_OPTIONS_TOKEN } from './cache.constants';
import Redis from 'ioredis';

interface MemoryStore {
    [key: string]: {
        value: unknown;
        ttl?: number;
        timestamp: number;
    };
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CacheService.name);
    private memoryStore: MemoryStore = {};
    private cleanupInterval: NodeJS.Timeout | null = null;
    private useRedis = false;
    private redisClient: Redis | null = null;

    constructor(
        @Inject(CACHE_OPTIONS_TOKEN)
        private readonly options: CacheOptionsInterface,
    ) {}

    async onModuleInit() {
        await this.initialize();
    }

    private async initialize() {
        const enableRedis = this.options.enableRedis ?? false;

        if (enableRedis) {
            try {
                await this.connectRedis();
            } catch (error: unknown) {
                this.logger.warn('Redis connection failed, falling back to memory store', error instanceof Error ? error.message : 'Unknown error');
                this.useRedis = false;
            }
        } else {
            this.logger.log('🗄️ Using memory-based cache store');
            this.useRedis = false;
        }

        this.setupMemoryStore();
    }

    private async connectRedis() {
        try {
            this.redisClient = new Redis({
                host: this.options.redisHost,
                port: this.options.redisPort,
                password: this.options.redisPassword,
                db: this.options.redisDb,
                connectTimeout: this.options.redisConnectTimeout || 10000,
                maxRetriesPerRequest: null,
            });

            this.redisClient.on('connect', () => {
                this.logger.log('✅ Redis connected');
                this.useRedis = true;
            });

            this.redisClient.on('error', (err) => {
                this.logger.error('❌ Redis error:', err);
                this.useRedis = false;
                this.redisClient?.disconnect();
            });

            // Redis 연결을 기다림
            await new Promise<void>((resolve, reject) => {
                this.redisClient?.on('ready', resolve);
                this.redisClient?.on('error', reject);
            });
        } catch (error: unknown) {
            this.logger.error('Redis connection failed:', error instanceof Error ? error.message : 'Unknown error');
            this.useRedis = false;
            throw error; // 연결 실패 시 에러를 다시 던져서 initializeConnection에서 처리
        }
    }

    private setupMemoryStore() {
        this.logger.log('🗄️ Setting up memory-based cache storage');

        // 메모리 정리 작업 (5분마다)
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredKeys();
        }, 5 * 60 * 1000);
    }

    private cleanupExpiredKeys() {
        const now = Date.now();
        let cleanedCount = 0;
        const maxKeys = this.options.maxMemoryKeys || 1000;

        // TTL 만료된 키 제거
        for (const [key, item] of Object.entries(this.memoryStore)) {
            if (item.ttl && (now - item.timestamp) > (item.ttl * 1000)) {
                delete this.memoryStore[key];
                cleanedCount++;
            }
        }

        // 최대 키 수 초과 시 오래된 키 제거
        const keys = Object.keys(this.memoryStore);
        if (keys.length > maxKeys) {
            const sortedKeys = keys
                .map(key => ({ key, timestamp: this.memoryStore[key]?.timestamp || 0 }))
                .sort((a, b) => a.timestamp - b.timestamp)
                .slice(0, keys.length - maxKeys);

            sortedKeys.forEach(({ key }) => {
                delete this.memoryStore[key];
                cleanedCount++;
            });
        }

        if (cleanedCount > 0) {
            this.logger.debug(`🧹 Cleaned up ${cleanedCount} keys from cache`);
        }
    }

    isReady(): boolean {
        return this.useRedis ?
            Boolean(this.redisClient && 'status' in this.redisClient && (this.redisClient as Redis).status === 'ready') :
            true;
    }

    isRedisEnabled(): boolean {
        return this.useRedis;
    }

    getRedisClient(): object | null {
        return this.redisClient;
    }

    async set<T = string>(key: string, value: T, ttl?: number): Promise<void> {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        const cacheTtl = ttl || this.options.defaultTtl;

        try {
            if (this.useRedis && this.redisClient) {
                if (cacheTtl) {
                    await this.redisClient.setex(key, cacheTtl, stringValue);
                } else {
                    await this.redisClient.set(key, stringValue);
                }
            } else {
                this.memoryStore[key] = {
                    value: stringValue,
                    ttl: cacheTtl,
                    timestamp: Date.now(),
                };
            }
        } catch (error: unknown) {
            this.logger.warn(`Cache set error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
            // Redis 에러 시 메모리로 폴백
            this.memoryStore[key] = {
                value: stringValue,
                ttl: cacheTtl,
                timestamp: Date.now(),
            };
        }
    }

    async get<T = string>(key: string): Promise<T | null> {
        try {
            let result: string | null = null;
            
            if (this.useRedis && this.redisClient) {
                result = await this.redisClient.get(key);
            } else {
                const item = this.memoryStore[key];
                if (!item) return null;

                // TTL 체크
                if (item.ttl && (Date.now() - item.timestamp) > (item.ttl * 1000)) {
                    delete this.memoryStore[key];
                    return null;
                }

                result = item.value as string;
            }
            
            if (result === null) return null;
            
            // T가 string인 경우 그대로 반환, 아니면 JSON.parse 시도
            try {
                return (typeof result === 'string' && result !== 'null') ? JSON.parse(result) as T : result as T;
            } catch {
                // JSON.parse 실패 시 문자열 그대로 반환
                return result as T;
            }
        } catch (error: unknown) {
            this.logger.warn(`Cache get error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }

    async del(key: string): Promise<void> {
        try {
            if (this.useRedis && this.redisClient) {
                await this.redisClient.del(key);
            } else {
                delete this.memoryStore[key];
            }
        } catch (error: unknown) {
            this.logger.warn(`Cache delete error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
            delete this.memoryStore[key];
        }
    }

    async delete(key: string): Promise<void> {
        return this.del(key);
    }

    async getKeysPattern(pattern: string): Promise<string[]> {
        try {
            if (this.useRedis && this.redisClient && 'keys' in this.redisClient) {
                return await (this.redisClient as Redis).keys(pattern);
            } else {
                // Memory store에서 패턴 매칭
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return Object.keys(this.memoryStore).filter(key => regex.test(key));
            }
        } catch (error: unknown) {
            this.logger.warn(`Cache getKeysPattern error for pattern ${pattern}:`, error instanceof Error ? error.message : 'Unknown error');
            return [];
        }
    }

    async deleteMany(keys: string[]): Promise<void> {
        try {
            if (this.useRedis && this.redisClient && keys.length > 0) {
                await this.redisClient.del(...keys);
            } else {
                keys.forEach(key => delete this.memoryStore[key]);
            }
        } catch (error: unknown) {
            this.logger.warn(`Cache deleteMany error:`, error instanceof Error ? error.message : 'Unknown error');
            keys.forEach(key => delete this.memoryStore[key]);
        }
    }

    // 채팅 히스토리 전용 메서드들
    async addChatMessage(userId: string, message: string): Promise<void> {
        const key = `chat_history:${userId}`;
        const maxLength = this.options.chatHistoryMaxLength || 20;

        try {
            if (this.useRedis && this.redisClient && 'lpush' in this.redisClient && 'ltrim' in this.redisClient && 'expire' in this.redisClient) {
                await (this.redisClient as Redis).lpush(key, message);
                await (this.redisClient as Redis).ltrim(key, 0, maxLength - 1);
                if (this.options.sessionTtl) {
                    await (this.redisClient as Redis).expire(key, this.options.sessionTtl);
                }
            } else {
                // 메모리에서 채팅 히스토리 관리
                const existing = this.memoryStore[key];
                let messages: string[] = [];

                if (existing && Array.isArray(existing.value)) {
                    messages = existing.value as string[];
                }

                messages.unshift(message);
                if (messages.length > maxLength) {
                    messages = messages.slice(0, maxLength);
                }

                this.memoryStore[key] = {
                    value: messages,
                    ttl: this.options.sessionTtl,
                    timestamp: Date.now(),
                };
            }
        } catch (error: unknown) {
            this.logger.warn(`Chat history add error for user ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
        }
    }

    async getChatHistory(userId: string, limit = 20): Promise<string[]> {
        const key = `chat_history:${userId}`;

        try {
            if (this.useRedis && this.redisClient && 'lrange' in this.redisClient) {
                return await (this.redisClient as Redis).lrange(key, 0, limit - 1);
            } else {
                const item = this.memoryStore[key];
                if (!item || !Array.isArray(item.value)) return [];

                // TTL 체크
                if (item.ttl && (Date.now() - item.timestamp) > (item.ttl * 1000)) {
                    delete this.memoryStore[key];
                    return [];
                }

                const messages = item.value as string[];
                return messages.slice(0, limit);
            }
        } catch (error: unknown) {
            this.logger.warn(`Chat history get error for user ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
            return [];
        }
    }

    async clearChatHistory(userId: string): Promise<void> {
        const key = `chat_history:${userId}`;
        await this.del(key);
    }

    // 세션 관리
    async setSession(sessionId: string, data: unknown): Promise<void> {
        const key = `session:${sessionId}`;
        const sessionTtl = this.options.sessionTtl || 3600; // 1시간 기본값

        await this.set(key, JSON.stringify(data), sessionTtl);
    }

    async getSession(sessionId: string): Promise<unknown | null> {
        const key = `session:${sessionId}`;
        const data = await this.get(key);

        try {
            return data ? JSON.parse(data) : null;
        } catch (error: unknown) {
            this.logger.warn(`Session parse error for ${sessionId}:`, error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }

    async deleteSession(sessionId: string): Promise<void> {
        const key = `session:${sessionId}`;
        await this.del(key);
    }

    // 캐시 상태 확인 (디버그용)
    getCacheStats() {
        const keys = Object.keys(this.memoryStore);
        const size = JSON.stringify(this.memoryStore).length;

        return {
            keyCount: keys.length,
            estimatedSize: `${Math.round(size / 1024)}KB`,
            usingRedis: this.useRedis,
            redisStatus: (this.redisClient && 'status' in this.redisClient) ? (this.redisClient as Redis).status : 'not connected',
            maxMemoryKeys: this.options.maxMemoryKeys || 1000,
            defaultTtl: this.options.defaultTtl || 'none',
        };
    }

    async onModuleDestroy() {
        try {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }

            if (this.redisClient && 'quit' in this.redisClient) {
                try {
                    await (this.redisClient as Redis).quit();
                    this.logger.log('Redis connection closed gracefully');
                } catch (error: unknown) {
                    this.logger.warn('Error closing Redis connection:', error instanceof Error ? error.message : 'Unknown error');
                }
            }

            this.memoryStore = {};
            this.logger.log('Cache service cleaned up');

        } catch (error: unknown) {
            this.logger.error('Error during cache service cleanup:', error instanceof Error ? error.message : 'Unknown error');
        }
    }
}