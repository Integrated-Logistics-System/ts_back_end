// 사용자 행동 데이터 수집을 위한 별도 스키마
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserBehaviorDocument = UserBehavior & Document;

@Schema({
  timestamps: true,
  collection: 'user_behaviors'
})
export class UserBehavior {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ 
    required: true,
    enum: ['view', 'like', 'save', 'cook', 'rate', 'share', 'search', 'skip']
  })
  actionType!: string;

  @Prop({ required: true })
  targetId!: string; // recipeId, searchQuery 등

  @Prop({ required: true })
  targetType!: string; // 'recipe', 'search', 'category' 등

  @Prop({ min: 1, max: 5 })
  rating?: number;

  @Prop()
  cookingTime?: number; // 실제 조리 시간

  @Prop({
    enum: ['easy', 'medium', 'hard']
  })
  perceivedDifficulty?: string;

  @Prop({ min: 1, max: 5 })
  satisfaction?: number;

  @Prop({
    type: Object,
    default: {}
  })
  context!: {
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek?: string;
    season?: 'spring' | 'summer' | 'fall' | 'winter';
    weather?: string;
    mood?: string;
    occasion?: 'everyday' | 'special' | 'quick' | 'healthy';
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    sessionDuration?: number;
  };

  @Prop({ type: [String], default: [] })
  tags?: string[]; // 자유형태 태그

  @Prop({
    type: Object,
    default: {}
  })
  metadata!: {
    sessionId?: string;
    referrer?: string;
    userAgent?: string;
    location?: string;
    duration?: number; // 해당 액션에 소요된 시간
    clickPosition?: number; // 추천 목록에서의 위치
  };
}

export const UserBehaviorSchema = SchemaFactory.createForClass(UserBehavior);

// 인덱스 설정
UserBehaviorSchema.index({ userId: 1, createdAt: -1 }); // 사용자별 최신 행동 조회
UserBehaviorSchema.index({ userId: 1, actionType: 1 }); // 사용자별 액션 타입별 조회
UserBehaviorSchema.index({ targetId: 1, actionType: 1 }); // 특정 레시피의 인기도 분석
UserBehaviorSchema.index({ createdAt: 1 }); // 시간대별 분석
UserBehaviorSchema.index({ 'context.timeOfDay': 1, 'context.dayOfWeek': 1 }); // 시간 패턴 분석