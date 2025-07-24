import { Module } from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [ChatHistoryService],
  exports: [ChatHistoryService],
})
export class ChatModule {}