import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// 영양소 인터페이스 정의
export interface NutritionInfo {
  calories: number;
  fat: number;
  saturatedFat: number;
  cholesterol: number;
  sodium: number;
  carbohydrates: number;
  fiber: number;
  sugar?: number;
  protein?: number;
}

export type RecipeDocument = Recipe & Document;

@Schema({ timestamps: true })
export class Recipe {
  @Prop({ required: true, unique: true })
  id: number;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], required: true })
  ingredients: string[];

  @Prop({ type: [String], required: true })
  steps: string[];

  @Prop({ required: true })
  minutes: number;

  @Prop({ required: true })
  n_steps: number;

  @Prop({ required: true })
  n_ingredients: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  // 원본 nutrition 데이터 (문자열 또는 배열)
  @Prop({ type: String })
  nutrition: string;

  @Prop()
  description: string;

  @Prop()
  contributor_id: number;

  @Prop()
  submitted: Date;

  // RAG 관련 필드
  @Prop({ type: [Number], default: [] })
  embedding: number[];

  @Prop({ type: Number, default: 100 })
  allergyScore: number;

  @Prop({ type: [String], default: [] })
  safeForAllergies: string[];

  @Prop({ type: [String], default: [] })
  unsafeAllergens: string[];

  @Prop({ default: 'easy' })
  difficulty: string;

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  favoriteCount: number;
}

export const RecipeSchema = SchemaFactory.createForClass(Recipe);

// Virtual: 파싱된 영양 정보
RecipeSchema.virtual('nutritionInfo').get(function(this: RecipeDocument): NutritionInfo | null {
  if (!this.nutrition) return null;
  
  try {
    let nutritionArray: number[];
    
    // 문자열인 경우 파싱
    if (typeof this.nutrition === 'string') {
      const cleaned = this.nutrition
        .replace(/'/g, '"')
        .replace(/\n/g, ' ')
        .trim();
      nutritionArray = JSON.parse(cleaned);
    } else {
      nutritionArray = this.nutrition as any;
    }
    
    if (!Array.isArray(nutritionArray) || nutritionArray.length < 7) {
      return null;
    }
    
    return {
      calories: nutritionArray[0] || 0,
      fat: nutritionArray[1] || 0,
      saturatedFat: nutritionArray[2] || 0,
      cholesterol: nutritionArray[3] || 0,
      sodium: nutritionArray[4] || 0,
      carbohydrates: nutritionArray[5] || 0,
      fiber: nutritionArray[6] || 0,
      sugar: nutritionArray[7] || undefined,
      protein: nutritionArray[8] || undefined,
    };
  } catch (error) {
    return null;
  }
});

// Virtual: 칼로리 레벨 (저칼로리, 보통, 고칼로리)
RecipeSchema.virtual('calorieLevel').get(function(this: RecipeDocument): string {
  const nutrition = (this as any).nutritionInfo;
  if (!nutrition) return 'unknown';
  
  const calories = nutrition.calories;
  if (calories < 200) return 'low';
  if (calories < 500) return 'medium';
  return 'high';
});

// Virtual: 건강도 점수 (0-100)
RecipeSchema.virtual('healthScore').get(function(this: RecipeDocument): number {
  const nutrition = (this as any).nutritionInfo;
  if (!nutrition) return 50; // 기본값
  
  let score = 50;
  
  // 칼로리 점수 (적을수록 좋음)
  if (nutrition.calories < 300) score += 20;
  else if (nutrition.calories > 800) score -= 20;
  
  // 지방 점수 (적을수록 좋음)
  if (nutrition.fat < 20) score += 15;
  else if (nutrition.fat > 60) score -= 15;
  
  // 섬유질 점수 (많을수록 좋음)
  if (nutrition.fiber > 20) score += 15;
  else if (nutrition.fiber < 5) score -= 10;
  
  // 나트륨 점수 (적을수록 좋음)
  if (nutrition.sodium < 20) score += 10;
  else if (nutrition.sodium > 50) score -= 10;
  
  return Math.max(0, Math.min(100, score));
});

// Virtual: 다이어트 친화적 여부
RecipeSchema.virtual('isDietFriendly').get(function(this: RecipeDocument): boolean {
  const nutrition = (this as any).nutritionInfo;
  if (!nutrition) return false;
  
  return nutrition.calories < 400 && 
         nutrition.fat < 30 && 
         nutrition.sodium < 30;
});

// Transform: JSON 출력시 virtual 필드 포함
RecipeSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

RecipeSchema.set('toObject', { virtuals: true });