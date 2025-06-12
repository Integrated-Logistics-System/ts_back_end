import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(private configService: ConfigService) {
    this.client = createClient({
      url: this.configService.get('REDIS_URL'),
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis 클라이언트 오류:', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis 연결 성공');
    });

    this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error('Redis 연결 실패:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Redis GET 실패 (${key}):`, error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.client.set(key, value);
    } catch (error) {
      this.logger.error(`Redis SET 실패 (${key}):`, error);
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    try {
      await this.client.setEx(key, seconds, value);
    } catch (error) {
      this.logger.error(`Redis SETEX 실패 (${key}):`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Redis DEL 실패 (${key}):`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS 실패 (${key}):`, error);
      return false;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      this.logger.error(`Redis HGET 실패 (${key}:${field}):`, error);
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hSet(key, field, value);
    } catch (error) {
      this.logger.error(`Redis HSET 실패 (${key}:${field}):`, error);
    }
  }
}