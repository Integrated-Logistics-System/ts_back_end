import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

// Redis 대신 메모리 기반 저장소 사용 (에러 방지)
interface MemoryStore {
  [key: string]: {
    value: unknown;
    ttl?: number;
    timestamp: number;
  };
}

// Redis 클라이언트 타입 정의
interface RedisClient {
  status: string;
  setex: (key: string, seconds: number, value: string) => Promise<void>;
  set: (key: string, value: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<void>;
  lpush: (key: string, value: string) => Promise<void>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  ltrim: (key: string, start: number, stop: number) => Promise<void>;
  expire: (key: string, seconds: number) => Promise<void>;
  sadd: (key: string, value: string) => Promise<void>;
  smembers: (key: string) => Promise<string[]>;
  srem: (key: string, value: string) => Promise<void>;
  lindex: (key: string, index: number) => Promise<string | null>;
  quit: () => Promise<void>;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private memoryStore: MemoryStore = {};
  private cleanupInterval: NodeJS.Timeout | null = null;
  private useRedis = false;
  private redisClient: RedisClient | null = null;

  async onModuleInit() {
    await this.initialize();
  }

  private async initialize() {
    try {
      // Redis 연결 시도
      const Redis = await this.importRedis();
      if (Redis && process.env.REDIS_URL) {
        this.redisClient = new Redis(process.env.REDIS_URL) as unknown as RedisClient;
        this.useRedis = true;
        this.logger.log('✅ Redis connected successfully');
      } else {
        throw new Error('Redis not available');
      }
    } catch (error) {
      this.logger.warn('⚠️ Redis connection failed, using memory store:', error instanceof Error ? error.message : 'Unknown error');
      this.useRedis = false;
    }
    
    this.setupMemoryStore();
  }

  private async importRedis() {
    try {
      const Redis = await import('ioredis');
      return Redis.default;
    } catch {
      this.logger.warn('⚠️ ioredis package not available');
      return null;
    }
  }

  private setupMemoryStore() {
    this.logger.log('📝 Setting up memory-based storage');
    
    // 메모리 정리 작업 (5분마다)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredKeys();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredKeys() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of Object.entries(this.memoryStore)) {
      if (item.ttl && (now - item.timestamp) > (item.ttl * 1000)) {
        delete this.memoryStore[key];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`🧹 Cleaned up ${cleanedCount} expired keys from memory store`);
    }
  }

