import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Welcome message' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Returns welcome message',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Smart Recipe AI Assistant API' },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'development' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  getWelcome() {
    return this.appService.getWelcome();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Returns application health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        uptime: { type: 'number', example: 12345 },
        services: {
          type: 'object',
          properties: {
            database: { type: 'string', example: 'connected' },
            redis: { type: 'string', example: 'connected' },
            elasticsearch: { type: 'string', example: 'connected' },
            ollama: { type: 'string', example: 'connected' },
          },
        },
      },
    },
  })
  async getHealth() {
    return this.appService.getHealth();
  }

  @Get('version')
  @ApiOperation({ summary: 'Application version' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Returns application version information',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Smart Recipe AI Assistant' },
        version: { type: 'string', example: '1.0.0' },
        description: { type: 'string', example: 'RAG-powered recipe recommendation chatbot' },
        author: { type: 'string', example: 'Recipe AI Team' },
      },
    },
  })
  getVersion() {
    return this.appService.getVersion();
  }
}
