import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { RAGController } from './controllers/rag.controller';
import { OllamaService } from './services/ollama.service';
import { RecipeRecommendationService } from './services/recipe-recommendation.service';
import { RAGService } from './services/rag.service';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [
    ConfigModule,
    VectorModule, // RAG를 위해 Vector 모듈 import
  ],
  controllers: [AiController, RAGController],
  providers: [OllamaService, RecipeRecommendationService, RAGService],
  exports: [OllamaService, RecipeRecommendationService, RAGService],
})
export class AiModule {}
