import { Module } from '@nestjs/common';
import { LangChainModule } from '../langchain/langchain.module';
import { RecipeModule } from '../recipe/recipe.module';

import { ChatGateway } from './websocket.gateway';

@Module({
  imports: [
    LangChainModule,
    RecipeModule,
  ],
  providers: [
    ChatGateway,
  ],
  exports: [
    ChatGateway,
  ],
})
export class WebsocketModule {}