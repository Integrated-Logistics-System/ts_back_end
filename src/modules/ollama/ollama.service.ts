import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private isConnected = false;

  constructor() {
    // Ollama 연결 확인은 나중에
    this.logger.log('🚀 Ollama service initialized (fallback mode)');
    this.isConnected = false;
  }

  async generateResponse(prompt: string): Promise<string> {
    return this.getFallbackResponse(prompt);
  }

  async *streamGenerate(prompt: string): AsyncIterable<string> {
    // 간단한 스트리밍 시뮤레이션
    const response = this.getFallbackResponse(prompt);
    const words = response.split(' ');
    
    for (const word of words) {
      yield word + ' ';
      // 짧은 딩레이
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private getFallbackResponse(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('안녕') || lowerPrompt.includes('hello')) {
      return '안녕하세요! AI 채팅 어시스턴트입니다. 무엇을 도와드릴까요?';
    }
    
    if (lowerPrompt.includes('고마워') || lowerPrompt.includes('thank')) {
      return '천만에요! 다른 궁금한 것이 있으시면 언제든 말씀해주세요.';
    }
    
    if (lowerPrompt.includes('도움') || lowerPrompt.includes('help')) {
      return '물론이죠! 어떤 도움이 필요하신지 구체적으로 말씀해주시면 최선을 다해 도와드리겠습니다.';
    }

    if (lowerPrompt.includes('요리') || lowerPrompt.includes('레시피')) {
      return '요리에 대해 궁금하신 것이 있으시군요! 구체적으로 어떤 요리나 재료에 대해 알고 싶으신가요?';
    }

    if (lowerPrompt.includes('음식') || lowerPrompt.includes('먹을')) {
      return '음식에 관한 질문이시네요! 어떤 종류의 음식이나 요리법에 대해 도움이 필요하신가요?';
    }
    
    return '죄송합니다. 현재 AI 서비스에 일시적인 문제가 있어 적절한 응답을 드리기 어렵습니다. 잠시 후 다시 시도해주세요.';
  }
}
