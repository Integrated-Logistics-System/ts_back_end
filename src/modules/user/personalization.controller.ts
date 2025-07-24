// 개인화 API 컨트롤러
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { GetUser } from '../auth/get-user.decorator';
import { UserPersonalizationService, PersonalizationProfile, PersonalizationInsights } from './user-personalization.service';

@ApiTags('Personalization')
@Controller('api/personalization')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class PersonalizationController {
  private readonly logger = new Logger(PersonalizationController.name);

  constructor(
    private readonly personalizationService: UserPersonalizationService,
  ) {}

  /**
   * 사용자 개인화 프로필 조회
   */
  @Get('profile')
  @ApiOperation({ summary: '개인화 프로필 조회' })
  @ApiResponse({ status: 200, description: '개인화 프로필 반환' })
  async getPersonalizationProfile(
    // @GetUser() user: any
  ): Promise<{ success: boolean; data: PersonalizationProfile }> {
    try {
      this.logger.debug(`Getting personalization profile for user: ${'test-user'}`);
      
      const profile = await this.personalizationService.generatePersonalizationProfile('test-user');
      
      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      this.logger.error('Failed to get personalization profile:', error);
      throw new HttpException(
        'Failed to get personalization profile',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 개인화 인사이트 조회
   */
  @Get('insights')
  @ApiOperation({ summary: '개인화 인사이트 조회' })
  @ApiResponse({ status: 200, description: '개인화 인사이트 반환' })
  async getPersonalizationInsights(
    // @GetUser() user: any
  ): Promise<{ success: boolean; data: PersonalizationInsights }> {
    try {
      this.logger.debug(`Getting personalization insights for user: ${'test-user'}`);
      
      const insights = await this.personalizationService.generatePersonalizationInsights('test-user');
      
      return {
        success: true,
        data: insights,
      };
    } catch (error) {
      this.logger.error('Failed to get personalization insights:', error);
      throw new HttpException(
        'Failed to get personalization insights',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 사용자 행동 기록
   */
  @Post('behavior')
  @ApiOperation({ summary: '사용자 행동 기록' })
  @ApiResponse({ status: 201, description: '행동 기록 성공' })
  async recordBehavior(
    // @GetUser() user: any,
    @Body() behaviorData: {
      actionType: 'view' | 'like' | 'save' | 'cook' | 'rate' | 'share' | 'search' | 'skip';
      targetId: string;
      targetType: 'recipe' | 'search' | 'category';
      rating?: number;
      cookingTime?: number;
      perceivedDifficulty?: 'easy' | 'medium' | 'hard';
      satisfaction?: number;
      context?: {
        timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
        dayOfWeek?: string;
        season?: 'spring' | 'summer' | 'fall' | 'winter';
        weather?: string;
        mood?: string;
        occasion?: 'everyday' | 'special' | 'quick' | 'healthy';
        deviceType?: 'mobile' | 'desktop' | 'tablet';
        sessionDuration?: number;
      };
      tags?: string[];
      metadata?: {
        sessionId?: string;
        referrer?: string;
        userAgent?: string;
        location?: string;
        duration?: number;
        clickPosition?: number;
      };
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.debug(`Recording behavior for user: ${'test-user'}, action: ${behaviorData.actionType}`);
      
      await this.personalizationService.recordUserBehavior({
        userId: 'test-user',
        ...behaviorData,
      });
      
      return {
        success: true,
        message: 'Behavior recorded successfully',
      };
    } catch (error) {
      this.logger.error('Failed to record behavior:', error);
      throw new HttpException(
        'Failed to record behavior',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 개인화된 레시피 추천
   */
  @Get('recommendations')
  @ApiOperation({ summary: '개인화된 레시피 추천' })
  @ApiResponse({ status: 200, description: '개인화된 추천 레시피 목록' })
  async getPersonalizedRecommendations(
    // @GetUser() user: any,
    @Query('limit') limit?: number,
    @Query('category') category?: string,
    @Query('context') context?: string
  ): Promise<{
    success: boolean;
    data: {
      recipes: any[];
      metadata: {
        personalizedScore: number;
        totalResults: number;
        recommendationStrategy: string;
        profileStrength: number;
      };
    };
  }> {
    try {
      this.logger.debug(`Getting personalized recommendations for user: ${'test-user'}`);
      
      const profile = await this.personalizationService.generatePersonalizationProfile('test-user');
      
      // TODO: Elasticsearch를 통한 개인화된 레시피 검색 구현
      // 현재는 모의 데이터 반환
      const mockRecommendations: any[] = [];
      
      return {
        success: true,
        data: {
          recipes: mockRecommendations,
          metadata: {
            personalizedScore: profile.metadata.confidenceScore,
            totalResults: mockRecommendations.length,
            recommendationStrategy: this.getRecommendationStrategy(profile),
            profileStrength: profile.metadata.profileStrength,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get personalized recommendations:', error);
      throw new HttpException(
        'Failed to get personalized recommendations',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 개인화 설정 업데이트
   */
  @Put('preferences')
  @ApiOperation({ summary: '개인화 설정 업데이트' })
  @ApiResponse({ status: 200, description: '설정 업데이트 성공' })
  async updatePersonalizationPreferences(
    // @GetUser() user: any,
    @Body() preferences: {
      cuisineTypes?: string[];
      dietaryRestrictions?: string[];
      cookingLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      availableTime?: number;
      healthGoals?: string[];
      kitchenEquipment?: string[];
      budgetRange?: 'low' | 'medium' | 'high' | 'premium';
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.debug(`Updating personalization preferences for user: ${'test-user'}`);
      
      // TODO: User 모델 업데이트 구현
      // await this.userService.updateUserPreferences('test-user', preferences);
      
      // 행동 기록
      await this.personalizationService.recordUserBehavior({
        userId: 'test-user',
        actionType: 'view',
        targetId: 'preferences',
        targetType: 'category',
        context: {
          timeOfDay: this.getCurrentTimeOfDay(),
          dayOfWeek: new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase(),
        },
        metadata: {
          sessionId: 'test-session',
        },
      });
      
      return {
        success: true,
        message: 'Preferences updated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to update preferences:', error);
      throw new HttpException(
        'Failed to update preferences',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 개인화 통계 조회
   */
  @Get('stats')
  @ApiOperation({ summary: '개인화 통계 조회' })
  @ApiResponse({ status: 200, description: '개인화 통계 반환' })
  async getPersonalizationStats(
    // @GetUser() user: any,
    @Query('period') period?: 'week' | 'month' | 'year'
  ): Promise<{
    success: boolean;
    data: {
      profileEvolution: Array<{ date: string; strength: number }>;
      behaviorSummary: {
        totalInteractions: number;
        mostActiveDay: string;
        favoriteTimeOfDay: string;
        topActions: Array<{ action: string; count: number }>;
      };
      accuracyMetrics: {
        recommendationAccuracy: number;
        predictionConfidence: number;
        userSatisfaction: number;
      };
    };
  }> {
    try {
      this.logger.debug(`Getting personalization stats for user: ${'test-user'}`);
      
      const profile = await this.personalizationService.generatePersonalizationProfile('test-user');
      
      // TODO: 실제 통계 계산 구현
      const mockStats = {
        profileEvolution: [],
        behaviorSummary: {
          totalInteractions: profile.metadata.totalInteractions,
          mostActiveDay: 'Sunday',
          favoriteTimeOfDay: 'evening',
          topActions: [
            { action: 'view', count: 50 },
            { action: 'save', count: 25 },
            { action: 'cook', count: 15 },
          ],
        },
        accuracyMetrics: {
          recommendationAccuracy: profile.metadata.confidenceScore,
          predictionConfidence: profile.metadata.profileStrength,
          userSatisfaction: 85,
        },
      };
      
      return {
        success: true,
        data: mockStats,
      };
    } catch (error) {
      this.logger.error('Failed to get personalization stats:', error);
      throw new HttpException(
        'Failed to get personalization stats',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 개인화 피드백 제출
   */
  @Post('feedback')
  @ApiOperation({ summary: '개인화 피드백 제출' })
  @ApiResponse({ status: 201, description: '피드백 제출 성공' })
  async submitPersonalizationFeedback(
    // @GetUser() user: any,
    @Body() feedback: {
      recommendationId: string;
      rating: number; // 1-5
      comment?: string;
      aspects: {
        relevance?: number;
        novelty?: number;
        diversity?: number;
        accuracy?: number;
      };
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.debug(`Submitting personalization feedback from user: ${'test-user'}`);
      
      // 피드백을 행동 데이터로 기록
      await this.personalizationService.recordUserBehavior({
        userId: 'test-user',
        actionType: 'rate',
        targetId: feedback.recommendationId,
        targetType: 'recipe',
        rating: feedback.rating,
        context: {
          timeOfDay: this.getCurrentTimeOfDay(),
        },
        metadata: {
          feedback: feedback.comment,
          aspects: feedback.aspects,
        },
      });
      
      return {
        success: true,
        message: 'Feedback submitted successfully',
      };
    } catch (error) {
      this.logger.error('Failed to submit feedback:', error);
      throw new HttpException(
        'Failed to submit feedback',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Private helper methods
  private getRecommendationStrategy(profile: PersonalizationProfile): string {
    if (profile.metadata.profileStrength > 80) {
      return 'deep_personalization';
    } else if (profile.metadata.profileStrength > 50) {
      return 'moderate_personalization';
    } else if (profile.metadata.profileStrength > 20) {
      return 'basic_personalization';
    } else {
      return 'popularity_based';
    }
  }

  private getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }
}