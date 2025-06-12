import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('chat')
  async chat(@Body() body: { userId: string; query: string; useWorkflow?: boolean }) {
    if (body.useWorkflow) {
      return this.ragService.processQuery(body.userId, body.query);
    } else {
      return this.ragService.simpleRecipeSearch(body.query, body.userId);
    }
  }

  @Post('search')
  async search(@Body() body: { query: string; userId?: string }) {
    return this.ragService.simpleRecipeSearch(body.query, body.userId);
  }
}