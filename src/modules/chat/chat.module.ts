import { Module } from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service';
import { CacheModule } from '../cache/cache.module';
import { ChatController } from './chat.controller';
import { SimpleChatController } from './simple-chat.controller'; // Agent Service 기반 컨트롤러
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [
    CacheModule,
    AgentModule,
  ],
  controllers: [
    ChatController,
    SimpleChatController, // Agent Service 기반 간단한 컨트롤러
  ],
  providers: [ChatHistoryService],
  exports: [ChatHistoryService],
})
export class ChatModule {}