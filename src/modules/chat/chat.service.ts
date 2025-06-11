import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from '../ai/services/ollama.service';
import { RecipeRecommendationService } from '../ai/services/recipe-recommendation.service';
import { RAGService } from '../ai/services/rag.service';
import { VectorService } from '../vector/services/vector.service';
import { VectorSourceType } from '../vector/dto/create-vector.dto';
import { RecipeService } from '../recipe/recipe.service';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  userId?: string;
  messages: ChatMessage[];
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatResponse {
  message: ChatMessage;
  suggestions?: string[];
  relatedRecipes?: any[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private sessions: Map<string, ChatSession> = new Map();

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly recipeRecommendationService: RecipeRecommendationService,
    private readonly ragService: RAGService,
    private readonly vectorService: VectorService,
    private readonly recipeService: RecipeService,
  ) {}

  async createSession(userId?: string): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: ChatSession = {
      id: sessionId,
      userId,
      messages: [],
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, session);

    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content:
        '안녕하세요! 스마트 레시피 챗봇입니다. 요리에 관한 질문이나 레시피 추천을 도와드릴게요. 어떤 도움이 필요하신가요?',
      timestamp: new Date(),
    };

    session.messages.push(welcomeMessage);

    this.logger.log(
      `Created chat session ${sessionId} for user ${userId || 'anonymous'}`,
    );
    return sessionId;
  }

  async sendMessage(
    sessionId: string,
    userMessage: string,
  ): Promise<ChatResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Chat session ${sessionId} not found`);
    }

    // Add user message to session
    const userMsgId = `msg_${Date.now()}`;
    const userChatMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    session.messages.push(userChatMessage);

    try {
      // Analyze message intent
      const intent = await this.analyzeIntent(userMessage);

      let response: ChatResponse;

      switch (intent.type) {
        case 'recipe_search':
          response = await this.handleRecipeSearch(
            session,
            userMessage,
            intent,
          );
          break;
        case 'recipe_recommendation':
          response = await this.handleRecipeRecommendation(
            session,
            userMessage,
            intent,
          );
          break;
        case 'cooking_question':
          response = await this.handleCookingQuestion(
            session,
            userMessage,
            intent,
          );
          break;
        default:
          response = await this.handleGeneralChat(session, userMessage);
      }

      // Add assistant message to session
      session.messages.push(response.message);
      session.updatedAt = new Date();

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to process message in session ${sessionId}`,
        error,
      );

      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content:
          '죄송합니다. 메시지 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
        timestamp: new Date(),
      };

      session.messages.push(errorMessage);

      return {
        message: errorMessage,
        suggestions: [
          '다른 질문을 해보세요',
          '레시피 추천 받기',
          '요리 팁 문의',
        ],
      };
    }
  }

  private async analyzeIntent(
    message: string,
  ): Promise<{ type: string; entities: Record<string, any> }> {
    const prompt = `
다음 사용자 메시지의 의도를 분석해주세요:

사용자 메시지: "${message}"

가능한 의도 유형:
1. recipe_search - 특정 레시피를 찾고 있음
2. recipe_recommendation - 재료나 선호도 기반 레시피 추천 요청
3. cooking_question - 요리 방법이나 팁에 대한 질문
4. general_chat - 일반적인 대화나 인사

응답 형식 (JSON만):
{
  "type": "recipe_search|recipe_recommendation|cooking_question|general_chat",
  "entities": {
    "ingredients": ["재료1", "재료2"],
    "cuisine": "요리 종류",
    "difficulty": "난이도",
    "cookingTime": "조리시간",
    "keywords": ["키워드1", "키워드2"]
  }
}
`;

    try {
      const response = await this.ollamaService.generate(prompt, {
        temperature: 0.3,
      });
      return JSON.parse(response);
    } catch (error) {
      this.logger.warn('Failed to analyze intent, using fallback');
      return { type: 'general_chat', entities: {} };
    }
  }

  private async handleRecipeSearch(
    session: ChatSession,
    userMessage: string,
    intent: any,
  ): Promise<ChatResponse> {
    try {
      // Search for recipes using semantic search
      const vectorResults = await this.vectorService.searchVectors({
        query: userMessage,
        topK: 5,
        threshold: 0.6,
        namespace: 'recipes',
        includeMetadata: true,
      });

      const recipes: any[] = [];
      for (const result of vectorResults) {
        if (result.sourceId) {
          try {
            const recipe = await this.recipeService.findById(result.sourceId);
            recipes.push(recipe);
          } catch (error) {
            // Recipe not found, skip
          }
        }
      }

      let responseText;
      if (recipes.length > 0) {
        responseText = `"${userMessage}"와 관련된 레시피를 ${recipes.length}개 찾았습니다:\n\n`;
        recipes.forEach((recipe, index) => {
          responseText += `${index + 1}. **${recipe.name}**\n`;
          responseText += `   - 조리시간: ${recipe.cookingTime}분\n`;
          responseText += `   - 난이도: ${recipe.difficulty}\n`;
          if (recipe.description) {
            responseText += `   - 설명: ${recipe.description}\n`;
          }
          responseText += '\n';
        });
      } else {
        responseText = `"${userMessage}"와 관련된 레시피를 찾지 못했습니다. 다른 검색어로 시도해보시거나 재료 기반 추천을 받아보세요.`;
      }

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        metadata: { foundRecipes: recipes.length },
      };

      return {
        message: assistantMessage,
        relatedRecipes: recipes,
        suggestions: [
          '비슷한 다른 레시피 찾기',
          '재료 기반 추천 받기',
          '요리 방법 문의하기',
        ],
      };
    } catch (error) {
      this.logger.error('Recipe search failed', error);
      throw error;
    }
  }

  private async handleRecipeRecommendation(
    session: ChatSession,
    userMessage: string,
    intent: any,
  ): Promise<ChatResponse> {
    try {
      const ingredients = intent.entities.ingredients || [];

      if (ingredients.length === 0) {
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content:
            '레시피 추천을 위해 가지고 계신 재료들을 알려주세요. 예: "닭가슴살, 양파, 마늘이 있어요"',
          timestamp: new Date(),
        };

        return {
          message: assistantMessage,
          suggestions: [
            '닭가슴살, 양파, 마늘',
            '소고기, 감자, 당근',
            '두부, 김치, 돼지고기',
          ],
        };
      }

      const recommendation =
        await this.recipeRecommendationService.recommendRecipes({
          ingredients,
          userPreferences: {
            cuisineTypes: intent.entities.cuisine
              ? [intent.entities.cuisine]
              : undefined,
            cookingSkill: intent.entities.difficulty || 'intermediate',
            maxCookingTime: intent.entities.cookingTime || undefined,
          },
          maxResults: 3,
        });

      let responseText = `${ingredients.join(', ')}로 만들 수 있는 레시피를 추천드릴게요!\n\n`;
      responseText += recommendation.explanation + '\n\n';

      recommendation.recommendations.forEach((recipe, index) => {
        responseText += `${index + 1}. **${recipe.name}**\n`;
        responseText += `   - 조리시간: ${recipe.cookingTime}분\n`;
        responseText += `   - 난이도: ${recipe.difficulty}\n`;
        responseText += `   - 요약: ${recipe.summary}\n\n`;
      });

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        metadata: { recommendedCount: recommendation.recommendations.length },
      };

      return {
        message: assistantMessage,
        relatedRecipes: recommendation.recommendations,
        suggestions: [
          '다른 재료로 추천받기',
          '자세한 레시피 보기',
          '요리 팁 문의하기',
        ],
      };
    } catch (error) {
      this.logger.error('Recipe recommendation failed', error);
      throw error;
    }
  }

  private async handleCookingQuestion(
    session: ChatSession,
    userMessage: string,
    intent: any,
  ): Promise<ChatResponse> {
    try {
      // RAG를 사용하여 더 정확한 답변 생성
      const ragResponse = await this.ragService.askRecipeQuestion(userMessage, {
        maxDocuments: 3,
        relevanceThreshold: 0.6,
        temperature: 0.7,
      });

      let responseText = ragResponse.answer;

      // 신뢰도가 낮으면 일반적인 답변도 포함
      if (ragResponse.confidence < 0.7) {
        responseText +=
          '\n\n💡 추가 정보: 더 구체적인 질문을 해주시면 정확한 답변을 드릴 수 있습니다.';
      }

      // 소스 정보가 있으면 참고 정보 추가
      if (ragResponse.sources.length > 0) {
        responseText += '\n\n📚 참고 정보:';
        ragResponse.sources.slice(0, 2).forEach((source, index) => {
          responseText += `\n${index + 1}. ${source.title} (관련도: ${Math.round(source.relevanceScore * 100)}%)`;
        });
      }

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        metadata: {
          ragUsed: true,
          confidence: ragResponse.confidence,
          sourcesCount: ragResponse.sources.length,
        },
      };

      return {
        message: assistantMessage,
        suggestions: [
          '다른 요리 팁 문의',
          '레시피 추천 받기',
          '재료 대체 방법 문의',
        ],
      };
    } catch (error) {
      this.logger.error(
        'RAG cooking question handling failed, falling back to simple chat',
        error,
      );
      return this.handleCookingQuestionFallback(session, userMessage, intent);
    }
  }

  private async handleCookingQuestionFallback(
    session: ChatSession,
    userMessage: string,
    intent: any,
  ): Promise<ChatResponse> {
    const prompt = `
요리 전문가로서 다음 질문에 친근하고 도움이 되는 답변을 해주세요.

사용자 질문: ${userMessage}

요구사항:
1. 정확하고 실용적인 정보 제공
2. 한국어로 자연스럽게 작성
3. 초보자도 이해하기 쉽게 설명
4. 필요시 단계별 설명 포함
5. 200-400자 내외로 작성

답변:
`;

    try {
      const response = await this.ollamaService.generate(prompt, {
        temperature: 0.7,
        maxTokens: 500,
      });

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: response.trim(),
        timestamp: new Date(),
      };

      return {
        message: assistantMessage,
        suggestions: [
          '다른 요리 팁 문의',
          '레시피 추천 받기',
          '재료 대체 방법 문의',
        ],
      };
    } catch (error) {
      this.logger.error('Cooking question handling failed', error);
      throw error;
    }
  }

  private async handleGeneralChat(
    session: ChatSession,
    userMessage: string,
  ): Promise<ChatResponse> {
    const prompt = `
당신은 친근한 요리 전문 챗봇입니다. 사용자와 자연스럽게 대화하면서 요리와 관련된 도움을 제공하세요.

사용자 메시지: ${userMessage}

이전 대화 맥락:
${session.messages
  .slice(-4)
  .map((msg) => `${msg.role}: ${msg.content}`)
  .join('\n')}

요구사항:
1. 친근하고 도움이 되는 톤으로 응답
2. 요리와 관련된 주제로 자연스럽게 유도
3. 한국어로 자연스럽게 작성
4. 100-200자 내외로 간결하게 작성

응답:
`;

    try {
      const response = await this.ollamaService.generate(prompt, {
        temperature: 0.8,
        maxTokens: 300,
      });

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: response.trim(),
        timestamp: new Date(),
      };

      return {
        message: assistantMessage,
        suggestions: [
          '레시피 추천 받기',
          '요리 방법 문의하기',
          '재료 활용법 알아보기',
        ],
      };
    } catch (error) {
      this.logger.error('General chat handling failed', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  // RAG 기반 고급 채팅 메서드
  async sendRAGMessage(
    sessionId: string,
    userMessage: string,
  ): Promise<ChatResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Chat session ${sessionId} not found`);
    }

    // Add user message to session
    const userMsgId = `msg_${Date.now()}`;
    const userChatMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    session.messages.push(userChatMessage);

    try {
      // 대화 히스토리 구성
      const conversationHistory = session.messages
        .filter((msg) => msg.role !== 'system')
        .slice(-6) // 최근 6개 메시지만
        .map((msg) => ({
          question: msg.role === 'user' ? msg.content : '',
          answer: msg.role === 'assistant' ? msg.content : '',
        }))
        .filter((item) => item.question || item.answer);

      // RAG 기반 답변 생성
      const ragResponse = await this.ragService.askWithConversationHistory(
        userMessage,
        conversationHistory,
        {
          maxDocuments: 5,
          relevanceThreshold: 0.6,
          temperature: 0.7,
          model: 'llama3.1',
        },
      );

      let responseText = ragResponse.answer;

      // 신뢰도 표시 및 추가 정보
      if (ragResponse.confidence >= 0.8) {
        responseText += '\n\n✅ 높은 신뢰도로 답변드렸습니다.';
      } else if (ragResponse.confidence >= 0.6) {
        responseText += '\n\n💡 참고 정보를 바탕으로 답변드렸습니다.';
      } else {
        responseText +=
          '\n\n⚠️ 관련 정보가 부족하여 일반적인 답변을 드렸습니다.';
      }

      // 소스 정보 추가
      if (ragResponse.sources.length > 0) {
        responseText += '\n\n📖 참고한 레시피:';
        ragResponse.sources.slice(0, 3).forEach((source, index) => {
          responseText += `\n${index + 1}. ${source.title}`;
        });
      }

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        metadata: {
          ragUsed: true,
          confidence: ragResponse.confidence,
          sourcesCount: ragResponse.sources.length,
          contextDocuments: ragResponse.context?.totalRetrieved || 0,
        },
      };

      session.messages.push(assistantMessage);
      session.updatedAt = new Date();

      // 관련 레시피 정보 구성
      const relatedRecipes: any[] = [];
      for (const source of ragResponse.sources.slice(0, 3)) {
        try {
          const recipe = await this.recipeService.findById(source.id);
          relatedRecipes.push(recipe);
        } catch (error) {
          // 레시피를 찾을 수 없으면 스킵
        }
      }

      return {
        message: assistantMessage,
        relatedRecipes,
        suggestions: this.generateSmartSuggestions(userMessage, ragResponse),
      };
    } catch (error) {
      this.logger.error(
        `RAG message processing failed in session ${sessionId}`,
        error,
      );

      // 폴백: 일반 채팅으로 처리
      return this.sendMessage(sessionId, userMessage);
    }
  }

  private generateSmartSuggestions(
    userMessage: string,
    ragResponse: any,
  ): string[] {
    const suggestions: string[] = [];

    // 요리 관련 키워드에 따른 제안
    if (userMessage.includes('레시피') || userMessage.includes('만들기')) {
      suggestions.push('비슷한 레시피 더 보기', '재료 대체 방법', '조리 팁');
    } else if (userMessage.includes('재료') || userMessage.includes('식재료')) {
      suggestions.push('재료 활용 레시피', '보관법', '영양 정보');
    } else if (userMessage.includes('요리') || userMessage.includes('조리')) {
      suggestions.push('요리 기법 설명', '도구 사용법', '시간 단축 팁');
    } else {
      suggestions.push('레시피 추천', '요리 팁', '재료 문의');
    }

    // 신뢰도에 따른 추가 제안
    if (ragResponse.confidence < 0.7) {
      suggestions.push('더 구체적으로 질문하기');
    }

    return suggestions.slice(0, 4); // 최대 4개까지만
  }
}
