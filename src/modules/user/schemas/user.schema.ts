import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], default: [] })
  allergies: string[];

  @Prop({
    type: {
      cuisine: { type: [String], default: [] },
      difficulty: { type: String, default: 'easy' },
      cookingTime: { type: Number, default: 30 },
      dietaryRestrictions: { type: [String], default: [] }
    },
    default: {}
  })
  preferences: {
    cuisine: string[];
    difficulty: string;
    cookingTime: number;
    dietaryRestrictions: string[];
  };

  @Prop({ type: [String], default: [] })
  favoriteRecipes: string[];

  @Prop({ type: [String], default: [] })
  recentIngredients: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);