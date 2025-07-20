import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';

interface GenerateTextDto {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

@Controller('api/ai')
export class AiController {
    private readonly logger = new Logger(AiController.name);

    constructor(private readonly aiService: AiService) {}

    @Get('status')
    async getStatus() {
        try {
            const status = await this.aiService.getStatus();

            return {
                ...status,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            };
        } catch (error: unknown) {
            return {
                error: error instanceof Error ? error.message : 'An unknown error occurred',
                timestamp: new Date().toISOString(),
            };
        }
    }

    @Post('generate')
    @UseGuards(JwtAuthGuard)
    async generateText(
        @Body() body: GenerateTextDto
    ) {
        const startTime = Date.now();

        try {
            this.logger.log(`🤖 Generating text for prompt: "${body.prompt.substring(0, 50)}..."`);

            const response = await this.aiService.generateText(body.prompt, {
                temperature: body.temperature,
                maxTokens: body.maxTokens,
                stopSequences: body.stopSequences,
            });

            return {
                ...response,
                metadata: {
                    processingTime: Date.now() - startTime,
                    promptLength: body.prompt.length,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error: unknown) {
            this.logger.error('Text generation failed:', error);
            throw new Error(`Text generation failed: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
        }
    }

    @Post('health')
    async healthCheck() {
        try {
            const status = await this.aiService.getStatus();

            return {
                status: status.isConnected ? 'healthy' : 'degraded',
                provider: status.provider,
                model: status.model,
                timestamp: new Date().toISOString(),
            };
        } catch (error: unknown) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'An unknown error occurred',
                timestamp: new Date().toISOString(),
            };
        }
    }

    @Post('reconnect')
    async reconnect() {
        try {
            await this.aiService.reconnect();

            return {
                success: true,
                message: 'AI service reconnected successfully',
                timestamp: new Date().toISOString(),
            };
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'An unknown error occurred',
                timestamp: new Date().toISOString(),
            };
        }
    }
}