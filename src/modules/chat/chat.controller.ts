import { Controller, Get, Req, UseGuards, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatHistoryService, ChatMessage } from './chat-history.service';
import { ConversationHistoryResponseDto, ConversationItemDto } from './dto/conversation-history.dto';
import { UserSessionData } from '../auth/auth.service'; // UserSessionData import

@ApiTags('Chat')
@Controller('conversation')
export class ChatController {
  constructor(private readonly chatHistoryService: ChatHistoryService) {}

  @UseGuards(JwtAuthGuard)
  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user conversation history' })
  @ApiResponse({ status: 200, description: 'User conversation history retrieved successfully', type: ConversationHistoryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConversationHistory(@Req() req: Request): Promise<ConversationHistoryResponseDto> {
    // req.user에서 사용자 ID를 가져옵니다.
    // JwtStrategy에서 반환하는 user 객체는 UserSessionData 타입입니다.
    const user = req.user as UserSessionData; // UserSessionData 타입으로 캐스팅
    const userId = user.id; // user.id 사용

    const history: ChatMessage[] = await this.chatHistoryService.getChatHistory(userId);

    const conversations: ConversationItemDto[] = history.map(item => ({
      message: item.message,
      response: item.response,
      timestamp: new Date(item.timestamp).toISOString(),
      metadata: item.metadata ? {
        intent: item.metadata.intent, // ChatMessage의 type을 intent로 매핑
        processingTime: item.metadata.processingTime,
      } : undefined,
    }));

    return { conversations };
  }

  @Delete('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear user conversation history' })
  @ApiResponse({ status: 204, description: 'Conversation history cleared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearConversationHistory(@Req() req: Request): Promise<void> {
    const user = req.user as UserSessionData;
    const userId = user.id;

    await this.chatHistoryService.clearChatHistory(userId);
  }
}