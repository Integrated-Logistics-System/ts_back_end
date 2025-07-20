import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RecipeMetadataDocument = RecipeMetadata & Document;

@Schema({
    timestamps: true,
    collection: 'recipe_metadata' // 컬렉션 이름 명시
})
export class RecipeMetadata {
    @Prop({ required: true, unique: true, index: true })
    recipeId!: string; // Elasticsearch의 레시피 ID

    // 🎯 모든 통계를 하나의 객체로 압축
    @Prop({
        type: Object,
        default: {
            v: 0,  // viewCount
            l: 0,  // likeCount (좋아요 및 북마크 통합)
            r: 0,  // ratingSum (총 평점 합계)
            c: 0   // ratingCount (평점 개수)
        }
    })
    stats!: {
        v: number;  // viewCount
        l: number;  // likeCount (좋아요 및 북마크 통합)
        r: number;  // ratingSum (총 평점 합계)
        c: number;  // ratingCount
    };

    @Prop({ type: Boolean, default: true })
    isActive!: boolean;

    @Prop({ default: Date.now })
    createdAt!: Date;

    @Prop({ default: Date.now })
    updatedAt!: Date;
}

export const RecipeMetadataSchema = SchemaFactory.createForClass(RecipeMetadata);

// 인덱스 설정
RecipeMetadataSchema.index({ recipeId: 1 }, { unique: true });
RecipeMetadataSchema.index({ 'stats.v': -1 }); // 조회수 기준 정렬
RecipeMetadataSchema.index({ 'stats.l': -1 }); // 좋아요/북마크 수 기준 정렬
RecipeMetadataSchema.index({ 'stats.r': -1, 'stats.c': -1 }); // 평점 기준 정렬 (평점 합계, 개수)
