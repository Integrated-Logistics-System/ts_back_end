import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IngredientDocument = Ingredient & Document;

@Schema({ timestamps: true })
export class Ingredient {
  @Prop({ required: true, unique: true })
  ingredient_name: string;

  @Prop({ type: Number, default: 0 })
  글루텐함유곡물: number;

  @Prop({ type: Number, default: 0 })
  갑각류: number;

  @Prop({ type: Number, default: 0 })
  난류: number;

  @Prop({ type: Number, default: 0 })
  어류: number;

  @Prop({ type: Number, default: 0 })
  땅콩: number;

  @Prop({ type: Number, default: 0 })
  대두: number;

  @Prop({ type: Number, default: 0 })
  우유: number;

  @Prop({ type: Number, default: 0 })
  견과류: number;

  @Prop({ type: Number, default: 0 })
  셀러리: number;

  @Prop({ type: Number, default: 0 })
  겨자: number;

  @Prop({ type: Number, default: 0 })
  참깨: number;

  @Prop({ type: Number, default: 0 })
  아황산류: number;

  @Prop({ type: Number, default: 0 })
  루핀: number;

  @Prop({ type: Number, default: 0 })
  연체동물: number;

  @Prop({ type: Number, default: 0 })
  복숭아: number;

  @Prop({ type: Number, default: 0 })
  토마토: number;

  @Prop({ type: Number, default: 0 })
  돼지고기: number;

  @Prop({ type: Number, default: 0 })
  쇠고기: number;

  @Prop({ type: Number, default: 0 })
  닭고기: number;

  @Prop()
  note: string;

  @Prop({ type: [String], default: [] })
  aliases: string[]; // 대체 이름들

  @Prop({ default: 'food' })
  category: string;
}

export const IngredientSchema = SchemaFactory.createForClass(Ingredient);