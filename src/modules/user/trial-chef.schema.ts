import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TrialChefDocument = TrialChef & Document;

@Schema({
  timestamps: true,
  collection: 'trial_chefs'
})
export class TrialChef {
  @Prop({ required: true, unique: true })
  username!: string; // chef_001, chef_002, etc.

  @Prop({ required: true })
  displayName!: string; // 체험용 셰프 001, 체험용 셰프 002, etc.

  @Prop({ default: false })
  isUsed!: boolean; // 현재 사용 중인지

  @Prop()
  currentSessionId?: string; // 현재 사용 중인 세션 ID

  @Prop()
  lastUsedAt?: Date; // 마지막 사용 시간

  @Prop({ default: 0 })
  usageCount!: number; // 총 사용 횟수

  @Prop({
    type: Object,
    default: {
      allergies: [],
      preferences: ['한식', '양식', '일식'],
      cookingLevel: 'beginner',
      language: 'ko'
    }
  })
  defaultSettings!: {
    allergies: string[];
    preferences: string[];
    cookingLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    language: string;
  };

  @Prop({ default: 3600000 }) // 1시간 기본 세션 제한
  sessionDurationMs!: number;

  @Prop()
  sessionExpiresAt?: Date; // 세션 만료 시간
}

export const TrialChefSchema = SchemaFactory.createForClass(TrialChef);

// 인덱스
TrialChefSchema.index({ username: 1 }, { unique: true });
TrialChefSchema.index({ isUsed: 1 }); // 사용 가능한 계정 조회용
TrialChefSchema.index({ sessionExpiresAt: 1 }); // 만료된 세션 정리용