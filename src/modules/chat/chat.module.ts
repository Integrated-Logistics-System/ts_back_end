import { Module } from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [],
  providers: [ChatHistoryService, RedisService],
  exports: [ChatHistoryService],
})
export class ChatModule {}