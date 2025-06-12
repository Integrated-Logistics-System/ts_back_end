import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

// Core modules
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Feature modules
import { UserModule } from './modules/user/user.module';
import { RecipeModule } from './modules/recipe/recipe.module';
import { IngredientModule } from './modules/ingredient/ingredient.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { RagModule } from './modules/rag/rag.module';
import { LangGraphModule } from './modules/langgraph/langgraph.module';
import { ElasticsearchModule } from './modules/elasticsearch/elasticsearch.module';
import { RedisModule } from './modules/redis/redis.module';

// Shared modules
import { DatabaseModule } from './shared/database/database.module';
import { OllamaModule } from './shared/ollama/ollama.module';

// Scripts
import { DataInitService } from './scripts/data-init.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Database
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),

    // Shared modules
    DatabaseModule,
    OllamaModule,

    // Core modules
    ElasticsearchModule,
    RedisModule,

    // Feature modules
    UserModule,
    RecipeModule,
    IngredientModule,
    ConversationModule,
    RagModule,
    LangGraphModule,
  ],
  controllers: [AppController],
  providers: [AppService, DataInitService],
})
export class AppModule {}