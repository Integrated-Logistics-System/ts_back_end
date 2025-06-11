import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RecipeDocument = Recipe & Document;

@Schema({ timestamps: true })
export class Recipe {
  @Prop({ required: true, unique: true })
  recipe_id: number;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop([String])
  ingredients: string[];

  @Prop([String])
  steps: string[];

  @Prop()
  minutes: number;

  @Prop()
  n_steps: number;

  @Prop()
  n_ingredients: number;

  @Prop([String])
  tags: string[];

  @Prop()
  nutrition: string;

  @Prop()
  contributor_id: number;

  @Prop()
  submitted: string;

  // 기존 호환성 유지를 위한 필드들
  @Prop()
  cookingTime: number; // minutes와 동일

  @Prop([String])
  instructions: string[]; // steps와 동일

  @Prop()
  cuisine: string;

  @Prop({
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  })
  difficulty: string;

  @Prop({ default: 1 })
  servings: number;

  @Prop()
  contributorId: string; // contributor_id와 동일

  @Prop()
  submittedDate: Date;

  @Prop({ default: 0 })
  averageRating: number;

  @Prop({ default: 0 })
  reviewCount: number;

  @Prop([String])
  allergens: string[];

  @Prop()
  imageUrl: string;

  @Prop({
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'none'],
    default: 'none',
  })
  dietaryType: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const RecipeSchema = SchemaFactory.createForClass(Recipe);

// Indexes for better search performance
RecipeSchema.index({ recipe_id: 1 });
RecipeSchema.index({ name: 'text', description: 'text' });
RecipeSchema.index({ tags: 1 });
RecipeSchema.index({ ingredients: 1 });
RecipeSchema.index({ minutes: 1 });
RecipeSchema.index({ cookingTime: 1 });
RecipeSchema.index({ difficulty: 1 });
RecipeSchema.index({ averageRating: -1 });
