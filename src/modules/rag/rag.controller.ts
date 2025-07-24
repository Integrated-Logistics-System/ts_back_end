import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KoreanRAGService } from './korean-rag.service';

@ApiTags('RAG (Retrieval-Augmented Generation)')
@Controller('api/rag')
export class RAGController {
  constructor(private readonly koreanRAGService: KoreanRAGService) {}

  @Post('korean')
  @ApiOperation({ 
    summary: '한국어 RAG 응답 생성',
    description: '벡터 검색으로 관련 레시피를 찾고 gemma3n:e4b로 한국어 응답을 생성합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '한국어 RAG 응답',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', example: '간단한 파스타 요리' },
        response: { type: 'string', example: '파스타 요리를 위한 추천 레시피들을 찾았습니다...' },
        timestamp: { type: 'string', format: 'date-time' }
      }
    }
  })
  async generateKoreanResponse(
    @Body() body: { query: string }
  ) {
    const { query } = body;
    
    const response = await this.koreanRAGService.generateKoreanResponse(query);
    
    return {
      query,
      response,
      timestamp: new Date().toISOString()
    };
  }

  @Get('test')
  @ApiOperation({ 
    summary: 'RAG 시스템 테스트',
    description: '간단한 한국어 질문으로 RAG 시스템을 테스트합니다.'
  })
  async testRAG(@Query('q') query: string = '간단한 파스타 요리') {
    try {
      const response = await this.koreanRAGService.generateKoreanResponse(query);
      
      return {
        success: true,
        query,
        response,
        responseLength: response.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        query,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }
}