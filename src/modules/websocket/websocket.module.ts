// src/modules/websocket/websocket.module.ts

import { Module } from '@nestjs/common';
import { ChatGateway } from './websocket.gateway';
import { PersonalChatService } from './personal-chat.service';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { OllamaModule } from '../ollama/ollama.module';
import { LangchainModule } from '../langchain/langchain.module';

@Module({
  imports: [
    AuthModule,
    RedisModule,
    OllamaModule,
    LangchainModule
  ],
  providers: [ChatGateway, PersonalChatService],
  exports: [PersonalChatService],
})
export class WebsocketModule {}