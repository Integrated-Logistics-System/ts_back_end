import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS 설정
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 글로벌 프리픽스 설정
  app.setGlobalPrefix('api');
  
  // 글로벌 검증 파이프 설정
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // 글로벌 예외 필터 설정
  app.useGlobalFilters(new HttpExceptionFilter());
  
  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`🚀 AI Recipe Assistant running on port ${port}`);
}

bootstrap();
