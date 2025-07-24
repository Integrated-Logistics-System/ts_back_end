// src/modules/user/user.schema.ts (최소화 버전)
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true, // createdAt, updatedAt 자동 생성
  collection: 'users'
})
export class User {
  @Prop({ required: true, unique: true, index: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ required: true })
  name!: string;

  // 🎯 개인화를 위한 확장된 사용자 프로필
  @Prop({
    type: Object,
    default: {}
  })
  settings!: {
    allergies?: string[];
    preferences?: string[];
    cookingLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    language?: string;
  };

  // 📊 개인화 데이터 수집
  @Prop({
    type: Object,
    default: {}
  })
  demographics!: {
    age?: number;
    gender?: 'male' | 'female' | 'other';
    location?: string;
    householdSize?: number;
    budget?: 'low' | 'medium' | 'high' | 'premium';
  };

  @Prop({
    type: Object,
    default: {}
  })
  dietaryInfo!: {
    dietType?: 'vegetarian' | 'vegan' | 'keto' | 'paleo' | 'mediterranean' | 'none';
    intolerances?: string[];
    religiousRestrictions?: string[];
    healthGoals?: string[];
  };

  @Prop({
    type: Object,
    default: {}
  })
  cookingProfile!: {
    availableTime?: number; // 평균 조리 가능 시간(분)
    kitchenEquipment?: string[];
    frequentIngredients?: string[];
    avoidedIngredients?: string[];
    preferredMealTimes?: string[];
    cookingFrequency?: 'daily' | 'weekly' | 'monthly' | 'rarely';
  };

  // 📈 사용 통계 및 행동 데이터
  @Prop({ default: 0 })
  loginCount!: number;

  @Prop()
  lastLoginAt!: Date;

  @Prop({ default: 0 })
  recipeViewCount!: number;

  @Prop({ default: 0 })
  recipeCookCount!: number;

  @Prop({ type: [String], default: [] })
  recentSearches!: string[];

  @Prop({
    type: Object,
    default: {}
  })
  behaviorMetrics!: {
    avgSessionDuration?: number;
    preferredTimeOfDay?: string[];
    mostActiveDays?: string[];
    searchPatterns?: string[];
    interactionScore?: number;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);

// 복합 인덱스 최소화
UserSchema.index({ email: 1 }); // 로그인용
UserSchema.index({ createdAt: 1 }); // 정렬용만