import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: {
      dietaryRestrictions: [String],
      favoriteIngredients: [String],
      dislikedIngredients: [String],
      cuisineTypes: [String],
      cookingSkill: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
      },
    },
    default: {},
  })
  preferences: {
    dietaryRestrictions?: string[];
    favoriteIngredients?: string[];
    dislikedIngredients?: string[];
    cuisineTypes?: string[];
    cookingSkill?: string;
  };

  @Prop([{ type: String }])
  favoriteRecipes: string[];

  @Prop([String])
  recentSearches: string[];

  @Prop([
    {
      recipeId: String,
      cookedDate: Date,
      rating: Number,
      notes: String,
    },
  ])
  cookingHistory: Array<{
    recipeId: string;
    cookedDate: Date;
    rating: number;
    notes?: string;
  }>;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add indexes
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
