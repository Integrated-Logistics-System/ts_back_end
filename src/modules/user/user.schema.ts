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

  // 🎯 사용자 설정은 JSON으로 압축 저장
  // TODO: settings 필드에 대한 더 엄격한 스키마 정의 (예: Nested Schema) 고려
  @Prop({
    type: Object,
    default: {}
  })
  settings!: {
    allergies?: string[];
    preferences?: string[];
    cookingLevel?: string;
    language?: string;
  };

  // 📊 간단한 통계만
  @Prop({ default: 0 })
  loginCount!: number;

  @Prop()
  lastLoginAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// 복합 인덱스 최소화
UserSchema.index({ email: 1 }); // 로그인용
UserSchema.index({ createdAt: 1 }); // 정렬용만