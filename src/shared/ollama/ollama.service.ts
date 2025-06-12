import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get('OLLAMA_URL');
    this.model = this.configService.get('OLLAMA_MODEL');
  }

  async generateResponse(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const messages = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 1000,
        },
      });

      return response.data.message.content;
    } catch (error) {
      this.logger.error('Ollama API 호출 실패:', error.message);
      throw new Error(`AI 응답 생성 실패: ${error.message}`);
    }
  }

  async extractIngredients(text: string): Promise<string[]> {
    const prompt = `
다음 텍스트에서 요리 재료명만 추출해서 배열로 반환하세요.
재료가 아닌 것들(조리법, 도구, 시간 등)은 제외하세요.

텍스트: "${text}"

응답 형식: ["재료1", "재료2", "재료3"]
`;

    try {
      const response = await this.generateResponse(prompt);
      // JSON 파싱 시도
      const match = response.match(/\[(.*?)\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return [];
    } catch (error) {
      this.logger.warn('재료 추출 실패, 기본 파싱 사용');
      return this.fallbackExtractIngredients(text);
    }
  }

  private fallbackExtractIngredients(text: string): string[] {
    // 기본적인 재료 추출 로직
    const commonIngredients = [
      '닭고기', '돼지고기', '쇠고기', '생선', '새우', '오징어',
      '양파', '마늘', '생강', '파', '당근', '감자', '토마토',
      '쌀', '면', '빵', '계란', '우유', '치즈', '버터',
      '간장', '된장', '고추장', '설탕', '소금', '후추',
      '기름', '참기름', '올리브오일'
    ];

    return commonIngredients.filter(ingredient => 
      text.includes(ingredient)
    );
  }

  async generateRecipeResponse(
    userQuery: string,
    recipes: any[],
    userAllergies: string[] = []
  ): Promise<string> {
    const systemPrompt = `
당신은 친근하고 전문적인 AI 요리 어시스턴트입니다.
사용자의 질문에 맞는 레시피를 추천하고 도움을 주세요.

규칙:
1. 친근하고 도움이 되는 톤으로 답변
2. 알레르기가 있다면 반드시 주의사항 언급
3. 구체적이고 실용적인 조언 제공
4. 150자 이내로 간결하게 작성
`;

    const prompt = `
사용자 질문: "${userQuery}"
사용자 알레르기: ${userAllergies.length > 0 ? userAllergies.join(', ') : '없음'}
추천 레시피 수: ${recipes.length}개

${recipes.length > 0 ? 
  `추천 레시피들:
${recipes.slice(0, 3).map((recipe, idx) => 
  `${idx + 1}. ${recipe.name} (${recipe.minutes}분, 재료 ${recipe.n_ingredients}개)`
).join('\n')}` : 
  '조건에 맞는 레시피를 찾지 못했습니다.'
}

사용자에게 도움이 되는 응답을 생성해주세요.
`;

    return this.generateResponse(prompt, systemPrompt);
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      this.logger.error('Ollama 헬스체크 실패:', error.message);
      return false;
    }
  }
}