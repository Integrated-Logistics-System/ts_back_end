import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '🍽️ AI Recipe Assistant API가 정상적으로 실행 중입니다!';
  }

  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'AI Recipe Assistant',
      version: '1.0.0'
    };
  }
}
