import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// ==================== Recipe Domain ====================
import { RecipeModule } from './modules/recipe/recipe.module';

// ==================== LangChain AI ====================
import { LangChainModule } from './modules/langchain/langchain.module';

// ==================== Elasticsearch Search ====================
import { ElasticsearchModule } from './modules/elasticsearch/elasticsearch.module';

// ==================== Communication Domain ====================
import { WebsocketModule } from './modules/websocket/websocket.module';

@Module({
  imports: [
    // ==================== Global Configuration ====================
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ==================== Recipe Domain ====================
    RecipeModule,

    // ==================== LangChain AI ====================
    LangChainModule,

    // ==================== Elasticsearch Search ====================
    ElasticsearchModule,

    // ==================== Communication Domain ====================
    WebsocketModule,
  ],
})
export class AppModule {}