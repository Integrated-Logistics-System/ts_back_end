// 고도화된 사용자 개인화 서비스
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { UserBehavior, UserBehaviorDocument } from './user-behavior.schema';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';

export interface PersonalizationProfile {
  userId: string;
  preferences: {
    cuisineTypes: string[];
    flavorProfiles: string[];
    cookingMethods: string[];
    dietaryRestrictions: string[];
    timePreferences: string[];
    difficultyPreference: string;
    ingredientAffinities: string[];
  };
  behaviors: {
    cookingFrequency: number;
    averageRating: number;
    preferredMealTimes: string[];
    seasonalPatterns: Record<string, number>;
    contextualPreferences: Record<string, any>;
  };
  recommendations: {
    weightedScores: Record<string, number>;
    boostFactors: Record<string, number>;
    negativeSignals: string[];
    diversityFactors: Record<string, number>;
  };
  metadata: {
    profileStrength: number; // 0-100
    lastUpdated: Date;
    totalInteractions: number;
    confidenceScore: number;
  };
}

export interface PersonalizationInsights {
  topCuisines: Array<{ cuisine: string; score: number; count: number }>;
  flavorProfile: Array<{ flavor: string; preference: number }>;
  cookingPatterns: {
    bestTimes: string[];
    preferredDifficulty: string;
    avgCookingTime: number;
    frequentIngredients: string[];
  };
  healthTrends: {
    healthScore: number;
    nutritionFocus: string[];
    dietaryConsistency: number;
  };
  socialPatterns: {
    sharingBehavior: number;
    reviewFrequency: number;
    communityEngagement: number;
  };
}

@Injectable()
export class UserPersonalizationService {
  private readonly logger = new Logger(UserPersonalizationService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehaviorDocument>,
    private elasticsearchService: ElasticsearchService,
  ) {}

