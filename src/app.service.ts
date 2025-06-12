import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '🍳 Smart Recipe RAG Assistant - AI 기반 맞춤형 레시피 추천 시스템';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Smart Recipe RAG Assistant',
      version: '1.0.0',
      features: [
        'RAG 기반 레시피 검색',
        'LangGraph 워크플로우',
        '개인 알레르기 관리',
        '재료 기반 추천',
        '실시간 안전성 체크'
      ]
    };
  }
}