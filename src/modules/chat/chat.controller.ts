import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ChatService } from './chat.service';

export class CreateSessionDto {
  userId?: string;
}

export class SendMessageDto {
  message: string;
}

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions')
  @ApiOperation({
    summary: 'Create a new chat session',
    description:
      'Creates a new chat session for conversation with the recipe chatbot',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Chat session created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', example: 'session_1234567890_abc123' },
          },
        },
        message: {
          type: 'string',
          example: 'Chat session created successfully',
        },
      },
    },
  })
  async createSession(@Body() createSessionDto: CreateSessionDto) {
    const sessionId = await this.chatService.createSession(
      createSessionDto.userId,
    );

    return {
      success: true,
      data: { sessionId },
      message: 'Chat session created successfully',
    };
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({
    summary: 'Send a message to the chatbot',
    description:
      'Send a message and receive AI-powered response from the recipe chatbot',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Chat session ID',
    example: 'session_1234567890_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                content: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                metadata: { type: 'object' },
              },
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
            },
            relatedRecipes: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
        message: { type: 'string', example: 'Message processed successfully' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Chat session not found',
  })
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    if (!sendMessageDto.message || sendMessageDto.message.trim().length === 0) {
      throw new BadRequestException('Message content is required');
    }

    const response = await this.chatService.sendMessage(
      sessionId,
      sendMessageDto.message,
    );

    return {
      success: true,
      data: response,
      message: 'Message processed successfully',
    };
  }

  @Get('sessions/:sessionId')
  @ApiOperation({
    summary: 'Get chat session details',
    description: 'Retrieve chat session information and message history',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Chat session ID',
    example: 'session_1234567890_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            session: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                messages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      role: { type: 'string' },
                      content: { type: 'string' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                context: { type: 'object' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        message: {
          type: 'string',
          example: 'Session details retrieved successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Chat session not found',
  })
  async getSession(@Param('sessionId') sessionId: string) {
    const session = await this.chatService.getSession(sessionId);

    if (!session) {
      throw new BadRequestException(`Chat session ${sessionId} not found`);
    }

    return {
      success: true,
      data: { session },
      message: 'Session details retrieved successfully',
    };
  }

  @Get('sessions/:sessionId/history')
  @ApiOperation({
    summary: 'Get chat message history',
    description: 'Retrieve all messages from a chat session',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Chat session ID',
    example: 'session_1234567890_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  role: { type: 'string' },
                  content: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  metadata: { type: 'object' },
                },
              },
            },
            count: { type: 'number' },
          },
        },
        message: {
          type: 'string',
          example: 'Message history retrieved successfully',
        },
      },
    },
  })
  async getSessionHistory(@Param('sessionId') sessionId: string) {
    const messages = await this.chatService.getSessionHistory(sessionId);

    return {
      success: true,
      data: {
        messages,
        count: messages.length,
      },
      message: 'Message history retrieved successfully',
    };
  }

  @Post('sessions/:sessionId/rag-messages')
  @ApiOperation({
    summary: 'Send a message using RAG (advanced AI)',
    description:
      'Send a message and receive enhanced AI response using RAG technology for more accurate answers',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Chat session ID',
    example: 'session_1234567890_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'RAG message processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                role: { type: 'string', enum: ['assistant'] },
                content: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                metadata: {
                  type: 'object',
                  properties: {
                    ragUsed: { type: 'boolean', example: true },
                    confidence: { type: 'number', example: 0.85 },
                    sourcesCount: { type: 'number', example: 3 },
                    contextDocuments: { type: 'number', example: 5 },
                  },
                },
              },
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
              example: ['비슷한 레시피 더 보기', '재료 대체 방법', '조리 팁'],
            },
            relatedRecipes: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
        message: {
          type: 'string',
          example: 'RAG message processed successfully',
        },
      },
    },
  })
  async sendRAGMessage(
    @Param('sessionId') sessionId: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    if (!sendMessageDto.message || sendMessageDto.message.trim().length === 0) {
      throw new BadRequestException('Message content is required');
    }

    const response = await this.chatService.sendRAGMessage(
      sessionId,
      sendMessageDto.message,
    );

    return {
      success: true,
      data: response,
      message: 'RAG message processed successfully',
    };
  }
}
