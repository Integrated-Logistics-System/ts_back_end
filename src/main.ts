import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

class ConfiguredIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const websocketPort = parseInt(process.env.WEBSOCKET_PORT) || port || 8083;
    
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
    };

    return super.createIOServer(websocketPort, optionsWithCORS);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    // WebSocket 어댑터 설정
    app.useWebSocketAdapter(new ConfiguredIoAdapter(app));

    // CORS 설정
    app.enableCors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
      .setTitle('AI Chat API')
      .setDescription('Claude Desktop style AI Chat System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 8081;
    const websocketPort = process.env.WEBSOCKET_PORT || 8083;
    await app.listen(port);

    logger.log(`🚀 AI Chat Server running on http://localhost:${port}`);
    logger.log(`🔌 WebSocket Gateway running on ws://localhost:${websocketPort}`);
    logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
    logger.log(`🔗 Health check: http://localhost:${port}/api/auth/health`);
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();