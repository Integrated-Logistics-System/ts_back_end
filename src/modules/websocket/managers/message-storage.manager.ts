import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import {
  ChatMessage,
  MessageStorageResult,
  ChatMessageMetadata,
} from '../interfaces/chat.interface';

@Injectable()
export class MessageStorageManager {
  private readonly logger = new Logger(MessageStorageManager.name);
  private readonly maxRetryAttempts = 3;
  private readonly retryDelayMs = 1000;

  constructor(private readonly cacheService: CacheService) {}

  /**
   * 메시지 저장 및 검증
   */
  async saveAndVerifyMessage(
    message: string,
    role: 'user' | 'assistant',
    userId: string,
    metadata?: ChatMessageMetadata
  ): Promise<MessageStorageResult> {
    const chatMessage: ChatMessage = {
      id: this.generateMessageId(),
      content: message,
      role,
      timestamp: new Date(),
      userId,
      metadata,
    };

    return await this.saveWithRetry(chatMessage);
  }

  /**
   * 재시도 로직을 포함한 메시지 저장
   */
  private async saveWithRetry(
    message: ChatMessage,
    attempt: number = 1
  ): Promise<MessageStorageResult> {
    try {
      // 메인 저장 시도
      const success = await this.attemptMessageSave(message);
      
      if (success) {
        // 저장 검증
        const verified = await this.verifyMessageSave(message.id);
        
        if (verified) {
          this.logger.debug(`Message saved successfully: ${message.id}`);
          return { success: true, messageId: message.id };
        } else {
          this.logger.warn(`Message save verification failed: ${message.id}`);
          return await this.handleSaveRetry(message, attempt, 'VERIFICATION_FAILED');
        }
      } else {
        this.logger.warn(`Message save failed: ${message.id}`);
        return await this.handleSaveRetry(message, attempt, 'SAVE_FAILED');
      }
    } catch (error) {
      this.logger.error(`Message save error (attempt ${attempt}):`, error);
      return await this.handleSaveRetry(message, attempt, 'SAVE_ERROR', error);
    }
  }

  /**
   * 메시지 저장 시도
   */
  private async attemptMessageSave(message: ChatMessage): Promise<boolean> {
    try {
      if (!message.userId || !message.id) {
        this.logger.warn('Message missing userId or id, skipping save');
        return false;
      }
      const key = this.getMessageKey(message.userId, message.id);
      const ttl = 7 * 24 * 60 * 60; // 7일

      await this.cacheService.set(key, message, ttl);
      
      // 대화 기록에도 추가
      await this.addToConversationHistory(message);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to save message:', error);
      return false;
    }
  }

  /**
   * 메시지 저장 검증
   */
  private async verifyMessageSave(messageId: string): Promise<boolean> {
    try {
      // 약간의 지연 후 검증
      await this.delay(100);
      
      const keys = await this.cacheService.getKeysPattern(`*:message:${messageId}`);
      return keys.length > 0;
    } catch (error) {
      this.logger.error('Message verification failed:', error);
      return false;
    }
  }

  /**
   * 저장 재시도 처리
   */
  private async handleSaveRetry(
    message: ChatMessage,
    attempt: number,
    errorCode: string,
    error?: any
  ): Promise<MessageStorageResult> {
    if (attempt >= this.maxRetryAttempts) {
      this.logger.error(`Max retry attempts reached for message: ${message.id}`);
      
      // 백업 저장 시도
      const backupResult = await this.triggerBackupSave(message);
      
      return {
        success: false,
        error: {
          code: errorCode,
          message: error?.message || `Failed after ${attempt} attempts`,
          retryCount: attempt,
        },
        backupUsed: backupResult,
      };
    }

    // 재시도 전 지연
    await this.delay(this.retryDelayMs * attempt);
    
    this.logger.warn(`Retrying message save (attempt ${attempt + 1}): ${message.id}`);
    return await this.saveWithRetry(message, attempt + 1);
  }

  /**
   * 백업 저장 트리거
   */
  private async triggerBackupSave(message: ChatMessage): Promise<boolean> {
    try {
      if (!message.userId || !message.id) {
        this.logger.warn('Message missing userId or id, skipping backup save');
        return false;
      }
      
      this.logger.warn(`Triggering backup save for message: ${message.id}`);
      
      // 임시 로컬 저장소에 저장 (실제 구현에서는 파일 시스템이나 다른 DB 사용)
      const backupKey = `backup:${message.userId}:${message.id}`;
      await this.cacheService.set(backupKey, message, 24 * 60 * 60); // 1일
      
      // 백업 메타데이터 업데이트
      await this.updateBackupMetadata(message.userId, message.id);
      
      return true;
    } catch (error) {
      this.logger.error('Backup save failed:', error);
      return false;
    }
  }

