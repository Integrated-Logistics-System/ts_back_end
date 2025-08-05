import { Module } from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';

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
    CacheModule.registerAsync({ // forRoot 대신 registerAsync 사용
      imports: [ConfigModule], // ConfigModule import
      inject: [ConfigService], // ConfigService 주입
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        let enableRedis = configService.get<string>('REDIS_ENABLED') !== 'false';

        let redisHost: string | undefined;
        let redisPort: number | undefined;
        let redisPassword: string | undefined;
        let redisDb: number | undefined;

        if (redisUrl) {
          try {
            const url = new URL(redisUrl);
            redisHost = url.hostname;
            redisPort = url.port ? parseInt(url.port, 10) : undefined;
            redisPassword = url.password || undefined;
            redisDb = url.pathname ? parseInt(url.pathname.substring(1), 10) : undefined;
          } catch (error) {
            console.warn(`Invalid REDIS_URL: ${redisUrl}. Falling back to default or memory cache.`, error);
            // 유효하지 않은 URL인 경우 Redis 비활성화
            enableRedis = false;
          }
        }

        return {
          defaultTtl: 3600,
          maxMemoryKeys: 1000,
          chatHistoryMaxLength: 20,
          sessionTtl: 7200,
          enableRedis: enableRedis,
          redisHost: redisHost,
          redisPort: redisPort,
          redisPassword: redisPassword,
          redisDb: redisDb,
        };
      },
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
      config: {
        url: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_LLM_MODEL || 'gemma3n:e4b',
        timeout: 30000,
      },
    }),

    // ==================== Communication Domain ====================
    ChatModule,
    WebsocketModule,
  ],
})
export class AppModule {}