  /**
   * 사용자의 종합 개인화 프로필 생성
   */
  async generatePersonalizationProfile(userId: string): Promise<PersonalizationProfile> {
    try {
      this.logger.debug(`Generating personalization profile for user: ${userId}`);

      // 병렬로 데이터 수집
      const [user, recentBehaviors, historicalBehaviors] = await Promise.all([
        this.userModel.findById(userId).lean(),
        this.behaviorModel
          .find({ userId })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
        this.behaviorModel
          .find({ userId })
          .sort({ createdAt: -1 })
          .limit(1000)
          .lean(),
      ]);

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // 프로필 구성 요소들 계산
      const preferences = await this.calculatePreferences(user, recentBehaviors, historicalBehaviors);
      const behaviors = await this.analyzeBehaviorPatterns(historicalBehaviors);
      const recommendations = await this.generateRecommendationWeights(preferences, behaviors);
      const metadata = this.calculateProfileMetadata(user, historicalBehaviors);

      const profile: PersonalizationProfile = {
        userId,
        preferences,
        behaviors,
        recommendations,
        metadata,
      };

      // 프로필을 캐시에 저장 (Redis)
      await this.cachePersonalizationProfile(userId, profile);

      return profile;
    } catch (error) {
      this.logger.error(`Failed to generate personalization profile for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 사용자 선호도 계산
   */
  private async calculatePreferences(
    user: UserDocument,
    recentBehaviors: UserBehaviorDocument[],
    historicalBehaviors: UserBehaviorDocument[]
  ) {
    // 명시적 선호도 (사용자 설정)
    const explicitPreferences = {
      cuisineTypes: user.settings?.preferences || [],
      dietaryRestrictions: [
        ...(user.settings?.allergies || []),
        ...(user.dietaryInfo?.intolerances || []),
      ],
    };

    // 행동 기반 암시적 선호도
    const implicitPreferences = await this.extractImplicitPreferences(historicalBehaviors);

    // 최근 행동 기반 트렌드
    const recentTrends = await this.calculateRecentTrends(recentBehaviors);

    return {
      cuisineTypes: this.combinePreferences(
        explicitPreferences.cuisineTypes,
        implicitPreferences.cuisineTypes,
        recentTrends.cuisineTypes
      ),
      flavorProfiles: implicitPreferences.flavorProfiles,
      cookingMethods: implicitPreferences.cookingMethods,
      dietaryRestrictions: explicitPreferences.dietaryRestrictions,
      timePreferences: implicitPreferences.timePreferences,
      difficultyPreference: implicitPreferences.difficultyPreference,
      ingredientAffinities: implicitPreferences.ingredientAffinities,
    };
  }

  /**
   * 행동 패턴 분석
   */
  private async analyzeBehaviorPatterns(behaviors: UserBehaviorDocument[]) {
    if (behaviors.length === 0) {
      return this.getDefaultBehaviorPatterns();
    }

    // 요리 빈도 계산
    const cookingBehaviors = behaviors.filter(b => b.actionType === 'cook');
    const cookingFrequency = this.calculateCookingFrequency(cookingBehaviors);

    // 평균 평점 계산
    const ratingBehaviors = behaviors.filter(b => b.actionType === 'rate' && b.rating);
    const averageRating = ratingBehaviors.length > 0
      ? ratingBehaviors.reduce((sum, b) => sum + (b.rating || 0), 0) / ratingBehaviors.length
      : 3.0;

    // 선호 시간대 분석
    const preferredMealTimes = this.analyzeTimePreferences(behaviors);

    // 계절별 패턴 분석
    const seasonalPatterns = this.analyzeSeasonalPatterns(behaviors);

    // 맥락별 선호도 분석
    const contextualPreferences = this.analyzeContextualPreferences(behaviors);

    return {
      cookingFrequency,
      averageRating,
      preferredMealTimes,
      seasonalPatterns,
      contextualPreferences,
    };
  }

  /**
   * 추천 가중치 생성
   */
  private async generateRecommendationWeights(preferences: any, behaviors: any) {
    // 기본 가중치
    const baseWeights = {
      recency: 0.3,
      popularity: 0.2,
      similarity: 0.3,
      personalization: 0.2,
    };

    // 사용자 활동도에 따른 개인화 가중치 조정
    const personalizationBoost = Math.min(behaviors.cookingFrequency / 10, 1.0);
    const adjustedWeights = {
      ...baseWeights,
      personalization: baseWeights.personalization + (personalizationBoost * 0.3),
      popularity: baseWeights.popularity - (personalizationBoost * 0.15),
    };

    // 부스트 팩터 계산
    const boostFactors = {
      healthyRecipes: preferences.dietaryRestrictions.length > 0 ? 1.5 : 1.0,
      quickRecipes: preferences.timePreferences.includes('quick') ? 1.3 : 1.0,
      favoriteCuisine: 1.4,
      seasonalRecipes: 1.2,
    };

    // 부정적 신호
    const negativeSignals = [
      ...preferences.dietaryRestrictions,
      ...this.extractDislikedItems(behaviors),
    ];

    // 다양성 팩터
    const diversityFactors = {
      cuisineVariety: 0.8, // 80% 선호 요리, 20% 다양성
      difficultySpread: 0.7,
      timeVariation: 0.6,
    };

    return {
      weightedScores: adjustedWeights,
      boostFactors,
      negativeSignals,
      diversityFactors,
    };
  }

  /**
   * 프로필 메타데이터 계산
   */
  private calculateProfileMetadata(user: UserDocument, behaviors: UserBehaviorDocument[]) {
    const totalInteractions = behaviors.length;
    
    // 프로필 강도 (0-100)
    let profileStrength = 0;
    profileStrength += Math.min(totalInteractions / 10, 30); // 상호작용 기반 (최대 30점)
    profileStrength += user.settings?.preferences?.length ? 20 : 0; // 명시적 선호도 (20점)
    profileStrength += user.demographics?.age ? 10 : 0; // 인구통계학적 정보 (10점)
    profileStrength += user.dietaryInfo?.dietType ? 15 : 0; // 식단 정보 (15점)
    profileStrength += user.cookingProfile?.availableTime ? 10 : 0; // 요리 프로필 (10점)
    profileStrength += Math.min(user.loginCount / 5, 15); // 로그인 빈도 (최대 15점)

    // 신뢰도 점수 계산
    const recentBehaviors = behaviors.filter(
      b => new Date((b as any).createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    );
    const confidenceScore = Math.min(recentBehaviors.length / 20, 1.0) * 100;

    return {
      profileStrength: Math.round(profileStrength),
      lastUpdated: new Date(),
      totalInteractions,
      confidenceScore: Math.round(confidenceScore),
    };
  }

  /**
   * 개인화 인사이트 생성
   */
  async generatePersonalizationInsights(userId: string): Promise<PersonalizationInsights> {
    try {
      const behaviors = await this.behaviorModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      const topCuisines = await this.analyzeTopCuisines(behaviors);
      const flavorProfile = await this.analyzeFlavorProfile(behaviors);
      const cookingPatterns = await this.analyzeCookingPatterns(behaviors);
      const healthTrends = await this.analyzeHealthTrends(behaviors);
      const socialPatterns = await this.analyzeSocialPatterns(behaviors);

      return {
        topCuisines,
        flavorProfile,
        cookingPatterns,
        healthTrends,
        socialPatterns,
      };
    } catch (error) {
      this.logger.error(`Failed to generate insights for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 행동 데이터 기록
   */
  async recordUserBehavior(behaviorData: {
    userId: string;
    actionType: string;
    targetId: string;
    targetType: string;
    rating?: number;
    context?: any;
    metadata?: any;
  }): Promise<void> {
    try {
      const behavior = new this.behaviorModel({
        ...behaviorData,
        createdAt: new Date(),
      });

      await behavior.save();

      // 실시간 프로필 업데이트 (백그라운드)
      this.updatePersonalizationProfileAsync(behaviorData.userId);
    } catch (error) {
      this.logger.error('Failed to record user behavior:', error);
    }
  }

  /**
   * 개인화된 레시피 추천 점수 계산
   */
  async calculatePersonalizedScore(
    userId: string,
    recipeId: string,
    baseScore: number
  ): Promise<number> {
    try {
      const profile = await this.getPersonalizationProfile(userId);
      if (!profile) {
        return baseScore;
      }

      let personalizedScore = baseScore;

      // 개인화 가중치 적용
      personalizedScore *= profile.recommendations.weightedScores.personalization || 1.0;

      // 부스트 팩터 적용
      // TODO: 레시피 메타데이터에 따른 부스트 적용

      // 부정적 신호 차감
      // TODO: 알레르기나 싫어하는 재료 포함 시 점수 차감

      return Math.max(0, Math.min(1, personalizedScore));
    } catch (error) {
      this.logger.error(`Failed to calculate personalized score for ${userId}:`, error);
      return baseScore;
    }
  }

  // Private 헬퍼 메서드들
  private async extractImplicitPreferences(behaviors: UserBehaviorDocument[]) {
    // 행동 데이터에서 암시적 선호도 추출 로직
    return {
      cuisineTypes: [],
      flavorProfiles: [],
      cookingMethods: [],
      timePreferences: [],
      difficultyPreference: 'medium',
      ingredientAffinities: [],
    };
  }

  private async calculateRecentTrends(behaviors: UserBehaviorDocument[]) {
    // 최근 30일 행동 트렌드 분석
    return {
      cuisineTypes: [],
    };
  }

  private combinePreferences(explicit: string[], implicit: string[], recent: string[]): string[] {
    // 명시적, 암시적, 최근 선호도를 가중치를 두고 결합
    const combined = new Set([
      ...explicit.map(p => ({ item: p, weight: 1.0 })),
      ...implicit.map(p => ({ item: p, weight: 0.7 })),
      ...recent.map(p => ({ item: p, weight: 1.2 })),
    ]);

    return Array.from(combined).map(p => p.item);
  }

  private calculateCookingFrequency(cookingBehaviors: UserBehaviorDocument[]): number {
    // 월간 요리 빈도 계산
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCooking = cookingBehaviors.filter(
      b => new Date((b as any).createdAt) > thirtyDaysAgo
    );
    return recentCooking.length;
  }

  private analyzeTimePreferences(behaviors: UserBehaviorDocument[]): string[] {
    // 시간대별 활동 패턴 분석
    const timeCount: Record<string, number> = {};
    behaviors.forEach(b => {
      const timeOfDay = b.context?.timeOfDay;
      if (timeOfDay) {
        timeCount[timeOfDay] = (timeCount[timeOfDay] || 0) + 1;
      }
    });

    return Object.entries(timeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([time]) => time);
  }

  private analyzeSeasonalPatterns(behaviors: UserBehaviorDocument[]): Record<string, number> {
    // 계절별 활동 패턴 분석
    const seasonCount: Record<string, number> = {};
    behaviors.forEach(b => {
      const season = b.context?.season;
      if (season) {
        seasonCount[season] = (seasonCount[season] || 0) + 1;
      }
    });
    return seasonCount;
  }

  private analyzeContextualPreferences(behaviors: UserBehaviorDocument[]): Record<string, any> {
    // 맥락별 선호도 분석 (요일, 날씨, 기분 등)
    return {};
  }

  private extractDislikedItems(behaviors: any): string[] {
    // 낮은 평점이나 스킵된 항목들 추출
    return [];
  }

  private getDefaultBehaviorPatterns() {
    return {
      cookingFrequency: 0,
      averageRating: 3.0,
      preferredMealTimes: ['evening'],
      seasonalPatterns: {},
      contextualPreferences: {},
    };
  }

  private async analyzeTopCuisines(behaviors: UserBehaviorDocument[]) {
    // 최고 선호 요리 스타일 분석
    return [];
  }

  private async analyzeFlavorProfile(behaviors: UserBehaviorDocument[]) {
    // 맛 프로필 분석
    return [];
  }

  private async analyzeCookingPatterns(behaviors: UserBehaviorDocument[]) {
    // 요리 패턴 분석
    return {
      bestTimes: [],
      preferredDifficulty: 'medium',
      avgCookingTime: 30,
      frequentIngredients: [],
    };
  }

  private async analyzeHealthTrends(behaviors: UserBehaviorDocument[]) {
    // 건강 트렌드 분석
    return {
      healthScore: 70,
      nutritionFocus: [],
      dietaryConsistency: 80,
    };
  }

  private async analyzeSocialPatterns(behaviors: UserBehaviorDocument[]) {
    // 소셜 패턴 분석
    return {
      sharingBehavior: 0,
      reviewFrequency: 0,
      communityEngagement: 0,
    };
  }

  private async cachePersonalizationProfile(userId: string, profile: PersonalizationProfile): Promise<void> {
    // Redis 캐싱 로직 (구현 필요)
    this.logger.debug(`Cached personalization profile for user: ${userId}`);
  }

  private async getPersonalizationProfile(userId: string): Promise<PersonalizationProfile | null> {
    try {
      // 캐시에서 프로필 조회, 없으면 새로 생성
      // Redis 조회 로직 구현 필요
      return await this.generatePersonalizationProfile(userId);
    } catch (error) {
      this.logger.error(`Failed to get personalization profile for ${userId}:`, error);
      return null;
    }
  }

  private async updatePersonalizationProfileAsync(userId: string): Promise<void> {
    // 백그라운드에서 프로필 업데이트
    setTimeout(async () => {
      try {
        await this.generatePersonalizationProfile(userId);
        this.logger.debug(`Updated personalization profile for user: ${userId}`);
      } catch (error) {
        this.logger.error(`Failed to update personalization profile for ${userId}:`, error);
      }
    }, 100);
  }
}