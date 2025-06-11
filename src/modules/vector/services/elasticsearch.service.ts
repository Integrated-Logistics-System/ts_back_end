import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

export interface ElasticsearchVector {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
}

export interface ElasticsearchQueryResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client: Client;
  private readonly vectorIndex: string;

  constructor(private readonly configService: ConfigService) {
    this.vectorIndex = 'recipe_vectors';
  }

  async onModuleInit() {
    await this.initializeElasticsearch();
  }

  private async initializeElasticsearch() {
    try {
      this.client = new Client({
        node: this.configService.get<string>(
          'ELASTICSEARCH_NODE',
          'http://localhost:9200',
        ),
        auth: {
          username: this.configService.get<string>(
            'ELASTICSEARCH_USERNAME',
            '',
          ),
          password: this.configService.get<string>(
            'ELASTICSEARCH_PASSWORD',
            '',
          ),
        },
      });

      // Test connection
      await this.client.ping();

      // Create index if it doesn't exist
      await this.createIndexIfNotExists();

      this.logger.log('Elasticsearch client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch client', error);
      throw error;
    }
  }

  private async createIndexIfNotExists() {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.vectorIndex,
      });

      if (!indexExists) {
        await this.client.indices.create({
          index: this.vectorIndex,
          body: {
            mappings: {
              properties: {
                vector: {
                  type: 'dense_vector',
                  dims: 3072, // OpenAI text-embedding-3-large dimension
                },
                metadata: {
                  type: 'object',
                  dynamic: true,
                },
                timestamp: {
                  type: 'date',
                },
              },
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
            },
          },
        });
        this.logger.log(`Created Elasticsearch index: ${this.vectorIndex}`);
      }
    } catch (error) {
      this.logger.error('Failed to create Elasticsearch index', error);
      throw error;
    }
  }

  async upsertVectors(vectors: ElasticsearchVector[]): Promise<void> {
    try {
      const body = vectors.flatMap((vector) => [
        { index: { _index: this.vectorIndex, _id: vector.id } },
        {
          vector: vector.vector,
          metadata: vector.metadata,
          timestamp: new Date(),
        },
      ]);

      await this.client.bulk({ body });
      this.logger.log(`Upserted ${vectors.length} vectors to Elasticsearch`);
    } catch (error) {
      this.logger.error('Failed to upsert vectors to Elasticsearch', error);
      throw error;
    }
  }

  async queryVectors(
    vector: number[],
    options: {
      topK?: number;
      filter?: Record<string, any>;
      includeMetadata?: boolean;
    } = {},
  ): Promise<ElasticsearchQueryResult[]> {
    try {
      const { topK = 10, filter = {}, includeMetadata = true } = options;

      // Build query
      const query: any = {
        script_score: {
          query: { match_all: {} },
          script: {
            source: "cosineSimilarity(params.query_vector, 'vector') + 1.0",
            params: { query_vector: vector },
          },
        },
      };

      // Apply filters if provided
      if (Object.keys(filter).length > 0) {
        query.script_score.query = {
          bool: {
            must: [{ match_all: {} }],
            filter: Object.entries(filter).map(([key, value]) => ({
              term: { [`metadata.${key}`]: value },
            })),
          },
        };
      }

      const response = await this.client.search({
        index: this.vectorIndex,
        body: {
          query,
          size: topK,
          _source: includeMetadata ? ['metadata'] : false,
        },
      });

      return response.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        metadata: includeMetadata ? hit._source?.metadata : undefined,
      }));
    } catch (error) {
      this.logger.error('Failed to query vectors from Elasticsearch', error);
      throw error;
    }
  }

  async deleteVectors(ids: string[]): Promise<void> {
    try {
      const body = ids.flatMap((id) => [
        { delete: { _index: this.vectorIndex, _id: id } },
      ]);

      await this.client.bulk({ body });
      this.logger.log(`Deleted ${ids.length} vectors from Elasticsearch`);
    } catch (error) {
      this.logger.error('Failed to delete vectors from Elasticsearch', error);
      throw error;
    }
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    try {
      const query = {
        bool: {
          filter: Object.entries(filter).map(([key, value]) => ({
            term: { [`metadata.${key}`]: value },
          })),
        },
      };

      await this.client.deleteByQuery({
        index: this.vectorIndex,
        body: { query },
      });

      this.logger.log('Deleted vectors by filter from Elasticsearch');
    } catch (error) {
      this.logger.error(
        'Failed to delete vectors by filter from Elasticsearch',
        error,
      );
      throw error;
    }
  }

  async getIndexInfo(): Promise<any> {
    try {
      return await this.client.indices.get({
        index: this.vectorIndex,
      });
    } catch (error) {
      this.logger.error('Failed to get Elasticsearch index info', error);
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      return await this.client.indices.stats({
        index: this.vectorIndex,
      });
    } catch (error) {
      this.logger.error('Failed to get index stats', error);
      throw error;
    }
  }

  async fetchVectors(ids: string[]): Promise<Record<string, any>> {
    try {
      const response = await this.client.mget({
        index: this.vectorIndex,
        body: {
          ids,
        },
      });

      const result: Record<string, any> = {};
      response.docs.forEach((doc: any) => {
        if (doc.found) {
          result[doc._id] = {
            id: doc._id,
            vector: doc._source.vector,
            metadata: doc._source.metadata,
          };
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch vectors from Elasticsearch', error);
      throw error;
    }
  }

  async searchSimilar(
    vector: number[],
    threshold: number = 0.7,
    size: number = 10,
  ): Promise<ElasticsearchQueryResult[]> {
    try {
      const response = await this.client.search({
        index: this.vectorIndex,
        body: {
          query: {
            script_score: {
              query: { match_all: {} },
              script: {
                source: "cosineSimilarity(params.query_vector, 'vector') + 1.0",
                params: { query_vector: vector },
              },
              min_score: threshold,
            },
          },
          size,
        },
      });

      return response.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        metadata: hit._source?.metadata,
      }));
    } catch (error) {
      this.logger.error('Failed to search similar vectors', error);
      throw error;
    }
  }
}
