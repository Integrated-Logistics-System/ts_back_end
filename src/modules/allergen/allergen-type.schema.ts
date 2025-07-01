import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AllergenTypeDocument = AllergenType & Document;

@Schema({ timestamps: true })
export class AllergenType {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  order: number;
}

export const AllergenTypeSchema = SchemaFactory.createForClass(AllergenType);
