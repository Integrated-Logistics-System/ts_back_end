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
import { EmbeddingModule } from './modules/embedding/embedding.module';

// ==================== Communication Domain ====================
import { WebsocketModule } from './modules/websocket/websocket.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    // ==================== Global Configuration ====================
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ==================== Core Infrastructure ====================
    DatabaseModule.forRoot(),
    CacheModule.forRoot({
      defaultTtl: 3600,
      maxMemoryKeys: 1000,
      chatHistoryMaxLength: 20,
      sessionTtl: 7200,
      enableRedis: process.env.REDIS_ENABLED !== 'false',
    }),

    // ==================== User Domain ====================
    UserModule,
    AuthModule,
    AllergenModule,

    // ==================== Recipe Domain ====================
    RecipeModule,
    ElasticsearchModule,

    // ==================== AI Domain ====================
    AiModule.forRoot({
      provider: 'ollama',
      config: {
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'gemma3n:e4b',
        timeout: 30000,
      },
    }),
    EmbeddingModule,
    LanggraphModule,

    // ==================== Communication Domain ====================
    ChatModule,
    WebsocketModule,
  ],
})
export class AppModule {}