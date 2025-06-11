import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { VectorController } from './vector.controller';
import { VectorService } from './services/vector.service';
import { ElasticsearchService } from './services/elasticsearch.service';
import { EmbeddingService } from './services/embedding.service';
import {
  VectorMetadata,
  VectorMetadataSchema,
} from './schemas/vector-metadata.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: VectorMetadata.name, schema: VectorMetadataSchema },
    ]),
  ],
  controllers: [VectorController],
  providers: [VectorService, ElasticsearchService, EmbeddingService],
  exports: [VectorService, ElasticsearchService, EmbeddingService],
})
export class VectorModule {}