  /**
   * 대화 기록에 메시지 추가
   */
  private async addToConversationHistory(message: ChatMessage): Promise<void> {
    try {
      const historyKey = this.getHistoryKey(message.userId!);
      
      // 기존 기록 조회
      const existingHistory = await this.cacheService.get<ChatMessage[]>(historyKey) || [];
      
      // 새 메시지 추가
      const updatedHistory = [...existingHistory, message];
      
      // 최대 기록 수 제한 (예: 1000개)
      const maxHistorySize = 1000;
      if (updatedHistory.length > maxHistorySize) {
        updatedHistory.splice(0, updatedHistory.length - maxHistorySize);
      }
      
      // 업데이트된 기록 저장
      const historyTtl = 30 * 24 * 60 * 60; // 30일
      await this.cacheService.set(historyKey, updatedHistory, historyTtl);
      
      this.logger.debug(`Added message to conversation history: ${message.id}`);
    } catch (error) {
      this.logger.error('Failed to add message to conversation history:', error);
      // 기록 추가 실패는 메시지 저장 실패로 간주하지 않음
    }
  }

  /**
   * 대화 기록 조회
   */
  async getConversationHistory(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<ChatMessage[]> {
    try {
      const historyKey = this.getHistoryKey(userId);
      const history = await this.cacheService.get<ChatMessage[]>(historyKey) || [];
      
      // 최신 메시지부터 정렬
      const sortedHistory = history.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // 페이지네이션 적용
      if (offset !== undefined || limit !== undefined) {
        const start = offset || 0;
        const end = limit ? start + limit : undefined;
        return sortedHistory.slice(start, end);
      }
      
      return sortedHistory;
    } catch (error) {
      this.logger.error('Failed to get conversation history:', error);
      return [];
    }
  }

  /**
   * 메시지 조회
   */
  async getMessage(userId: string, messageId: string): Promise<ChatMessage | null> {
    try {
      const key = this.getMessageKey(userId, messageId);
      return await this.cacheService.get<ChatMessage>(key);
    } catch (error) {
      this.logger.error('Failed to get message:', error);
      return null;
    }
  }

  /**
   * 메시지 삭제
   */
  async deleteMessage(userId: string, messageId: string): Promise<boolean> {
    try {
      const key = this.getMessageKey(userId, messageId);
      await this.cacheService.delete(key);
      
      // 대화 기록에서도 제거
      await this.removeFromConversationHistory(userId, messageId);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to delete message:', error);
      return false;
    }
  }

  /**
   * 사용자의 모든 메시지 삭제
   */
  async clearUserMessages(userId: string): Promise<boolean> {
    try {
      // 대화 기록 삭제
      const historyKey = this.getHistoryKey(userId);
      await this.cacheService.delete(historyKey);
      
      // 개별 메시지들 삭제
      const messageKeys = await this.cacheService.getKeysPattern(`${userId}:message:*`);
      if (messageKeys.length > 0) {
        await this.cacheService.deleteMany(messageKeys);
      }
      
      // 백업 메시지들도 삭제
      const backupKeys = await this.cacheService.getKeysPattern(`backup:${userId}:*`);
      if (backupKeys.length > 0) {
        await this.cacheService.deleteMany(backupKeys);
      }
      
      this.logger.log(`Cleared all messages for user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to clear user messages:', error);
      return false;
    }
  }

  // ==================== Private Helper Methods ====================

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMessageKey(userId: string, messageId: string): string {
    return `${userId}:message:${messageId}`;
  }

  private getHistoryKey(userId: string): string {
    return `${userId}:chat_history`;
  }

  private async removeFromConversationHistory(userId: string, messageId: string): Promise<void> {
    try {
      const historyKey = this.getHistoryKey(userId);
      const history = await this.cacheService.get<ChatMessage[]>(historyKey) || [];
      
      const filteredHistory = history.filter(msg => msg.id !== messageId);
      
      if (filteredHistory.length !== history.length) {
        await this.cacheService.set(historyKey, filteredHistory, 30 * 24 * 60 * 60);
        this.logger.debug(`Removed message from conversation history: ${messageId}`);
      }
    } catch (error) {
      this.logger.error('Failed to remove message from conversation history:', error);
    }
  }

  private async updateBackupMetadata(userId: string, messageId: string): Promise<void> {
    try {
      const metadataKey = `backup_metadata:${userId}`;
      const metadata = await this.cacheService.get<any>(metadataKey) || { messages: [] };
      
      metadata.messages.push({
        messageId,
        timestamp: new Date().toISOString(),
        reason: 'main_storage_failed',
      });
      
      // 최대 100개의 백업 메타데이터만 유지
      if (metadata.messages.length > 100) {
        metadata.messages = metadata.messages.slice(-100);
      }
      
      await this.cacheService.set(metadataKey, metadata, 7 * 24 * 60 * 60);
    } catch (error) {
      this.logger.error('Failed to update backup metadata:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}