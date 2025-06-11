import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AllergenDocument = Allergen & Document;

@Schema({ timestamps: true })
export class Allergen {
  @Prop({ required: true, index: true })
  ingredient_name: string;

  @Prop({
    type: {
      글루텐함유곡물: Number,
      갑각류: Number,
      난류: Number,
      어류: Number,
      땅콩: Number,
      대두: Number,
      우유: Number,
      견과류: Number,
      셀러리: Number,
      겨자: Number,
      참깨: Number,
      아황산류: Number,
      루핀: Number,
      연체동물: Number,
      복숭아: Number,
      토마토: Number,
      돼지고기: Number,
      쇠고기: Number,
      닭고기: Number,
    },
    default: {},
  })
  allergen_info: {
    글루텐함유곡물?: number;
    갑각류?: number;
    난류?: number;
    어류?: number;
    땅콩?: number;
    대두?: number;
    우유?: number;
    견과류?: number;
    셀러리?: number;
    겨자?: number;
    참깨?: number;
    아황산류?: number;
    루핀?: number;
    연체동물?: number;
    복숭아?: number;
    토마토?: number;
    돼지고기?: number;
    쇠고기?: number;
    닭고기?: number;
  };

  @Prop()
  note: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const AllergenSchema = SchemaFactory.createForClass(Allergen);

// Indexes for better search performance
AllergenSchema.index({ ingredient_name: 'text' });
AllergenSchema.index({ 'allergen_info.글루텐함유곡물': 1 });
AllergenSchema.index({ 'allergen_info.갑각류': 1 });
AllergenSchema.index({ 'allergen_info.난류': 1 });
AllergenSchema.index({ 'allergen_info.어류': 1 });
AllergenSchema.index({ 'allergen_info.땅콩': 1 });
AllergenSchema.index({ 'allergen_info.대두': 1 });
AllergenSchema.index({ 'allergen_info.우유': 1 });
AllergenSchema.index({ 'allergen_info.견과류': 1 });
