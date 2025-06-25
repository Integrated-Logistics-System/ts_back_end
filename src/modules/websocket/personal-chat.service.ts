import { Injectable, Logger } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import {
  ConversationChain,
  LLMChain
} from 'langchain/chains';
import {
  PromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate
} from '@langchain/core/prompts';
import {
  BaseMemory,
} from 'langchain/memory';
import {
  BaseMessage,
  HumanMessage,
  AIMessage
} from '@langchain/core/messages';
import { RedisService } from '../redis/redis.service';
import { AuthService } from '../auth/auth.service';

// Redis 기반 커스텀 메모리 클래스
class RedisConversationMemory extends BaseMemory {
  private redisService: RedisService;
  private userId: string;
  private logger = new Logger(RedisConversationMemory.name);

  constructor(redisService: RedisService, userId: string) {
    super();
    this.redisService = redisService;
    this.userId = userId;
  }

  get memoryKeys(): string[] {
    return ['chat_history'];
  }

  async loadMemoryVariables(): Promise<{ chat_history: string }> {
    try {
      const key = `langchain_memory:${this.userId}`;
      const historyData = await this.redisService.get(key);

      if (!historyData) {
        return { chat_history: '' };
      }

      const messages: BaseMessage[] = JSON.parse(historyData);
      const chatHistory = messages
        .map(msg => `${msg._getType() === 'human' ? 'Human' : 'AI'}: ${msg.content}`)
        .join('\n');

      return { chat_history: chatHistory };
    } catch (error) {
      this.logger.error('메모리 로드 실패:', error.message);
      return { chat_history: '' };
    }
  }

  async saveContext(
    inputValues: Record<string, any>,
    outputValues: Record<string, any>
  ): Promise<void> {
    try {
      const key = `langchain_memory:${this.userId}`;

      // 기존 메시지 로드
      const existingData = await this.redisService.get(key);
      const messages: BaseMessage[] = existingData ? JSON.parse(existingData) : [];

      // 새 메시지 추가
      messages.push(
        new HumanMessage(inputValues.input || inputValues.question),
        new AIMessage(outputValues.response || outputValues.text)
      );

      // 최근 20개 메시지만 유지
      const recentMessages = messages.slice(-20);

      // Redis에 저장 (7일 보관)
      await this.redisService.set(
        key,
        JSON.stringify(recentMessages),
        86400 * 7
      );

      this.logger.log(`메모리 저장 완료: ${this.userId}`);
    } catch (error) {
      this.logger.error('메모리 저장 실패:', error.message);
    }
  }

  async clear(): Promise<void> {
    try {
      const key = `langchain_memory:${this.userId}`;
      await this.redisService.del(key);
      this.logger.log(`메모리 클리어: ${this.userId}`);
    } catch (error) {
      this.logger.error('메모리 클리어 실패:', error.message);
    }
  }
}

interface PersonalizedContext {
  cookingLevel: string;
  preferences: string[];
  allergies: string[];
  currentTime: string;
  userName: string;
}

@Injectable()
export class PersonalChatService {
  private readonly logger = new Logger(PersonalChatService.name);
  private chatModel: ChatOllama;
  private systemPromptTemplate: ChatPromptTemplate;

  constructor(
    private redisService: RedisService,
    private authService: AuthService,
  ) {
    this.initializeLangChain();
  }

