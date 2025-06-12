import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  sessionId: string;

  @Prop([{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    extractedIngredients: { type: [String], default: [] },
    recommendedRecipes: { type: [String], default: [] },
    allergyWarnings: { type: [String], default: [] }
  }])
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    extractedIngredients?: string[];
    recommendedRecipes?: string[];
    allergyWarnings?: string[];
  }>;

  @Prop({ default: true })
  isActive: boolean;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);