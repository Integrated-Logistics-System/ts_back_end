import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// ==================== Core Infrastructure ====================
import { DatabaseModule } from './modules/database/database.module';
import { CacheModule } from './modules/cache/cache.module';

// ==================== User Domain ====================
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { AllergenModule } from './modules/allergen/allergen.module';

// ==================== Recipe Domain ====================
import { RecipeModule } from './modules/recipe/recipe.module';
import { ElasticsearchModule } from './modules/elasticsearch/elasticsearch.module';

// ==================== AI Domain ====================
import { AiModule } from './modules/ai/ai.module';
import { LanggraphModule } from './modules/langgraph/langgraph.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';

// ==================== Communication Domain ====================
import { WebsocketModule } from './modules/websocket/websocket.module';

@Module({
  imports: [
    // ==================== Global Configuration ====================
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ==================== Core Infrastructure (Global Services) ====================
    DatabaseModule.forRoot(),
    CacheModule.forRoot({
      defaultTtl: 3600,                    // 1시간 기본 TTL
      maxMemoryKeys: 1000,                 // 메모리 캐시 최대 키 수
      chatHistoryMaxLength: 20,            // 채팅 히스토리 최대 메시지 수
      sessionTtl: 7200,                    // 세션 TTL (2시간)
      enableRedis: process.env.REDIS_ENABLED === 'true', // Redis 백엔드 활성화 여부 (환경 변수 기반)
    }),

    // ==================== User Domain ====================
    UserModule,                           // 사용자 프로필 관리
    AuthModule,                           // JWT 인증 및 권한 관리
    AllergenModule,                       // 알레르기 타입 관리 (간단한 상수 데이터)

    // ==================== Recipe Domain ====================
    RecipeModule,                         // 레시피 CRUD + 검색 + 메타데이터
    ElasticsearchModule,                  // 고성능 레시피 검색 + 알레르기 필터링

    // ==================== AI Domain ====================
    AiModule.forRoot({
      provider: 'ollama',
      config: {
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'gemma2:2b',
        timeout: 30000,
      },
    }),                                   // 통합 AI 서비스 (Ollama)
    EmbeddingModule,                      // nomic-embed-text 임베딩 생성 서비스
    LanggraphModule,                      // LangGraph 기반 워크플로우 시스템
    ConversationModule,                   // ChatGPT 스타일 대화형 AI 어시스턴트

    // ==================== Communication Domain ====================
    WebsocketModule,                      // 실시간 AI 채팅 시스템
  ],
})
export class AppModule {}
