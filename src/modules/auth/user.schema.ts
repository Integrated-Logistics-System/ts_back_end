import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  name?: string;

  @Prop({ default: [] })
  allergies: string[];

  @Prop({ 
    enum: ['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'],
    default: '초급' 
  })
  cookingLevel: string;

  @Prop({ 
    type: [String],
    default: [] 
  })
  preferences: string[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
