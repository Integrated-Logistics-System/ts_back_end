import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserStatusDocument = UserStatus & Document;

@Schema({ 
  timestamps: true,
  collection: 'user_statuses'
})
export class UserStatus {
  @Prop({ required: true, ref: 'User' })
  userId!: string;

  @Prop({ 
    required: true,
    maxlength: 50,
    trim: true,
    validate: {
      validator: function(v: string): boolean {
        return Boolean(v && v.length > 0 && v.length <= 50);
      },
      message: '나의 상태는 1-50자 사이여야 합니다.'
    }
  })
  status!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: Date.now })
  lastUpdated!: Date;

  // 자동 파싱된 키워드들 (선택적)
  @Prop({ type: [String], default: [] })
  extractedKeywords?: string[];

  // 사용 통계 (선택적)
  @Prop({ default: 0 })
  usageCount?: number;
}

export const UserStatusSchema = SchemaFactory.createForClass(UserStatus);

// 인덱스 설정
UserStatusSchema.index({ userId: 1 }, { unique: true });
UserStatusSchema.index({ isActive: 1 });
UserStatusSchema.index({ lastUpdated: -1 });