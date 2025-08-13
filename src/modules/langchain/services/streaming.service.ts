import { Injectable, Logger } from '@nestjs/common';
import { Ollama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { IntentAnalysis, ConversationContext } from '../types/langchain.types';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly ollama: Ollama;
  private recipeListPrompt!: PromptTemplate;
  private recipeDetailPrompt!: PromptTemplate;
  private cookingHelpPrompt!: PromptTemplate;
  private generalChatPrompt!: PromptTemplate;

  constructor() {
    // Ollama 모델 초기화 (응답 생성용)
    this.ollama = new Ollama({
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3:1.7b',
      temperature: parseFloat(process.env.OLLAMA_TEMPERATURE_GENERATION || '0.7'),
    });

    this.initializePrompts();
    this.logger.log('🌊 Streaming Service initialized');
  }

  /**
   * 의도에 따른 스트리밍 응답 생성
   */
  async *generateStreamingResponse(
    message: string,
    intentAnalysis: IntentAnalysis,
    context?: ConversationContext
  ): AsyncGenerator<{ type: 'token' | 'complete'; content?: string; metadata?: any }, void, unknown> {
    const startTime = Date.now();
    this.logger.log(`🌊 Starting streaming for intent: ${intentAnalysis.intent}`);

    try {
      const contextStr = this.buildContextString(context);
      const selectedPrompt = this.selectPrompt(intentAnalysis.intent);
      
      // 스트리밍 응답 생성
      const promptValue = await selectedPrompt.format({ message, context: contextStr });
      const stream = await this.ollama.stream(promptValue);
      
      // <think> 태그 필터링을 위한 버퍼
      let buffer = '';
      let insideThinkTag = false;
      
      for await (const chunk of stream) {
        if (typeof chunk === 'string' && chunk.length > 0) {
          buffer += chunk;
          
          // <think> 태그 처리
          while (buffer.length > 0) {
            if (!insideThinkTag) {
              // <think> 태그를 찾음
              const thinkStartIndex = buffer.indexOf('<think>');
              if (thinkStartIndex !== -1) {
                // <think> 태그 이전의 내용을 전송
                if (thinkStartIndex > 0) {
                  const contentToSend = buffer.substring(0, thinkStartIndex);
                  yield {
                    type: 'token',
                    content: contentToSend,
                  };
                }
                // <think> 태그 이후로 이동
                buffer = buffer.substring(thinkStartIndex + 7); // '<think>'.length = 7
                insideThinkTag = true;
              } else {
                // <think> 태그가 없으면 전체 버퍼를 전송할 수 있는지 확인
                // 하지만 마지막에 '<', '<t', '<th' 등이 있을 수 있으므로 조심해야 함
                let safeToSend = buffer.length;
                const partialTags = ['<', '<t', '<th', '<thi', '<thin', '<think'];
                for (const partial of partialTags) {
                  if (buffer.endsWith(partial)) {
                    safeToSend = buffer.length - partial.length;
                    break;
                  }
                }
                
                if (safeToSend > 0) {
                  const contentToSend = buffer.substring(0, safeToSend);
                  yield {
                    type: 'token',
                    content: contentToSend,
                  };
                  buffer = buffer.substring(safeToSend);
                } else {
                  break; // 더 많은 데이터를 기다림
                }
              }
            } else {
              // </think> 태그를 찾음
              const thinkEndIndex = buffer.indexOf('</think>');
              if (thinkEndIndex !== -1) {
                // </think> 태그 이후로 이동
                buffer = buffer.substring(thinkEndIndex + 8); // '</think>'.length = 8
                insideThinkTag = false;
              } else {
                // </think> 태그가 아직 없으면 버퍼를 모두 제거 (think 내용)
                buffer = '';
                break;
              }
            }
          }
        }
      }
      
      // 남은 버퍼가 있고 think 태그 안에 있지 않다면 전송
      if (buffer.length > 0 && !insideThinkTag) {
        yield {
          type: 'token',
          content: buffer,
        };
      }
      
      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Streaming completed for ${intentAnalysis.intent} in ${processingTime}ms`);
      
      yield {
        type: 'complete',
        metadata: {
          intent: intentAnalysis.intent,
          confidence: intentAnalysis.confidence,
          processingTime,
        }
      };
      
    } catch (error) {
      this.logger.error('❌ Error in streaming response generation:', error);
      
      // 에러 시 기본 메시지 스트리밍
      const errorMessage = '죄송합니다. 일시적인 오류가 발생했습니다.';
      const chunkSize = 5;
      
      for (let i = 0; i < errorMessage.length; i += chunkSize) {
        const chunk = errorMessage.substring(i, i + chunkSize);
        yield {
          type: 'token',
          content: chunk,
        };
        
        // 약간의 지연으로 자연스러운 타이핑 효과
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      yield {
        type: 'complete',
        metadata: {
          intent: 'error',
          confidence: 1.0,
          processingTime: Date.now() - startTime,
        }
      };
    }
  }

  /**
   * 의도에 따른 프롬프트 선택
   */
  private selectPrompt(intent: string): PromptTemplate {
    switch (intent) {
      case 'recipe_list':
        return this.recipeListPrompt;
      case 'recipe_detail':
        return this.recipeDetailPrompt;
      case 'cooking_help':
        return this.cookingHelpPrompt;
      default:
        return this.generalChatPrompt;
    }
  }

  /**
   * 프롬프트 초기화
   */
  private initializePrompts(): void {
    // 레시피 목록 요청용 프롬프트
    this.recipeListPrompt = PromptTemplate.fromTemplate(`
당신은 친근하고 전문적인 AI 셰프입니다. 사용자의 레시피 요청에 대해 도움이 되는 추천을 제공해주세요.

사용자 요청: {message}
컨텍스트: {context}

다음 가이드라인을 따라 응답해주세요:
1. 친근하고 격려적인 어조 사용
2. 사용자의 상황과 선호도를 고려
3. 간단하고 실용적인 추천
4. 요리 팁이나 변형 아이디어 포함
5. 재료를 구하기 쉬운 레시피 우선 추천

답변:
    `);

    // 레시피 상세 정보용 프롬프트
    this.recipeDetailPrompt = PromptTemplate.fromTemplate(`
당신은 뛰어난 요리 전문가입니다. 사용자가 요청한 레시피에 대해 자세하고 친절한 안내를 제공해주세요.

사용자 요청: {message}
컨텍스트: {context}

다음 요소들을 포함하여 상세한 레시피를 제공해주세요:
1. 따뜻한 인사와 레시피 소개
2. 필요한 재료 목록 (분량과 함께)
3. 단계별 조리 과정 (명확하고 이해하기 쉽게)
4. 실용적인 요리 팁과 대체 재료 제안
5. 친근하고 격려적인 어조
6. 영양 정보나 추가 정보가 있다면 자연스럽게 포함

예시 형식:
"🍳 **{recipeTitle}** 

안녕하세요! 이 레시피를 자세히 알려드릴게요!

🥘 **재료** ({servings}인분)
- 재료 1: 상세 설명
- 재료 2: 상세 설명

🔥 **조리법** (예상 시간: {cookingTime}분)
1. 단계별 상세 설명...
2. 다음 단계...

💡 **셔프의 팁**
- 실용적인 요리 팁

🍏 **영양 정보**
- 칼로리, 단백질 등"

답변:
    `);

    // 요리 도움말용 프롬프트
    this.cookingHelpPrompt = PromptTemplate.fromTemplate(`
당신은 경험 많은 요리 전문가입니다. 사용자의 요리 관련 질문이나 문제에 대해 도움을 제공해주세요.

사용자 질문: {message}
컨텍스트: {context}

다음을 고려하여 답변해주세요:
1. 실용적이고 즉시 적용 가능한 해결책
2. 대체 재료나 방법 제안
3. 실패를 예방하는 팁
4. 친근하고 이해하기 쉬운 설명
5. 추가적인 관련 팁이나 정보

답변:
    `);

    // 일반 대화용 프롬프트
    this.generalChatPrompt = PromptTemplate.fromTemplate(`
당신은 친근한 AI 셰프입니다. 사용자와 자연스러운 대화를 나누며 요리에 대한 관심을 유도해주세요.

사용자 메시지: {message}
컨텍스트: {context}

친근하고 자연스러운 대화를 유지하면서, 적절한 때에 요리나 레시피 관련 이야기로 연결해보세요.

답변:
    `);
  }

  /**
   * 컨텍스트 정보를 문자열로 변환
   */
  private buildContextString(context?: ConversationContext): string {
    if (!context) return '컨텍스트 정보 없음';

    let contextStr = '';
    
    if (context.history && context.history.length > 0) {
      contextStr += `이전 대화: ${context.history.slice(-3).map(h => 
        `${h.type}: ${h.text}`
      ).join(', ')}\n`;
    }
    
    if (context.allergies && context.allergies.length > 0) {
      contextStr += `알레르기: ${context.allergies.join(', ')}\n`;
    }
    
    if (context.cookingLevel) {
      contextStr += `요리 수준: ${context.cookingLevel}\n`;
    }

    return contextStr || '컨텍스트 정보 없음';
  }
}