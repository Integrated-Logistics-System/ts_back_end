// WebSocket 스트리밍 최적화 서비스
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { Server, Socket } from 'socket.io';

interface StreamingSession {
  sessionId: string;
  userId: string;
  socket: Socket;
  startTime: number;
  totalBytes: number;
  chunksCount: number;
  averageLatency: number;
  bufferHealth: number;
  compressionRatio: number;
  qualityMetrics: {
    dropRate: number;
    reconnections: number;
    bufferUnderruns: number;
  };
}

interface StreamingMetrics {
  activeStreams: number;
  totalBandwidth: number;
  averageLatency: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
  systemLoad: number;
  cacheHitRate: number;
}

interface AdaptiveStreamingConfig {
  targetLatency: number; // ms
  maxBandwidth: number; // bytes/s
  compressionLevel: 'low' | 'medium' | 'high' | 'adaptive';
  bufferSize: number; // chunks
  qualityThreshold: number; // 0-1
  adaptationSpeed: 'fast' | 'medium' | 'slow';
}

interface StreamChunk {
  id: string;
  sessionId: string;
  type: 'text' | 'json' | 'binary';
  data: any;
  timestamp: number;
  size: number;
  compressed?: boolean;
  priority: 'high' | 'medium' | 'low';
  metadata?: any;
}

@Injectable()
export class StreamingOptimizationService {
  private readonly logger = new Logger(StreamingOptimizationService.name);
  
  private activeSessions = new Map<string, StreamingSession>();
  private serverMetrics: StreamingMetrics = {
    activeStreams: 0,
    totalBandwidth: 0,
    averageLatency: 0,
    connectionQuality: 'good',
    systemLoad: 0,
    cacheHitRate: 0,
  };

  private readonly defaultConfig: AdaptiveStreamingConfig = {
    targetLatency: 100, // 100ms
    maxBandwidth: 1048576, // 1MB/s
    compressionLevel: 'adaptive',
    bufferSize: 10,
    qualityThreshold: 0.8,
    adaptationSpeed: 'medium',
  };

  constructor(private readonly cacheService: CacheService) {
    // 주기적으로 메트릭 업데이트 및 최적화 수행
    setInterval(() => this.performOptimization(), 5000);
    setInterval(() => this.updateSystemMetrics(), 1000);
  }

