import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProcessedRecipeDocument = ProcessedRecipe & Document;

@Schema({ timestamps: true })
export class ProcessedRecipe {
  @Prop({ required: true, unique: true })
  id: number;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  name_keyword: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  ingredients_raw: string;

  @Prop({ type: [String], required: true })
  ingredients_array: string[];

  @Prop({ required: true })
  ingredients_text: string;

  @Prop({ type: [String], required: true })
  steps_array: string[];

  @Prop({ required: true })
  steps_text: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 0 })
  minutes: number;

  @Prop({ default: 0 })
  n_ingredients: number;

  @Prop({ default: 0 })
  n_steps: number;

  @Prop({ type: [Number], default: [] })
  nutrition: number[];

  @Prop()
  submitted: string;

  @Prop()
  contributor_id: number;

  // 알레르기 정보
  @Prop({ type: [String], default: [] })
  allergens: string[];

  @Prop({ default: 0 })
  allergen_score: number;

  @Prop({ type: [String], default: [] })
  safe_for_allergies: string[];

  @Prop({ default: 0 })
  match_rate: number;
}

export const ProcessedRecipeSchema = SchemaFactory.createForClass(ProcessedRecipe);

// 인덱스 생성
ProcessedRecipeSchema.index({ id: 1 }, { unique: true });
ProcessedRecipeSchema.index({ name_keyword: 1 });
ProcessedRecipeSchema.index({ allergens: 1 });
ProcessedRecipeSchema.index({ safe_for_allergies: 1 });
ProcessedRecipeSchema.index({ minutes: 1 });
ProcessedRecipeSchema.index({ n_ingredients: 1 });
ProcessedRecipeSchema.index({ allergen_score: 1 });
ProcessedRecipeSchema.index({ tags: 1 });
