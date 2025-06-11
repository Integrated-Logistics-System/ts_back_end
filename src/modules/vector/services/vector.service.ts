import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ElasticsearchService } from './elasticsearch.service';
import { EmbeddingService } from './embedding.service';
import {
  VectorMetadata,
  VectorMetadataDocument,
} from '../schemas/vector-metadata.schema';
import { CreateVectorDto } from '../dto/create-vector.dto';
import { UpdateVectorDto } from '../dto/update-vector.dto';
import { VectorSearchDto } from '../dto/vector-search.dto';

@Injectable()
export class VectorService {
  private readonly logger = new Logger(VectorService.name);

  constructor(
    @InjectModel(VectorMetadata.name)
    private readonly vectorMetadataModel: Model<VectorMetadataDocument>,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async createVector(createVectorDto: CreateVectorDto): Promise<string> {
    try {
      const vectorId = `${createVectorDto.sourceType}_${createVectorDto.sourceId}_${uuidv4()}`;

      // Preprocess content for embedding
      const processedContent = this.embeddingService.preprocessText(
        createVectorDto.content,
      );

      // Create embedding
      const embedding =
        await this.embeddingService.createEmbedding(processedContent);

      // Store in Elasticsearch
      await this.elasticsearchService.upsertVectors([
        {
          id: vectorId,
          vector: embedding,
          metadata: {
            sourceType: createVectorDto.sourceType,
            sourceId: createVectorDto.sourceId,
            content: processedContent,
            ...createVectorDto.metadata,
          },
        },
      ]);

      // Store metadata in MongoDB
      const vectorMetadata = new this.vectorMetadataModel({
        vectorId,
        sourceType: createVectorDto.sourceType,
        sourceId: createVectorDto.sourceId,
        content: processedContent,
        metadata: createVectorDto.metadata || {},
        namespace: createVectorDto.namespace,
        dimensions: this.embeddingService.getEmbeddingDimensions(),
        embeddingModel: this.embeddingService.getEmbeddingModel(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await vectorMetadata.save();

      this.logger.log(`Created vector ${vectorId}`);
      return vectorId;
    } catch (error) {
      this.logger.error('Failed to create vector', error);
      throw error;
    }
  }

  async updateVector(
    vectorId: string,
    updateVectorDto: UpdateVectorDto,
  ): Promise<void> {
    try {
      // Find existing vector metadata
      const existingMetadata = await this.vectorMetadataModel.findOne({
        vectorId,
      });
      if (!existingMetadata) {
        throw new NotFoundException(`Vector ${vectorId} not found`);
      }

      let embedding: number[] | undefined;
      let processedContent: string | undefined;

      // If content is updated, create new embedding
      if (updateVectorDto.content) {
        processedContent = this.embeddingService.preprocessText(
          updateVectorDto.content,
        );
        embedding =
          await this.embeddingService.createEmbedding(processedContent);
      }

      // Prepare updated metadata
      const updatedMetadata = {
        ...existingMetadata.metadata,
        ...updateVectorDto.metadata,
      };

      if (processedContent) {
        updatedMetadata.content = processedContent;
      }

      // Update in Elasticsearch
      const vectorData: any = {
        metadata: updatedMetadata,
      };

      if (embedding) {
        vectorData.vector = embedding;
      }

      await this.elasticsearchService.upsertVectors([
        {
          id: vectorId,
          vector: embedding || [], // We need to fetch existing vector if not updating
          metadata: updatedMetadata,
        },
      ]);

      // Update metadata in MongoDB
      const updateData: any = {
        metadata: updatedMetadata,
        updatedAt: new Date(),
      };

      if (processedContent) {
        updateData.content = processedContent;
      }

      await this.vectorMetadataModel.updateOne({ vectorId }, updateData);

      this.logger.log(`Updated vector ${vectorId}`);
    } catch (error) {
      this.logger.error(`Failed to update vector ${vectorId}`, error);
      throw error;
    }
  }

  async searchVectors(searchDto: VectorSearchDto): Promise<any[]> {
    try {
      let queryVector: number[];

      if (searchDto.vector) {
        queryVector = searchDto.vector;
      } else if (searchDto.query) {
        // Create embedding for text query
        const processedQuery = this.embeddingService.preprocessText(
          searchDto.query,
        );
        queryVector =
          await this.embeddingService.createEmbedding(processedQuery);
      } else {
        throw new Error('Either vector or query must be provided');
      }

      // Search in Elasticsearch
      const results = await this.elasticsearchService.queryVectors(
        queryVector,
        {
          topK: searchDto.topK || 10,
          filter: searchDto.filter,
          includeMetadata: true,
        },
      );

      this.logger.log(`Found ${results.length} similar vectors`);
      return results;
    } catch (error) {
      this.logger.error('Failed to search vectors', error);
      throw error;
    }
  }

  async deleteVector(vectorId: string): Promise<void> {
    try {
      // Delete from Elasticsearch
      await this.elasticsearchService.deleteVectors([vectorId]);

      // Delete from MongoDB
      const result = await this.vectorMetadataModel.deleteOne({ vectorId });

      if (result.deletedCount === 0) {
        throw new NotFoundException(`Vector ${vectorId} not found`);
      }

      this.logger.log(`Deleted vector ${vectorId}`);
    } catch (error) {
      this.logger.error(`Failed to delete vector ${vectorId}`, error);
      throw error;
    }
  }

  async deleteVectorsBySource(
    sourceType: string,
    sourceId?: string,
  ): Promise<void> {
    try {
      if (sourceId) {
        // Delete vectors for specific source
        const vectorMetadatas = await this.vectorMetadataModel.find({
          sourceType,
          sourceId,
        });

        if (vectorMetadatas.length === 0) {
          this.logger.log(`No vectors found for ${sourceType}:${sourceId}`);
          return;
        }

        const vectorIds = vectorMetadatas.map((metadata) => metadata.vectorId);

        // Delete from Elasticsearch
        await this.elasticsearchService.deleteVectors(vectorIds);

        // Delete from MongoDB
        await this.vectorMetadataModel.deleteMany({ sourceType, sourceId });

        this.logger.log(
          `Deleted ${vectorMetadatas.length} vectors for ${sourceType}:${sourceId}`,
        );
      } else {
        // Delete all vectors for source type
        const vectorMetadatas = await this.vectorMetadataModel.find({
          sourceType,
        });

        if (vectorMetadatas.length === 0) {
          this.logger.log(`No vectors found for sourceType: ${sourceType}`);
          return;
        }

        const vectorIds = vectorMetadatas.map((metadata) => metadata.vectorId);

        // Delete from Elasticsearch
        await this.elasticsearchService.deleteVectors(vectorIds);

        // Delete from MongoDB
        await this.vectorMetadataModel.deleteMany({ sourceType });

        this.logger.log(
          `Deleted ${vectorMetadatas.length} vectors for sourceType: ${sourceType}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete vectors for ${sourceType}:${sourceId || 'all'}`,
        error,
      );
      throw error;
    }
  }

  async getVectorMetadata(vectorId: string): Promise<VectorMetadataDocument> {
    const metadata = await this.vectorMetadataModel.findOne({ vectorId });
    if (!metadata) {
      throw new NotFoundException(`Vector ${vectorId} not found`);
    }
    return metadata;
  }

  async getVectorsBySource(
    sourceType: string,
    sourceId: string,
  ): Promise<VectorMetadataDocument[]> {
    return this.vectorMetadataModel
      .find({ sourceType, sourceId })
      .sort({ createdAt: -1 });
  }

  async bulkCreateVectors(
    createVectorDtos: CreateVectorDto[],
  ): Promise<string[]> {
    try {
      if (createVectorDtos.length === 0) {
        return [];
      }

      const vectorIds: string[] = [];
      const elasticsearchVectors: any[] = [];
      const mongoDocuments: any[] = [];

      // Prepare all content for batch embedding
      const contents = createVectorDtos.map((dto) =>
        this.embeddingService.preprocessText(dto.content),
      );

      // Create embeddings in batch
      const embeddings = await this.embeddingService.createEmbeddings(contents);

      // Prepare vectors for Elasticsearch and MongoDB
      for (let i = 0; i < createVectorDtos.length; i++) {
        const dto = createVectorDtos[i];
        const vectorId = `${dto.sourceType}_${dto.sourceId}_${uuidv4()}`;
        const embedding = embeddings[i];
        const processedContent = contents[i];

        vectorIds.push(vectorId);

        // Elasticsearch vector
        elasticsearchVectors.push({
          id: vectorId,
          vector: embedding,
          metadata: {
            sourceType: dto.sourceType,
            sourceId: dto.sourceId,
            content: processedContent,
            ...dto.metadata,
          },
        });

        // MongoDB document
        mongoDocuments.push({
          vectorId,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          content: processedContent,
          metadata: dto.metadata || {},
          namespace: dto.namespace,
          dimensions: this.embeddingService.getEmbeddingDimensions(),
          embeddingModel: this.embeddingService.getEmbeddingModel(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Upsert to Elasticsearch
      await this.elasticsearchService.upsertVectors(elasticsearchVectors);

      // Insert to MongoDB
      await this.vectorMetadataModel.insertMany(mongoDocuments);

      this.logger.log(`Bulk created ${vectorIds.length} vectors`);
      return vectorIds;
    } catch (error) {
      this.logger.error('Failed to bulk create vectors', error);
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    return this.elasticsearchService.getIndexStats();
  }

  async getVectorCount(sourceType?: string): Promise<number> {
    const filter = sourceType ? { sourceType } : {};
    return this.vectorMetadataModel.countDocuments(filter);
  }

  async searchSimilar(
    query: string,
    threshold: number = 0.7,
    size: number = 10,
  ): Promise<any[]> {
    try {
      const processedQuery = this.embeddingService.preprocessText(query);
      const queryVector =
        await this.embeddingService.createEmbedding(processedQuery);

      return this.elasticsearchService.searchSimilar(
        queryVector,
        threshold,
        size,
      );
    } catch (error) {
      this.logger.error('Failed to search similar vectors', error);
      throw error;
    }
  }
}
