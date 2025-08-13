import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';

class ConfiguredIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): Server {
    const websocketPort = parseInt(process.env.WEBSOCKET_PORT || '8083', 10) || port || 8083;
    
    const cors = {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };

    const optionsWithCORS: ServerOptions = {
      ...options,
      cors,
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      path: options?.path || process.env.WEBSOCKET_PATH || '/socket.io/',
      serveClient: options?.serveClient ?? true,
    } as ServerOptions;

    return super.createIOServer(websocketPort, optionsWithCORS) as Server;
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    // WebSocket 어댑터 설정
    app.useWebSocketAdapter(new ConfiguredIoAdapter(app));

    // CORS 설정 - 개발 환경에서 모든 요청 허용
    app.enableCors({
      origin: true, // 모든 도메인 허용
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin'],
      optionsSuccessStatus: 200, // IE11 호환성
    });

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false,
    }));

    // API prefix
    app.setGlobalPrefix('api');

    // Swagger 설정
    const config = new DocumentBuilder()
      .setTitle('Recipe Chat API')
      .setDescription('Simple Recipe Chat System with LangChain')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 8081;
    const websocketPort = process.env.WEBSOCKET_PORT || 8083;
    await app.listen(port as number);

    logger.log(`🚀 Recipe Chat Server running on http://localhost:${port}`);
    logger.log(`🔌 WebSocket Gateway running on ws://localhost:${websocketPort}`);
    logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
    logger.log(`🍽️ Recipe API: http://localhost:${port}/api/recipes/all`);
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

void bootstrap();