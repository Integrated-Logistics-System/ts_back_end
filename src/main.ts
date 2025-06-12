import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS 설정
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // 글로벌 파이프 설정
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3001;

  await app.listen(port);
  
  console.log(`🚀 Smart Recipe RAG Assistant running on: http://localhost:${port}`);
  console.log(`🤖 AI Model: ${configService.get('OLLAMA_MODEL')}`);
  console.log(`📊 MongoDB: ${configService.get('MONGODB_URI')?.split('@')[1]}`);
  console.log(`🔍 Elasticsearch: ${configService.get('ELASTICSEARCH_URL')}`);
}

bootstrap();