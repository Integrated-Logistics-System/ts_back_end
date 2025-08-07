/**
 * 🦜 LangChain 채팅 서비스
 * 대화 관리 및 컨텍스트 유지
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatMessageHistory } from '@langchain/community/stores/message/in_memory';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { LangChainCoreService } from './langchain-core.service';
import { LangChainPromptService } from './langchain-prompt.service';

export interface ChatSession {
  sessionId: string;
  userId?: string;
  messageHistory: ChatMessageHistory;
  metadata: {
    createdAt: Date;
    lastActivity: Date;
    messageCount: number;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  metadata: {
    messageCount: number;
    processingTime: number;
    timestamp: Date;
  };
}

@Injectable()
export class LangChainChatService {
  private readonly logger = new Logger(LangChainChatService.name);
  private sessions = new Map<string, ChatSession>();
  private readonly maxSessions = 1000;
  private readonly sessionTtl = 30 * 60 * 1000; // 30분

  constructor(
    private readonly coreService: LangChainCoreService,
    private readonly promptService: LangChainPromptService
  ) {
    // 주기적으로 만료된 세션 정리
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000); // 5분마다
  }

  /**
   * 새로운 채팅 세션 생성
   */
  createSession(sessionId: string, userId?: string): ChatSession {
    const session: ChatSession = {
      sessionId,
      userId,
      messageHistory: new ChatMessageHistory(),
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
      },
    };

    this.sessions.set(sessionId, session);
    this.logger.debug(`새 채팅 세션 생성: ${sessionId}`);

    // 세션 수 제한
    if (this.sessions.size > this.maxSessions) {
      this.cleanupOldestSession();
    }

    return session;
  }

  /**
   * 채팅 세션 조회
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 채팅 메시지 처리
   */
  async processMessage(
    sessionId: string,
    message: string,
    options?: {
      userId?: string;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    // 세션 가져오기 또는 생성
    let session = this.getSession(sessionId);
    if (!session) {
      session = this.createSession(sessionId, options?.userId);
    }

    try {
      // 사용자 메시지 추가
      await session.messageHistory.addMessage(new HumanMessage(message));
      session.metadata.lastActivity = new Date();
      session.metadata.messageCount++;

      // 대화 컨텍스트 구성
      const messages = await session.messageHistory.getMessages();
      const conversationContext = this.buildConversationContext(messages);

      // 프롬프트 생성
      const prompt = options?.systemPrompt || 
        this.promptService.createGeneralChatPrompt({
          message,
          conversationHistory: conversationContext,
        });

      // AI 응답 생성
      const aiResponse = await this.coreService.generateText(prompt, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      // AI 응답 메시지 추가
      await session.messageHistory.addMessage(new AIMessage(aiResponse));
      session.metadata.messageCount++;

      const processingTime = Date.now() - startTime;

      this.logger.debug(`채팅 응답 생성완료: ${sessionId} (${processingTime}ms)`);

      return {
        message: aiResponse,
        sessionId,
        metadata: {
          messageCount: session.metadata.messageCount,
          processingTime,
          timestamp: new Date(),
        },
      };

    } catch (error) {
      this.logger.error(`채팅 처리 실패: ${sessionId}`, error);
      throw new Error('Failed to process chat message');
    }
  }

  /**
   * 스트리밍 채팅 처리
   */
  async *processStreamingMessage(
    sessionId: string,
    message: string,
    options?: {
      userId?: string;
      systemPrompt?: string;
      temperature?: number;
    }
  ): AsyncIterable<{ content: string; done: boolean; sessionId: string }> {
    // 세션 가져오기 또는 생성
    let session = this.getSession(sessionId);
    if (!session) {
      session = this.createSession(sessionId, options?.userId);
    }

    try {
      // 사용자 메시지 추가
      await session.messageHistory.addMessage(new HumanMessage(message));
      session.metadata.lastActivity = new Date();
      session.metadata.messageCount++;

      // 대화 컨텍스트 구성
      const messages = await session.messageHistory.getMessages();
      const conversationContext = this.buildConversationContext(messages);

      // 프롬프트 생성
      const prompt = options?.systemPrompt || 
        this.promptService.createGeneralChatPrompt({
          message,
          conversationHistory: conversationContext,
        });

      // 스트리밍 응답 생성
      let fullResponse = '';
      for await (const chunk of this.coreService.generateStreamingText(prompt, {
        temperature: options?.temperature,
      })) {
        if (!chunk.done) {
          fullResponse += chunk.content;
        }

        yield {
          content: chunk.content,
          done: chunk.done,
          sessionId,
        };
      }

      // AI 응답 메시지 추가
      await session.messageHistory.addMessage(new AIMessage(fullResponse));
      session.metadata.messageCount++;

    } catch (error) {
      this.logger.error(`스트리밍 채팅 처리 실패: ${sessionId}`, error);
      yield {
        content: '죄송합니다. 메시지 처리 중 오류가 발생했습니다.',
        done: true,
        sessionId,
      };
    }
  }

  /**
   * 채팅 히스토리 조회
   */
  async getChatHistory(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const session = this.getSession(sessionId);
    if (!session) {
      return [];
    }

    try {
      const messages = await session.messageHistory.getMessages();
      const chatMessages: ChatMessage[] = messages.map((msg) => ({
        role: msg instanceof HumanMessage ? 'user' : 'assistant',
        content: msg.content as string,
        timestamp: new Date(), // LangChain 메시지에는 타임스탬프가 없어서 현재 시간 사용
      }));

      return limit ? chatMessages.slice(-limit) : chatMessages;
    } catch (error) {
      this.logger.error(`채팅 히스토리 조회 실패: ${sessionId}`, error);
      return [];
    }
  }

  /**
   * 채팅 히스토리 삭제
   */
  async clearChatHistory(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) {
      return;
    }

    try {
      session.messageHistory.clear();
      session.metadata.messageCount = 0;
      this.logger.debug(`채팅 히스토리 삭제: ${sessionId}`);
    } catch (error) {
      this.logger.error(`채팅 히스토리 삭제 실패: ${sessionId}`, error);
      throw new Error('Failed to clear chat history');
    }
  }

  /**
   * 채팅 세션 삭제
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.logger.debug(`채팅 세션 삭제: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * 대화 컨텍스트 구성
   */
  private buildConversationContext(messages: BaseMessage[]): string {
    return messages
      .slice(-10) // 최근 10개 메시지만 사용
      .map((msg) => {
        const role = msg instanceof HumanMessage ? '사용자' : '어시스턴트';
        return `${role}: ${msg.content}`;
      })
      .join('\n');
  }

  /**
   * 만료된 세션 정리
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivity = session.metadata.lastActivity.getTime();
      if (now - lastActivity > this.sessionTtl) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`만료된 세션 정리: ${cleanedCount}개`);
    }
  }

  /**
   * 가장 오래된 세션 정리
   */
  private cleanupOldestSession(): void {
    let oldestSessionId = '';
    let oldestTime = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      const createdTime = session.metadata.createdAt.getTime();
      if (createdTime < oldestTime) {
        oldestTime = createdTime;
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      this.sessions.delete(oldestSessionId);
      this.logger.debug(`가장 오래된 세션 정리: ${oldestSessionId}`);
    }
  }

  /**
   * 통계 정보 조회
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
  } {
    const now = Date.now();
    let activeSessions = 0;
    let totalMessages = 0;

    for (const session of this.sessions.values()) {
      const lastActivity = session.metadata.lastActivity.getTime();
      if (now - lastActivity < this.sessionTtl) {
        activeSessions++;
      }
      totalMessages += session.metadata.messageCount;
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalMessages,
    };
  }
}