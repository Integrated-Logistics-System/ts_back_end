import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserRecipeDocument = UserRecipe & Document;

@Schema({ timestamps: true })
export class UserRecipe {
    @Prop({ required: true })
    userId!: string;

    @Prop({ required: true })
    recipeId!: string; // Elasticsearch의 레시피 ID

    @Prop({ type: Boolean, default: false })
    isBookmarked!: boolean;

    @Prop({ type: Number, min: 1, max: 5 })
    rating?: number;

    @Prop({ type: String })
    personalNote?: string;

    @Prop({ type: [String], default: [] })
    personalTags!: string[];

    @Prop({ type: Number, default: 0 })
    cookCount!: number; // 사용자가 이 레시피로 요리한 횟수

    @Prop({ default: Date.now })
    lastCookedAt?: Date;

    @Prop({ default: Date.now })
    createdAt!: Date;

    @Prop({ default: Date.now })
    updatedAt!: Date;
}

export const UserRecipeSchema = SchemaFactory.createForClass(UserRecipe);

// 인덱스 설정
UserRecipeSchema.index({ userId: 1, recipeId: 1 }, { unique: true });
UserRecipeSchema.index({ userId: 1, isBookmarked: 1 });
UserRecipeSchema.index({ userId: 1, rating: 1 });