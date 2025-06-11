import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AiModule } from '../ai/ai.module';
import { VectorModule } from '../vector/vector.module';
import { RecipeModule } from '../recipe/recipe.module';

@Module({
  imports: [AiModule, VectorModule, RecipeModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
