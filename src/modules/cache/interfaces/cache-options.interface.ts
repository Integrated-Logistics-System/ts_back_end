export interface CacheOptionsInterface {
    // Redis 설정
    redisUrl?: string;
    redisHost?: string;
    redisPort?: number;
    redisPassword?: string;
    redisDb?: number;
    redisConnectTimeout?: number;

    // 캐시 설정
    defaultTtl?: number; // 기본 TTL (초)
    maxMemoryKeys?: number; // 메모리 모드에서 최대 키 수
    enableRedis?: boolean; // Redis 사용 여부

    // 채팅 캐시 설정
    chatHistoryMaxLength?: number; // 채팅 히스토리 최대 길이
    sessionTtl?: number; // 세션 TTL
}