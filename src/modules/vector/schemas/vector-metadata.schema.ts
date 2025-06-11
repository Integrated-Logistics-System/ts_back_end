import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VectorMetadataDocument = VectorMetadata & Document;

@Schema({
  timestamps: true,
  collection: 'vector_metadata',
})
export class VectorMetadata {
  @Prop({ required: true, unique: true })
  vectorId: string;

  @Prop({ required: true })
  sourceType: string; // 'recipe', 'ingredient', 'cooking_method', etc.

  @Prop({ required: true })
  sourceId: string; // Original document ID

  @Prop({ required: true })
  content: string; // Original text content

  @Prop({ type: Object })
  metadata: Record<string, any>; // Additional metadata

  @Prop()
  namespace?: string; // Vector namespace for organization

  @Prop({ default: 1536 })
  dimensions: number; // Vector dimensions

  @Prop({ default: 'text-embedding-3-large' })
  embeddingModel: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const VectorMetadataSchema =
  SchemaFactory.createForClass(VectorMetadata);

// Add indexes for better performance
VectorMetadataSchema.index({ vectorId: 1 });
VectorMetadataSchema.index({ sourceType: 1, sourceId: 1 });
VectorMetadataSchema.index({ namespace: 1 });
VectorMetadataSchema.index({ createdAt: -1 });