  isReady(): boolean {
    if (this.useRedis) {
      return this.redisClient?.status === 'ready';
    }
    return true; // 메모리 저장소는 항상 준비됨
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        if (ttl) {
          await this.redisClient.setex(key, ttl, value);
        } else {
          await this.redisClient.set(key, value);
        }
      } else {
        // 메모리 저장소에 저장
        this.memoryStore[key] = {
          value,
          ttl,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      this.logger.warn(`Storage set error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
      // Redis 에러 시 메모리로 폴백
      this.memoryStore[key] = {
        value,
        ttl,
        timestamp: Date.now(),
      };
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.useRedis && this.redisClient) {
        return await this.redisClient.get(key);
      } else {
        // 메모리 저장소에서 조회
        const item = this.memoryStore[key];
        if (!item) return null;

        // TTL 체크
        if (item.ttl && (Date.now() - item.timestamp) > (item.ttl * 1000)) {
          delete this.memoryStore[key];
          return null;
        }

        return typeof item.value === 'string' ? item.value : null;
      }
    } catch (error) {
      this.logger.warn(`Storage get error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
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
    } catch (error) {
      this.logger.warn(`Storage delete error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
      delete this.memoryStore[key];
    }
  }

  async lpush(key: string, value: string): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.lpush(key, value);
      } else {
        // 메모리에서 리스트 에뮬레이션
        const existing = this.memoryStore[key];
        let list: string[] = [];
        
        if (existing && Array.isArray(existing.value)) {
          list = existing.value as string[];
        }
        
        list.unshift(value);
        this.memoryStore[key] = {
          value: list,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      this.logger.warn(`Storage lpush error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      if (this.useRedis && this.redisClient) {
        return await this.redisClient.lrange(key, start, stop);
      } else {
        // 메모리에서 리스트 범위 조회
        const item = this.memoryStore[key];
        if (!item || !Array.isArray(item.value)) return [];
        
        const list = item.value as string[];
        if (stop === -1) {
          return list.slice(start);
        }
        return list.slice(start, stop + 1);
      }
    } catch (error) {
      this.logger.warn(`Storage lrange error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.ltrim(key, start, stop);
      } else {
        // 메모리에서 리스트 트림
        const item = this.memoryStore[key];
        if (item && Array.isArray(item.value)) {
          const list = item.value as string[];
          const trimmed = list.slice(start, stop + 1);
          this.memoryStore[key] = {
            ...item,
            value: trimmed,
          };
        }
      }
    } catch (error) {
      this.logger.warn(`Storage ltrim error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.expire(key, seconds);
      } else {
        // 메모리에서 TTL 설정
        const item = this.memoryStore[key];
        if (item) {
          this.memoryStore[key] = {
            ...item,
            ttl: seconds,
            timestamp: Date.now(),
          };
        }
      }
    } catch (error) {
      this.logger.warn(`Storage expire error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async sadd(key: string, value: string): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.sadd(key, value);
      } else {
        // 메모리에서 Set 에뮬레이션
        const existing = this.memoryStore[key];
        let set: Set<string> = new Set();
        
        if (existing && existing.value instanceof Set) {
          set = existing.value as Set<string>;
        } else if (existing && Array.isArray(existing.value)) {
          set = new Set(existing.value as string[]);
        }
        
        set.add(value);
        this.memoryStore[key] = {
          value: set,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      this.logger.warn(`Storage sadd error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      if (this.useRedis && this.redisClient) {
        return await this.redisClient.smembers(key);
      } else {
        // 메모리에서 Set 멤버 조회
        const item = this.memoryStore[key];
        if (!item) return [];
        
        if (item.value instanceof Set) {
          return Array.from(item.value as Set<string>);
        } else if (Array.isArray(item.value)) {
          return item.value as string[];
        }
        
        return [];
      }
    } catch (error) {
      this.logger.warn(`Storage smembers error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  async srem(key: string, value: string): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.srem(key, value);
      } else {
        // 메모리에서 Set 요소 제거
        const item = this.memoryStore[key];
        if (item && item.value instanceof Set) {
          (item.value as Set<string>).delete(value);
        }
      }
    } catch (error) {
      this.logger.warn(`Storage srem error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async lindex(key: string, index: number): Promise<string | null> {
    try {
      if (this.useRedis && this.redisClient) {
        return await this.redisClient.lindex(key, index);
      } else {
        // 메모리에서 리스트 인덱스 조회
        const item = this.memoryStore[key];
        if (!item || !Array.isArray(item.value)) return null;
        
        const list = item.value as string[];
        if (index < 0) {
          // 음수 인덱스 처리
          const realIndex = list.length + index;
          return realIndex >= 0 ? (list[realIndex] ?? null) : null;
        }
        
        return list[index] ?? null;
      }
    } catch (error) {
      this.logger.warn(`Storage lindex error for key ${key}:`, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  // 메모리 저장소 상태 확인 (디버그용)
  getMemoryStoreStats() {
    const keys = Object.keys(this.memoryStore);
    const size = JSON.stringify(this.memoryStore).length;
    
    return {
      keyCount: keys.length,
      estimatedSize: `${Math.round(size / 1024)}KB`,
      usingRedis: this.useRedis,
      redisStatus: this.redisClient?.status ?? 'not connected',
      keys: keys.slice(0, 10), // 처음 10개 키만
    };
  }

  async onModuleDestroy() {
    try {
      // 정리 작업 중지
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Redis 연결 종료
      if (this.redisClient) {
        try {
          await this.redisClient.quit();
          this.logger.log('Redis connection closed gracefully');
        } catch (error) {
          this.logger.warn('Error closing Redis connection:', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // 메모리 저장소 정리
      this.memoryStore = {};
      this.logger.log('Memory store cleaned up');
      
    } catch (error) {
      this.logger.error('Error during Redis service cleanup:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
