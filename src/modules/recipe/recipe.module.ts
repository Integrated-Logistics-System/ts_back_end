import { Module } from '@nestjs/common';
import { RecipeController } from './recipe.controller';
import { RAGModule } from '../rag/rag.module';

@Module({
  imports: [RAGModule],
  controllers: [RecipeController],
})
export class RecipeModule {}
