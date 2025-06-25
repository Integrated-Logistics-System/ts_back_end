import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AllergenDocument = Allergen & Document;

@Schema({
  timestamps: true,
  collection: 'allergens'
})
export class Allergen {
  @Prop({ required: true, index: true })
  ingredient_name: string;

  @Prop({ default: 0 })
  글루텐함유곡물: number;

  @Prop({ default: 0 })
  갑각류: number;

  @Prop({ default: 0 })
  난류: number;

  @Prop({ default: 0 })
  어류: number;

  @Prop({ default: 0 })
  땅콩: number;

  @Prop({ default: 0 })
  대두: number;

  @Prop({ default: 0 })
  우유: number;

  @Prop({ default: 0 })
  견과류: number;

  @Prop({ default: 0 })
  셀러리: number;

  @Prop({ default: 0 })
  겨자: number;

  @Prop({ default: 0 })
  참깨: number;

  @Prop({ default: 0 })
  아황산류: number;

  @Prop({ default: 0 })
  루핀: number;

  @Prop({ default: 0 })
  연체동물: number;

  @Prop({ default: 0 })
  복숭아: number;

  @Prop({ default: 0 })
  토마토: number;

  @Prop({ default: 0 })
  돼지고기: number;

  @Prop({ default: 0 })
  쇠고기: number;

  @Prop({ default: 0 })
  닭고기: number;

  @Prop()
  note?: string;
}

export const AllergenSchema = SchemaFactory.createForClass(Allergen);

// 텍스트 인덱스 설정
AllergenSchema.index({ ingredient_name: 'text' });
