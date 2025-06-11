import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RecipeModule } from './modules/recipe/recipe.module';
import { SearchModule } from './modules/search/search.module';
import { VectorModule } from './modules/vector/vector.module';
import { AiModule } from './modules/ai/ai.module';
import { ChatModule } from './modules/chat/chat.module';
import { IndexingModule } from './modules/indexing/indexing.module';
import { DataModule } from './modules/data/data.module';

// Configuration
import { databaseConfig } from './config/database.config';
import { authConfig } from './config/auth.config';
import { redisConfig } from './config/redis.config';
import { elasticsearchConfig } from './config/elasticsearch.config';
import { openaiConfig } from './config/openai.config';
import { ollamaConfig } from './config/ollama.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        redisConfig,
        elasticsearchConfig,
        openaiConfig,
        ollamaConfig,
      ],
    }),

    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Feature modules
    AuthModule,
    UserModule,
    RecipeModule,
    SearchModule,
    VectorModule,
    AiModule,
    ChatModule,
    IndexingModule,
    DataModule,
  ],
})
export class AppModule {}
