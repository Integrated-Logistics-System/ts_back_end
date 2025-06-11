import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProcessedIngredientDocument = ProcessedIngredient & Document;

@Schema({ timestamps: true })
export class ProcessedIngredient {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  name_keyword: string;

  @Prop({ type: [String], default: [] })
  allergens: string[];

  @Prop({
    type: {
      글루텐함유곡물: { type: Boolean, default: false },
      갑각류: { type: Boolean, default: false },
      난류: { type: Boolean, default: false },
      어류: { type: Boolean, default: false },
      땅콩: { type: Boolean, default: false },
      대두: { type: Boolean, default: false },
      우유: { type: Boolean, default: false },
      견과류: { type: Boolean, default: false },
      셀러리: { type: Boolean, default: false },
      겨자: { type: Boolean, default: false },
      참깨: { type: Boolean, default: false },
      아황산류: { type: Boolean, default: false },
      루핀: { type: Boolean, default: false },
      연체동물: { type: Boolean, default: false },
      복숭아: { type: Boolean, default: false },
      토마토: { type: Boolean, default: false },
      돼지고기: { type: Boolean, default: false },
      쇠고기: { type: Boolean, default: false },
      닭고기: { type: Boolean, default: false },
    },
    default: {},
  })
  allergen_flags: Record<string, boolean>;

  @Prop({ default: '' })
  note: string;
}

export const ProcessedIngredientSchema = SchemaFactory.createForClass(ProcessedIngredient);

// 인덱스 생성
ProcessedIngredientSchema.index({ name_keyword: 1 }, { unique: true });
ProcessedIngredientSchema.index({ allergens: 1 });
ProcessedIngredientSchema.index({ name: 'text' });
