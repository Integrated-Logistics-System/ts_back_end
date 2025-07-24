import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrialChef, TrialChefDocument } from './trial-chef.schema';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class TrialChefService {
  private readonly logger = new Logger(TrialChefService.name);

  constructor(
    @InjectModel(TrialChef.name) private trialChefModel: Model<TrialChefDocument>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 21개의 체험용 셰프 계정 초기화
   */
  async initializeTrialChefs(): Promise<void> {
    try {
      const existingCount = await this.trialChefModel.countDocuments();
      
      if (existingCount >= 21) {
        this.logger.log('체험용 셰프 계정이 이미 존재합니다.');
        return;
      }

      const trialChefs = [];
      for (let i = 1; i <= 21; i++) {
        const username = `chef_${i.toString().padStart(3, '0')}`;
        const displayName = `체험용 셰프 ${i.toString().padStart(3, '0')}`;
        
        trialChefs.push({
          username,
          displayName,
          isUsed: false,
          usageCount: 0,
          defaultSettings: {
            allergies: [],
            preferences: ['한식', '양식', '일식'],
            cookingLevel: 'beginner' as const,
            language: 'ko'
          },
          sessionDurationMs: 3600000 // 1시간
        });
      }

      await this.trialChefModel.insertMany(trialChefs);
      this.logger.log('✅ 21개의 체험용 셰프 계정이 초기화되었습니다.');
    } catch (error) {
      this.logger.error('체험용 셰프 계정 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 사용 가능한 체험용 셰프 계정 할당
   */
  async assignTrialChef(sessionId: string): Promise<TrialChef | null> {
    try {
      // 이미 할당된 세션인지 확인
      const existingAssignment = await this.trialChefModel.findOne({
        currentSessionId: sessionId,
        isUsed: true
      });

      if (existingAssignment) {
        this.logger.log(`이미 할당된 세션: ${sessionId} -> ${existingAssignment.username}`);
        return existingAssignment;
      }

      // 만료된 세션 정리
      await this.cleanupExpiredSessions();

      // 사용 가능한 계정 찾기
      const availableChef = await this.trialChefModel.findOneAndUpdate(
        { 
          isUsed: false,
          $or: [
            { sessionExpiresAt: { $exists: false } },
            { sessionExpiresAt: { $lt: new Date() } }
          ]
        },
        {
          isUsed: true,
          currentSessionId: sessionId,
          lastUsedAt: new Date(),
          sessionExpiresAt: new Date(Date.now() + 3600000), // 1시간 후 만료
          $inc: { usageCount: 1 }
        },
        { new: true }
      );

      if (!availableChef) {
        this.logger.warn('사용 가능한 체험용 셰프 계정이 없습니다.');
        return null;
      }

      // 캐시에 할당 정보 저장
      await this.cacheService.set(
        `trial_chef_session:${sessionId}`,
        availableChef.username,
        3600 // 1시간
      );

      this.logger.log(`✅ 체험용 셰프 할당: ${availableChef.username} -> 세션 ${sessionId}`);
      return availableChef;
    } catch (error) {
      this.logger.error('체험용 셰프 할당 실패:', error);
      return null;
    }
  }

  /**
   * 체험용 셰프 세션 해제
   */
  async releaseTrialChef(sessionId: string): Promise<boolean> {
    try {
      const releasedChef = await this.trialChefModel.findOneAndUpdate(
        { currentSessionId: sessionId, isUsed: true },
        {
          isUsed: false,
          $unset: { 
            currentSessionId: 1,
            sessionExpiresAt: 1
          }
        },
        { new: true }
      );

      if (releasedChef) {
        // 캐시에서 세션 정보 삭제
        await this.cacheService.del(`trial_chef_session:${sessionId}`);
        this.logger.log(`✅ 체험용 셰프 해제: ${releasedChef.username} <- 세션 ${sessionId}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('체험용 셰프 해제 실패:', error);
      return false;
    }
  }

  /**
   * 사용 가능한 체험용 셰프 계정 수 조회
   */
  async getAvailableChefCount(): Promise<number> {
    try {
      // 만료된 세션 정리
      await this.cleanupExpiredSessions();

      const availableCount = await this.trialChefModel.countDocuments({
        $or: [
          { isUsed: false },
          { 
            isUsed: true,
            sessionExpiresAt: { $lt: new Date() }
          }
        ]
      });

      return availableCount;
    } catch (error) {
      this.logger.error('사용 가능한 셰프 수 조회 실패:', error);
      return 0;
    }
  }

  /**
   * 체험용 셰프 계정 정보 조회
   */
  async getTrialChefBySessionId(sessionId: string): Promise<TrialChef | null> {
    try {
      // 먼저 캐시에서 확인
      const cachedUsername = await this.cacheService.get<string>(`trial_chef_session:${sessionId}`);
      
      if (cachedUsername) {
        const chef = await this.trialChefModel.findOne({ username: cachedUsername });
        if (chef && chef.isUsed && chef.currentSessionId === sessionId) {
          return chef;
        }
      }

      // 캐시에 없으면 DB에서 직접 조회
      const chef = await this.trialChefModel.findOne({
        currentSessionId: sessionId,
        isUsed: true
      });

      return chef;
    } catch (error) {
      this.logger.error('체험용 셰프 조회 실패:', error);
      return null;
    }
  }

  /**
   * 만료된 세션 정리
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await this.trialChefModel.updateMany(
        {
          isUsed: true,
          sessionExpiresAt: { $lt: new Date() }
        },
        {
          isUsed: false,
          $unset: {
            currentSessionId: 1,
            sessionExpiresAt: 1
          }
        }
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`🧹 ${result.modifiedCount}개의 만료된 체험용 셰프 세션 정리 완료`);
      }
    } catch (error) {
      this.logger.error('만료된 세션 정리 실패:', error);
    }
  }

  /**
   * 체험용 셰프 세션 연장
   */
  async extendTrialChefSession(sessionId: string, extendMinutes: number = 60): Promise<boolean> {
    try {
      const chef = await this.trialChefModel.findOneAndUpdate(
        {
          currentSessionId: sessionId,
          isUsed: true
        },
        {
          sessionExpiresAt: new Date(Date.now() + extendMinutes * 60000),
          lastUsedAt: new Date()
        },
        { new: true }
      );

      if (chef) {
        // 캐시 TTL도 연장
        await this.cacheService.set(
          `trial_chef_session:${sessionId}`,
          chef.username,
          extendMinutes * 60
        );
        
        this.logger.log(`⏰ 체험용 셰프 세션 연장: ${chef.username} -> ${extendMinutes}분`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('체험용 셰프 세션 연장 실패:', error);
      return false;
    }
  }

  /**
   * 체험용 셰프 통계
   */
  async getTrialChefStats(): Promise<{
    total: number;
    available: number;
    inUse: number;
    totalUsageCount: number;
  }> {
    try {
      await this.cleanupExpiredSessions();

      const [total, available, inUse, usageStats] = await Promise.all([
        this.trialChefModel.countDocuments(),
        this.trialChefModel.countDocuments({ isUsed: false }),
        this.trialChefModel.countDocuments({ isUsed: true }),
        this.trialChefModel.aggregate([
          { $group: { _id: null, totalUsage: { $sum: '$usageCount' } } }
        ])
      ]);

      return {
        total,
        available,
        inUse,
        totalUsageCount: usageStats[0]?.totalUsage || 0
      };
    } catch (error) {
      this.logger.error('체험용 셰프 통계 조회 실패:', error);
      return { total: 0, available: 0, inUse: 0, totalUsageCount: 0 };
    }
  }

  /**
   * 체험용 셰프 강제 리셋 (관리자용)
   */
  async resetAllTrialChefs(): Promise<void> {
    try {
      await this.trialChefModel.updateMany(
        {},
        {
          isUsed: false,
          $unset: {
            currentSessionId: 1,
            sessionExpiresAt: 1
          }
        }
      );

      // 관련 캐시 정리
      if (this.cacheService.isRedisEnabled()) {
        const redisClient = this.cacheService.getRedisClient();
        if (redisClient) {
          // trial_chef_session:* 패턴의 모든 키 삭제
          let cursor = '0';
          do {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            const reply = await (redisClient as any).scan(cursor, 'MATCH', 'trial_chef_session:*', 'COUNT', 100) as [string, string[]];
            cursor = reply[0];
            const keys = reply[1];
            
            if (keys.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
              await (redisClient as any).del(...keys);
            }
          } while (cursor !== '0');
        }
      }

      this.logger.log('🔄 모든 체험용 셰프 계정 리셋 완료');
    } catch (error) {
      this.logger.error('체험용 셰프 리셋 실패:', error);
      throw error;
    }
  }
}