  private initializeLangChain() {
    // ChatOllama 모델 초기화
    this.chatModel = new ChatOllama({
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'gemma2:2b',
      temperature: 0.7,
      streaming: true,
    });

    // 시스템 프롬프트 템플릿 생성
    this.systemPromptTemplate = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(`당신은 친근한 AI 요리 어시스턴트입니다.

사용자 정보:
- 이름: {userName}
- 요리 실력: {cookingLevel}
- 알레르기: {allergies}
- 선호도: {preferences}
- 현재 시간: {currentTime}

지침:
1. 친근하고 도움이 되는 톤으로 답변
2. 알레르기 재료는 절대 추천하지 않기
3. 구체적이고 실용적인 조언 제공
4. 한국어로 자연스럽게 답변
5. 마크다운 형식 사용

이전 대화:
{chat_history}`),
      HumanMessagePromptTemplate.fromTemplate('{input}')
    ]);
  }

  async processPersonalizedChat(userId: string, message: string): Promise<AsyncIterable<string>> {
    this.logger.log(`💬 LangChain 개인화 채팅 처리: "${message}"`);

    try {
      // 개인화 컨텍스트 가져오기
      const context = await this.getPersonalizedContext(userId);

      // Redis 기반 메모리 생성
      const memory = new RedisConversationMemory(this.redisService, userId);

      // ConversationChain 생성
      const chain = new ConversationChain({
        llm: this.chatModel,
        prompt: this.systemPromptTemplate,
        memory: memory,
        verbose: true,
      });

      // 스트리밍 응답 생성
      return this.streamResponse(chain, message, context);

    } catch (error) {
      this.logger.error(`❌ LangChain 처리 오류:`, error.message);
      return this.createErrorResponse(error.message);
    }
  }

  private async *streamResponse(
    chain: ConversationChain,
    message: string,
    context: PersonalizedContext
  ): AsyncIterable<string> {
    try {
      // 컨텍스트와 함께 체인 실행
      const stream = await chain.stream({
        input: message,
        userName: context.userName,
        cookingLevel: context.cookingLevel,
        allergies: context.allergies.join(', ') || '없음',
        preferences: context.preferences.join(', ') || '없음',
        currentTime: context.currentTime,
      });

      // 스트림에서 응답 청크 생성
      for await (const chunk of stream) {
        if (chunk.response) {
          yield chunk.response;
        }
      }

    } catch (error) {
      this.logger.error('스트리밍 오류:', error.message);
      yield `죄송합니다. 응답 생성 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  private async *createErrorResponse(errorMessage: string): AsyncIterable<string> {
    yield `죄송합니다. 요청을 처리하는 중 문제가 발생했습니다.\n\n`;
    yield `**오류 내용**: ${errorMessage}\n\n`;
    yield `다시 시도해주시거나, 다른 질문을 해주세요. 😊`;
  }

  async getPersonalizedContext(userId: string): Promise<PersonalizedContext> {
    try {
      const user = await this.authService.findById(userId);

      return {
        userName: user?.name || '사용자',
        cookingLevel: user?.cookingLevel || '초급',
        preferences: user?.preferences || [],
        allergies: user?.allergies || [],
        currentTime: this.getCurrentTimeContext(),
      };
    } catch (error) {
      this.logger.error('개인화 컨텍스트 조회 실패:', error.message);
      return {
        userName: '사용자',
        cookingLevel: '초급',
        preferences: [],
        allergies: [],
        currentTime: this.getCurrentTimeContext(),
      };
    }
  }

  // LangChain 기반 대화 기록 조회
  async getChatHistory(userId: string): Promise<any[]> {
    try {
      const memory = new RedisConversationMemory(this.redisService, userId);
      const memoryData = await memory.loadMemoryVariables();

      // 대화 기록을 파싱해서 반환
      const chatHistory = memoryData.chat_history;
      if (!chatHistory) return [];

      const lines = chatHistory.split('\n');
      const history = [];

      for (let i = 0; i < lines.length; i += 2) {
        if (lines[i] && lines[i + 1]) {
          history.push({
            role: lines[i].startsWith('Human:') ? 'user' : 'assistant',
            content: lines[i].replace(/^(Human|AI):\s*/, ''),
            timestamp: Date.now() - (lines.length - i) * 60000, // 임시 타임스탬프
          });
        }
      }

      return history;
    } catch (error) {
      this.logger.error('대화 기록 조회 실패:', error.message);
      return [];
    }
  }

  // LangChain 메모리 클리어
  async clearChatHistory(userId: string): Promise<void> {
    try {
      const memory = new RedisConversationMemory(this.redisService, userId);
      await memory.clear();
      this.logger.log(`🗑️ LangChain 대화 기록 클리어: ${userId}`);
    } catch (error) {
      this.logger.error(`❌ 대화 기록 클리어 실패:`, error.message);
      throw error;
    }
  }

  // 레시피 전용 체인 생성 (고급 기능)
  async createRecipeChain(userId: string): Promise<LLMChain> {
    const recipePrompt = PromptTemplate.fromTemplate(`
당신은 전문 요리사 AI입니다.

사용자 요청: {input}
사용자 알레르기: {allergies}
선호하는 요리 스타일: {preferences}

다음 형식으로 레시피를 제공해주세요:

## 🍳 요리명

**재료 (2인분):**
- 재료 1: 양
- 재료 2: 양

**조리법:**
1. 단계 1
2. 단계 2

**팁:**
- 유용한 팁

**주의사항:**
- 알레르기 관련 주의사항
`);

    const memory = new RedisConversationMemory(this.redisService, `${userId}_recipe`);

    return new LLMChain({
      llm: this.chatModel,
      prompt: recipePrompt,
      memory: memory,
    });
  }

  // RAG 체인 생성 (향후 확장용)
  async createRAGChain(userId: string): Promise<LLMChain> {
    // 향후 Elasticsearch 검색 결과를 컨텍스트로 활용하는 RAG 체인
    const ragPrompt = PromptTemplate.fromTemplate(`
검색된 레시피 정보:
{context}

사용자 질문: {input}
사용자 알레르기: {allergies}

위 검색 결과를 바탕으로 사용자의 알레르기를 고려하여 안전하고 맛있는 레시피를 추천해주세요.
`);

    const memory = new RedisConversationMemory(this.redisService, `${userId}_rag`);

    return new LLMChain({
      llm: this.chatModel,
      prompt: ragPrompt,
      memory: memory,
    });
  }

  private getCurrentTimeContext(): string {
    const now = new Date();
    const hour = now.getHours();

    if (hour < 10) return '아침 시간';
    if (hour < 14) return '점심 시간';
    if (hour < 18) return '오후 시간';
    if (hour < 21) return '저녁 시간';
    return '밤 시간';
  }

  // 체인 상태 확인 (디버깅용)
  async getChainStatus(userId: string): Promise<any> {
    try {
      const memory = new RedisConversationMemory(this.redisService, userId);
      const memoryData = await memory.loadMemoryVariables();
      const context = await this.getPersonalizedContext(userId);

      return {
        model: this.chatModel.model,
        temperature: this.chatModel.temperature,
        hasMemory: !!memoryData.chat_history,
        memoryLength: memoryData.chat_history.split('\n').length,
        userContext: context,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('체인 상태 확인 실패:', error.message);
      return { error: error.message };
    }
  }
}