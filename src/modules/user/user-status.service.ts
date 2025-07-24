import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserStatus, UserStatusDocument } from './user-status.schema';

export interface CreateUserStatusDto {
  status: string;
}

export interface UpdateUserStatusDto {
  status: string;
}

export interface UserStatusResponse {
  userId: string;
  status: string;
  isActive: boolean;
  lastUpdated: Date;
  extractedKeywords?: string[];
}

@Injectable()
export class UserStatusService {
  private readonly logger = new Logger(UserStatusService.name);

  // 간단한 키워드 추출을 위한 패턴들
  private readonly COOKING_KEYWORDS = [
    // 요리 수준
    '초보', '중급', '고급', '전문', '처음',
    // 선호도
    '좋아', '싫어', '선호', '안좋아', '못먹',
    // 제약사항
    '알레르기', '못먹어', '안됨', '금지',
    // 시간
    '빠른', '간단', '30분', '1시간', '짧은',
    // 맛 선호
    '매운', '단', '짠', '신', '담백',
  ];

  constructor(
    @InjectModel(UserStatus.name) 
    private userStatusModel: Model<UserStatusDocument>,
  ) {}

  /**
   * 사용자 상태 생성 또는 업데이트
   */
  async createOrUpdateStatus(userId: string, dto: CreateUserStatusDto): Promise<UserStatusResponse> {
    try {
      const extractedKeywords = this.extractKeywords(dto.status);
      
      const userStatus = await this.userStatusModel.findOneAndUpdate(
        { userId },
        {
          status: dto.status.trim(),
          isActive: true,
          lastUpdated: new Date(),
          extractedKeywords,
          $inc: { usageCount: 1 }
        },
        {
          upsert: true,
          new: true,
        }
      );

      this.logger.log(`사용자 상태 업데이트: ${userId} -> "${dto.status}"`);
      
      return this.toResponse(userStatus);
    } catch (error) {
      this.logger.error(`사용자 상태 업데이트 실패: ${userId}`, error);
      throw new Error('사용자 상태를 저장하는데 실패했습니다.');
    }
  }

  /**
   * 사용자 상태 조회
   */
  async getUserStatus(userId: string): Promise<UserStatusResponse | null> {
    try {
      const userStatus = await this.userStatusModel.findOne({ 
        userId,
        isActive: true 
      });

      if (!userStatus) {
        return null;
      }

      return this.toResponse(userStatus);
    } catch (error) {
      this.logger.error(`사용자 상태 조회 실패: ${userId}`, error);
      throw new Error('사용자 상태를 조회하는데 실패했습니다.');
    }
  }

  /**
   * 사용자 상태 비활성화
   */
  async deactivateStatus(userId: string): Promise<boolean> {
    try {
      const result = await this.userStatusModel.updateOne(
        { userId },
        { isActive: false }
      );

      this.logger.log(`사용자 상태 비활성화: ${userId}`);
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`사용자 상태 비활성화 실패: ${userId}`, error);
      return false;
    }
  }

  /**
   * LangGraph용 컨텍스트 생성
   */
  async getContextForLangGraph(userId: string): Promise<string> {
    const userStatus = await this.getUserStatus(userId);
    
    if (!userStatus || !userStatus.status) {
      return '';
    }

    // 간단한 컨텍스트 포맷팅
    return `[사용자 상태: ${userStatus.status}]`;
  }

  /**
   * 상태 유효성 검증
   */
  validateStatus(status: string): { isValid: boolean; error?: string } {
    if (!status || status.trim().length === 0) {
      return { isValid: false, error: '상태를 입력해주세요.' };
    }

    if (status.length > 50) {
      return { isValid: false, error: '상태는 50자 이하로 입력해주세요.' };
    }

    // 기본적인 욕설 필터링 (선택적)
    const bannedWords = ['욕설1', '욕설2']; // 실제로는 더 포괄적인 필터 사용
    if (bannedWords.some(word => status.toLowerCase().includes(word))) {
      return { isValid: false, error: '부적절한 내용이 포함되어 있습니다.' };
    }

    return { isValid: true };
  }

  /**
   * 간단한 키워드 추출
   */
  private extractKeywords(status: string): string[] {
    const keywords: string[] = [];
    const normalizedStatus = status.toLowerCase();

    for (const keyword of this.COOKING_KEYWORDS) {
      if (normalizedStatus.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  /**
   * 응답 변환
   */
  private toResponse(userStatus: UserStatusDocument): UserStatusResponse {
    return {
      userId: userStatus.userId,
      status: userStatus.status,
      isActive: userStatus.isActive,
      lastUpdated: userStatus.lastUpdated,
      extractedKeywords: userStatus.extractedKeywords,
    };
  }

  /**
   * 통계 조회 (관리자용)
   */
  async getStatusStatistics() {
    try {
      const totalUsers = await this.userStatusModel.countDocuments({ isActive: true });
      const recentlyActive = await this.userStatusModel.countDocuments({
        isActive: true,
        lastUpdated: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 최근 7일
      });

      // 인기 키워드 분석
      const keywordStats = await this.userStatusModel.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$extractedKeywords' },
        { $group: { _id: '$extractedKeywords', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      return {
        totalActiveUsers: totalUsers,
        recentlyActiveUsers: recentlyActive,
        topKeywords: keywordStats,
      };
    } catch (error) {
      this.logger.error('통계 조회 실패', error);
      throw new Error('통계를 조회하는데 실패했습니다.');
    }
  }
}