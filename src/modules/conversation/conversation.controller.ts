import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ConversationService } from './conversation.service';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('chat')
  async chat(@Body() body: { userId: string; message: string }) {
    return this.conversationService.chat(body.userId, body.message);
  }

  @Get(':userId/history')
  async getHistory(
    @Param('userId') userId: string,
    @Query('sessionId') sessionId?: string
  ) {
    return this.conversationService.getConversationHistory(userId, sessionId);
  }
}