  /**
   * 최적화된 스트리밍 세션 시작
   */
  async startOptimizedStream(
    sessionId: string,
    userId: string,
    socket: Socket,
    config?: Partial<AdaptiveStreamingConfig>
  ): Promise<void> {
    try {
      const finalConfig = { ...this.defaultConfig, ...config };
      
      const session: StreamingSession = {
        sessionId,
        userId,
        socket,
        startTime: Date.now(),
        totalBytes: 0,
        chunksCount: 0,
        averageLatency: 0,
        bufferHealth: 1.0,
        compressionRatio: 1.0,
        qualityMetrics: {
          dropRate: 0,
          reconnections: 0,
          bufferUnderruns: 0,
        },
      };

      this.activeSessions.set(sessionId, session);
      this.serverMetrics.activeStreams++;

      // 클라이언트에 최적화 설정 전송
      socket.emit('streaming_config', {
        sessionId,
        config: finalConfig,
        optimizations: {
          compressionEnabled: true,
          adaptiveBitrate: true,
          priorityQueue: true,
          latencyOptimization: true,
        },
        timestamp: Date.now(),
      });

      this.logger.debug(`최적화된 스트리밍 세션 시작: ${sessionId} (사용자: ${userId})`);
    } catch (error) {
      this.logger.error(`스트리밍 세션 시작 실패: ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * 적응형 청크 전송
   */
  async sendAdaptiveChunk(
    sessionId: string,
    chunk: Omit<StreamChunk, 'id' | 'sessionId' | 'timestamp' | 'size'>
  ): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`세션을 찾을 수 없음: ${sessionId}`);
      return false;
    }

    try {
      const startTime = Date.now();
      
      // 청크 최적화
      const optimizedChunk = await this.optimizeChunk(chunk, session);
      
      // 네트워크 상태에 따른 전송 조정
      const shouldDelay = await this.shouldDelayTransmission(session);
      if (shouldDelay) {
        await this.delay(50); // 50ms 지연
      }

      // 압축 적용 (필요시)
      const finalChunk = await this.applyCompression(optimizedChunk, session);
      
      // 실제 전송
      session.socket.emit('streaming_chunk', {
        ...finalChunk,
        id: this.generateChunkId(),
        sessionId,
        timestamp: Date.now(),
        size: this.calculateChunkSize(finalChunk.data),
      });

      // 메트릭 업데이트
      const latency = Date.now() - startTime;
      this.updateSessionMetrics(session, finalChunk, latency);

      return true;
    } catch (error) {
      this.logger.error(`청크 전송 실패: ${sessionId}`, error);
      this.updateErrorMetrics(session);
      return false;
    }
  }

  /**
   * 스트리밍 품질 실시간 모니터링
   */
  async monitorStreamingQuality(sessionId: string): Promise<{
    quality: 'excellent' | 'good' | 'poor' | 'critical';
    metrics: {
      latency: number;
      throughput: number;
      errorRate: number;
      bufferHealth: number;
    };
    recommendations: string[];
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return {
        quality: 'critical',
        metrics: { latency: 0, throughput: 0, errorRate: 1, bufferHealth: 0 },
        recommendations: ['세션을 찾을 수 없습니다.'],
      };
    }

    const metrics = {
      latency: session.averageLatency,
      throughput: this.calculateThroughput(session),
      errorRate: session.qualityMetrics.dropRate,
      bufferHealth: session.bufferHealth,
    };

    const quality = this.assessStreamingQuality(metrics);
    const recommendations = this.generateOptimizationRecommendations(metrics, session);

    return { quality, metrics, recommendations };
  }

  /**
   * 동적 대역폭 조정
   */
  async adjustBandwidth(sessionId: string, targetBandwidth: number): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // 현재 대역폭 사용량 측정
      const currentBandwidth = this.calculateThroughput(session);
      
      if (currentBandwidth > targetBandwidth) {
        // 대역폭 제한 필요
        await this.enableBandwidthThrottling(session, targetBandwidth);
      } else {
        // 대역폭 증가 가능
        await this.disableBandwidthThrottling(session);
      }

      session.socket.emit('bandwidth_adjusted', {
        sessionId,
        currentBandwidth,
        targetBandwidth,
        timestamp: Date.now(),
      });

      this.logger.debug(`대역폭 조정: ${sessionId}, 목표: ${targetBandwidth} bytes/s`);
    } catch (error) {
      this.logger.error(`대역폭 조정 실패: ${sessionId}`, error);
    }
  }

  /**
   * 연결 품질 기반 자동 최적화
   */
  async autoOptimizeConnection(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const qualityMetrics = await this.monitorStreamingQuality(sessionId);
    
    switch (qualityMetrics.quality) {
      case 'critical':
        await this.applyCriticalOptimizations(session);
        break;
      case 'poor':
        await this.applyPoorQualityOptimizations(session);
        break;
      case 'good':
        await this.applyGoodQualityOptimizations(session);
        break;
      case 'excellent':
        await this.applyExcellentQualityOptimizations(session);
        break;
    }

    session.socket.emit('optimization_applied', {
      sessionId,
      quality: qualityMetrics.quality,
      optimizations: qualityMetrics.recommendations,
      timestamp: Date.now(),
    });
  }

  /**
   * 캐시 기반 스트리밍 최적화
   */
  async getCachedStream(
    key: string,
    generator: () => AsyncIterableIterator<any>
  ): Promise<AsyncIterableIterator<any>> {
    const cacheKey = `stream:${key}`;
    
    // 캐시 확인
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.serverMetrics.cacheHitRate = 0.9; // 캐시 히트율 업데이트
      return this.createStreamFromCache(cached as unknown as any[]);
    }

    // 캐시 미스 - 새로운 스트림 생성 후 캐싱
    const stream = generator();
    const cachedChunks: any[] = [];

    return this.createCachingStream(stream, cachedChunks, cacheKey);
  }

  /**
   * 스트리밍 세션 종료 및 정리
   */
  async endOptimizedStream(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // 세션 통계 수집
      const finalStats = {
        sessionId,
        duration: Date.now() - session.startTime,
        totalBytes: session.totalBytes,
        chunksCount: session.chunksCount,
        averageLatency: session.averageLatency,
        compressionRatio: session.compressionRatio,
        qualityMetrics: session.qualityMetrics,
      };

      // 클라이언트에 종료 통지
      session.socket.emit('streaming_ended', {
        sessionId,
        stats: finalStats,
        timestamp: Date.now(),
      });

      // 세션 정리
      this.activeSessions.delete(sessionId);
      this.serverMetrics.activeStreams--;

      // 통계 로깅
      this.logger.log(`스트리밍 세션 종료: ${sessionId}, 지속시간: ${finalStats.duration}ms, 총 바이트: ${finalStats.totalBytes}`);
    } catch (error) {
      this.logger.error(`스트리밍 세션 종료 실패: ${sessionId}`, error);
    }
  }

  /**
   * 시스템 전체 스트리밍 메트릭 조회
   */
  getSystemStreamingMetrics(): StreamingMetrics & {
    sessions: Array<{
      sessionId: string;
      userId: string;
      duration: number;
      throughput: number;
      quality: string;
    }>;
  } {
    const sessions = Array.from(this.activeSessions.values()).map(session => ({
      sessionId: session.sessionId,
      userId: session.userId,
      duration: Date.now() - session.startTime,
      throughput: this.calculateThroughput(session),
      quality: this.assessStreamingQuality({
        latency: session.averageLatency,
        throughput: this.calculateThroughput(session),
        errorRate: session.qualityMetrics.dropRate,
        bufferHealth: session.bufferHealth,
      }),
    }));

    return {
      ...this.serverMetrics,
      sessions,
    };
  }

  // Private helper methods
  private async performOptimization(): Promise<void> {
    try {
      // 모든 활성 세션에 대해 자동 최적화 수행
      for (const [sessionId] of this.activeSessions) {
        await this.autoOptimizeConnection(sessionId);
      }
    } catch (error) {
      this.logger.error('자동 최적화 수행 실패:', error);
    }
  }

  private updateSystemMetrics(): void {
    const sessions = Array.from(this.activeSessions.values());
    
    if (sessions.length === 0) {
      this.serverMetrics = {
        activeStreams: 0,
        totalBandwidth: 0,
        averageLatency: 0,
        connectionQuality: 'good',
        systemLoad: 0,
        cacheHitRate: this.serverMetrics.cacheHitRate,
      };
      return;
    }

    const totalBandwidth = sessions.reduce((sum, s) => sum + this.calculateThroughput(s), 0);
    const averageLatency = sessions.reduce((sum, s) => sum + s.averageLatency, 0) / sessions.length;
    const systemLoad = Math.min(sessions.length / 100, 1); // 간단한 시스템 로드 계산

    let connectionQuality: 'excellent' | 'good' | 'poor' | 'critical' = 'good';
    if (averageLatency < 50) connectionQuality = 'excellent';
    else if (averageLatency < 200) connectionQuality = 'good';
    else if (averageLatency < 500) connectionQuality = 'poor';
    else connectionQuality = 'critical';

    this.serverMetrics = {
      activeStreams: sessions.length,
      totalBandwidth,
      averageLatency,
      connectionQuality,
      systemLoad,
      cacheHitRate: this.serverMetrics.cacheHitRate,
    };
  }

  private async optimizeChunk(chunk: any, session: StreamingSession): Promise<any> {
    // 청크 크기에 따른 분할
    if (this.calculateChunkSize(chunk.data) > 8192) { // 8KB 초과시 분할
      return this.splitChunk(chunk);
    }

    // 우선순위에 따른 처리
    if (chunk.priority === 'high') {
      return { ...chunk, expedited: true };
    }

    return chunk;
  }

  private async shouldDelayTransmission(session: StreamingSession): Promise<boolean> {
    // 네트워크 상태 및 버퍼 상태 확인
    return session.bufferHealth < 0.3 || session.averageLatency > 500;
  }

  private async applyCompression(chunk: any, session: StreamingSession): Promise<any> {
    if (chunk.type === 'text' && this.calculateChunkSize(chunk.data) > 1024) {
      // 텍스트 압축 적용 (실제로는 gzip 등 사용)
      const compressed = this.compressText(chunk.data);
      session.compressionRatio = chunk.data.length / compressed.length;
      return { ...chunk, data: compressed, compressed: true };
    }
    return chunk;
  }

  private updateSessionMetrics(session: StreamingSession, chunk: any, latency: number): void {
    session.chunksCount++;
    session.totalBytes += this.calculateChunkSize(chunk.data);
    session.averageLatency = (session.averageLatency * (session.chunksCount - 1) + latency) / session.chunksCount;
    
    // 버퍼 건강도 업데이트 (간단한 휴리스틱)
    if (latency < 100) {
      session.bufferHealth = Math.min(session.bufferHealth + 0.1, 1.0);
    } else if (latency > 300) {
      session.bufferHealth = Math.max(session.bufferHealth - 0.1, 0.0);
    }
  }

  private updateErrorMetrics(session: StreamingSession): void {
    session.qualityMetrics.dropRate += 0.01;
  }

  private calculateThroughput(session: StreamingSession): number {
    const duration = (Date.now() - session.startTime) / 1000; // seconds
    return duration > 0 ? session.totalBytes / duration : 0;
  }

  private assessStreamingQuality(metrics: any): 'excellent' | 'good' | 'poor' | 'critical' {
    if (metrics.latency < 50 && metrics.errorRate < 0.01 && metrics.bufferHealth > 0.8) {
      return 'excellent';
    } else if (metrics.latency < 200 && metrics.errorRate < 0.05 && metrics.bufferHealth > 0.5) {
      return 'good';
    } else if (metrics.latency < 500 && metrics.errorRate < 0.1 && metrics.bufferHealth > 0.2) {
      return 'poor';
    } else {
      return 'critical';
    }
  }

  private generateOptimizationRecommendations(metrics: any, session: StreamingSession): string[] {
    const recommendations: string[] = [];
    
    if (metrics.latency > 200) {
      recommendations.push('네트워크 지연 시간이 높습니다. 압축 레벨을 높이세요.');
    }
    
    if (metrics.errorRate > 0.05) {
      recommendations.push('오류율이 높습니다. 재전송 메커니즘을 활성화하세요.');
    }
    
    if (metrics.bufferHealth < 0.5) {
      recommendations.push('버퍼 언더런이 발생하고 있습니다. 버퍼 크기를 늘리세요.');
    }
    
    if (metrics.throughput > 1048576) { // 1MB/s
      recommendations.push('대역폭 사용량이 높습니다. 적응형 비트레이트를 활성화하세요.');
    }

    return recommendations;
  }

  private async applyCriticalOptimizations(session: StreamingSession): Promise<void> {
    // 최대 압축 적용
    // 전송 속도 제한
    // 우선순위 높은 청크만 전송
  }

  private async applyPoorQualityOptimizations(session: StreamingSession): Promise<void> {
    // 적절한 압축 적용
    // 버퍼 크기 조정
  }

  private async applyGoodQualityOptimizations(session: StreamingSession): Promise<void> {
    // 기본 최적화 유지
  }

  private async applyExcellentQualityOptimizations(session: StreamingSession): Promise<void> {
    // 품질 향상을 위한 최적화
    // 더 높은 비트레이트 허용
  }

  private async enableBandwidthThrottling(session: StreamingSession, targetBandwidth: number): Promise<void> {
    // 대역폭 제한 로직 구현
  }

  private async disableBandwidthThrottling(session: StreamingSession): Promise<void> {
    // 대역폭 제한 해제 로직 구현
  }

  private async *createStreamFromCache(cached: any[]): AsyncIterableIterator<any> {
    for (const item of cached) {
      yield item;
      await this.delay(10); // 자연스러운 스트리밍 시뮬레이션
    }
  }

  private async *createCachingStream(
    stream: AsyncIterableIterator<any>,
    cachedChunks: any[],
    cacheKey: string
  ): AsyncIterableIterator<any> {
    try {
      for await (const chunk of stream) {
        cachedChunks.push(chunk);
        yield chunk;
      }
      
      // 스트림 완료 후 캐싱
      await this.cacheService.set(cacheKey, cachedChunks, 300); // 5분 캐싱
    } catch (error) {
      this.logger.error('스트림 캐싱 중 오류:', error);
      throw error;
    }
  }

  private generateChunkId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateChunkSize(data: any): number {
    return JSON.stringify(data).length;
  }

  private splitChunk(chunk: any): any {
    // 큰 청크를 작은 청크들로 분할하는 로직
    return chunk; // 간단한 구현
  }

  private compressText(text: string): string {
    // 실제로는 gzip 등의 압축 알고리즘 사용
    return text; // 간단한 구현
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}