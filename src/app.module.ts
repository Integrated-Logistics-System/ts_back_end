import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from './modules/auth/auth.module';
import { OllamaModule } from './modules/ollama/ollama.module';
import { RedisModule } from './modules/redis/redis.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { LangchainModule } from './modules/langchain/langchain.module';
import { AllergenModule } from './modules/allergen/allergen.module';
import { ElasticsearchModule } from './modules/elasticsearch/elasticsearch.module';
import { RecipeModule } from './modules/recipe/recipe.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI,
      {
        retryWrites: false,
        retryReads: false,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 5000,
      }
    ),
    // 핵심 모듈들
    AuthModule,
    RedisModule,
    OllamaModule,
    
    // AI 및 검색 모듈들  
    LangchainModule,
    ElasticsearchModule,
    AllergenModule,
    
    // 서비스 모듈들
    WebsocketModule,
    RecipeModule,
  ],
})
export class AppModule {}
