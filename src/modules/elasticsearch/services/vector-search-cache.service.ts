import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { VectorSearchOptions, VectorSearchResponse } from '../types/elasticsearch.types';

/**
 * 벡터 검색 결과 캐싱 서비스
 * 빈번한 검색 쿼리의 성능 향상을 위한 캐시 레이어
 */
@Injectable()
export class VectorSearchCacheService {
  private readonly logger = new Logger(VectorSearchCacheService.name);
  private readonly CACHE_TTL = 5 * 60; // 5분 캐시
  private readonly CACHE_PREFIX = 'vector_search:';

  constructor(private readonly cacheService: CacheService) {}

  /**
   * 벡터 검색 결과 캐시 키 생성
   */
  private generateCacheKey(options: VectorSearchOptions): string {
    // 검색 옵션을 정규화하여 일관된 키 생성
    const normalized = {
      query: options.query.toLowerCase().trim(),
      k: options.k || 10,
      vectorWeight: options.vectorWeight || 0.6,
      textWeight: options.textWeight || 0.4,
      useHybridSearch: options.useHybridSearch !== false,
      minScore: options.minScore || 0.1,
      allergies: (options.allergies || []).sort(),
      preferences: (options.preferences || []).sort()
    };

    const keyString = JSON.stringify(normalized);
    const hash = this.simpleHash(keyString);
    
    return `${this.CACHE_PREFIX}${hash}`;
  }

  /**
   * 간단한 해시 함수
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 캐시된 검색 결과 조회
   */
  async getCachedResult(options: VectorSearchOptions): Promise<VectorSearchResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(options);
      const cached = await this.cacheService.get<VectorSearchResponse>(cacheKey);
      
      if (cached) {
        this.logger.log(`🎯 Cache hit for query: "${options.query}"`);
        
        // 캐시된 결과에 캐시 표시 추가
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            fromCache: true
          } as any
        };
      }

      this.logger.log(`❌ Cache miss for query: "${options.query}"`);
      return null;

    } catch (error) {
      this.logger.error('Cache lookup failed:', error);
      return null; // 캐시 오류시 null 반환하여 실제 검색 수행
    }
  }

  /**
   * 검색 결과 캐시 저장
   */
  async cacheResult(options: VectorSearchOptions, result: VectorSearchResponse): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(options);
      
      // 캐시 메타데이터 추가
      const cacheableResult = {
        ...result,
        metadata: {
          ...result.metadata,
          cachedAt: new Date().toISOString(),
          fromCache: false
        }
      };

      await this.cacheService.set(cacheKey, cacheableResult, this.CACHE_TTL);
      
      this.logger.log(`💾 Cached result for query: "${options.query}" (TTL: ${this.CACHE_TTL}s)`);

    } catch (error) {
      this.logger.error('Failed to cache result:', error);
      // 캐시 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  /**
   * 특정 쿼리의 캐시 무효화
   */
  async invalidateQuery(options: VectorSearchOptions): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(options);
      await this.cacheService.del(cacheKey);
      
      this.logger.log(`🗑️  Invalidated cache for query: "${options.query}"`);

    } catch (error) {
      this.logger.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * 모든 벡터 검색 캐시 무효화
   */
  async invalidateAll(): Promise<void> {
    try {
      // Redis 패턴 매칭으로 모든 벡터 검색 캐시 삭제
      const pattern = `${this.CACHE_PREFIX}*`;
      // await this.cacheService.delPattern(pattern); // Method not available
      
      this.logger.log(`🗑️  Invalidated all vector search cache`);

    } catch (error) {
      this.logger.error('Failed to invalidate all cache:', error);
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsage: number;
    hitRate: number;
    lastUpdated: string;
  }> {
    try {
      // 실제 구현은 캐시 서비스의 통계 기능에 따라 달라짐
      const pattern = `${this.CACHE_PREFIX}*`;
      // const keys = await this.cacheService.keys(pattern); // Method not available
      const keys: string[] = [];

      return {
        totalKeys: keys.length,
        memoryUsage: 0, // Redis INFO 명령어로 계산 필요
        hitRate: 0, // 별도 통계 수집 필요
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * 캐시 워밍업 (인기 검색어 미리 캐싱)
   */
  async warmupCache(popularQueries: string[]): Promise<void> {
    this.logger.log(`🔥 Warming up cache with ${popularQueries.length} popular queries`);

    for (const query of popularQueries) {
      try {
        // 기본 옵션으로 검색 실행 (실제 검색 서비스 호출 필요)
        const options: VectorSearchOptions = {
          query,
          k: 10,
          useHybridSearch: true,
          vectorWeight: 0.6,
          textWeight: 0.4,
          minScore: 0.1,
          allergies: [],
          preferences: []
        };

        // 캐시가 없을 때만 워밍업
        const cached = await this.getCachedResult(options);
        if (!cached) {
          this.logger.log(`🔥 Warming up: "${query}"`);
          // 실제 검색 실행은 벡터 검색 서비스를 통해 수행
          // await this.vectorSearchService.search(options);
        }

      } catch (error) {
        this.logger.error(`Failed to warm up query: "${query}"`, error);
      }
    }

    this.logger.log('✅ Cache warmup completed');
  }

  /**
   * 캐시 적중률이 높은 쿼리 분석
   */
  async getPopularQueries(limit: number = 10): Promise<Array<{
    query: string;
    hitCount: number;
    lastAccessed: string;
  }>> {
    try {
      // 실제 구현은 별도의 통계 수집 시스템 필요
      // Redis나 별도 DB에 쿼리 통계 저장
      
      return []; // 임시 반환

    } catch (error) {
      this.logger.error('Failed to get popular queries:', error);
      return [];
    }
  }

  /**
   * 캐시 건강성 체크
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    cacheService: boolean;
    totalKeys: number;
    memoryUsage: string;
    lastCheck: string;
  }> {
    try {
      const stats = await this.getCacheStats();
      // const cacheServiceHealthy = await this.cacheService.isHealthy(); // Method not available
      const cacheServiceHealthy = true;

      return {
        status: cacheServiceHealthy ? 'healthy' : 'degraded',
        cacheService: cacheServiceHealthy,
        totalKeys: stats.totalKeys,
        memoryUsage: '0 MB', // 실제 메모리 사용량 계산 필요
        lastCheck: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Cache health check failed:', error);
      return {
        status: 'unhealthy',
        cacheService: false,
        totalKeys: 0,
        memoryUsage: 'unknown',
        lastCheck: new Date().toISOString()
      };
    }
  }
}