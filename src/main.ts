import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || [
          'http://localhost:3000',
        ],
        credentials: process.env.CORS_CREDENTIALS === 'true',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      },
    });

    const configService = app.get(ConfigService);

    // Security middleware
    app.use(
      helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      }),
    );

    // Compression middleware
    app.use(compression());

    // Global pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        errorHttpStatusCode: 422,
      }),
    );

    // API prefix
    app.setGlobalPrefix('api/v1');

    // Swagger documentation
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('Smart Recipe AI Assistant API')
        .setDescription(
          'RAG-powered recipe recommendation chatbot with AI assistance',
        )
        .setVersion('1.0.0')
        .addTag('Authentication', 'User authentication and authorization')
        .addTag('Recipes', 'Recipe management and CRUD operations')
        .addTag('Search', 'Recipe search and filtering')
        .addTag('AI', 'AI-powered features including chat and recommendations')
        .addTag('Vector', 'Vector search and semantic similarity')
        .addTag('Indexing', 'Data indexing and processing')
        .addTag('Users', 'User profile management')
        .addBearerAuth({
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        })
        .addServer('http://localhost:3001', 'Development server')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
          tagsSorter: 'alpha',
          operationsSorter: 'alpha',
        },
      });
    }

    const port = configService.get<string>('PORT') || '3001';
    const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

    await app.listen(port);

    logger.log(`🚀 Smart Recipe AI Assistant Backend`);
    logger.log(`📍 Environment: ${nodeEnv}`);
    logger.log(`🌐 Server running on port ${port}`);
    logger.log(`🔗 API Base URL: http://localhost:${port}/api/v1`);

    if (nodeEnv !== 'production') {
      logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
    }

    // Health check endpoints
    logger.log(`❤️  Health Check: http://localhost:${port}/api/v1/health`);

    // Database connections
    logger.log(
      `📊 MongoDB: ${configService.get('database.uri')?.replace(/\/\/.*@/, '//***:***@')}`,
    );
    logger.log(
      `🔴 Redis: ${configService.get('redis.host')}:${configService.get('redis.port')}`,
    );
    logger.log(`🔍 Elasticsearch: ${configService.get('elasticsearch.node')}`);
    logger.log(`🤖 Ollama: ${configService.get('ollama.baseUrl')}`);
  } catch (error) {
    logger.error('Failed to start the application', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  Logger.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

void bootstrap();
