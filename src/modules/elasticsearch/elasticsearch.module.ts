import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { EmbeddingModule } from '../embedding/embedding.module';
import { CacheModule } from '../cache/cache.module';

// Main service
import { ElasticsearchService } from './elasticsearch.service';

// Modular services
import { RecipeSearchService } from './search/recipe-search.service';
import { AllergenProcessor } from './processors/allergen-processor.service';

// Controllers
import { VectorSearchController } from './controllers/vector-search.controller';

@Module({
  imports: [ConfigModule, EmbeddingModule, CacheModule],
  controllers: [VectorSearchController],
  providers: [
    // Elasticsearch Client Provider
    {
      provide: 'ELASTICSEARCH_CLIENT',
      useFactory: (configService: ConfigService) => {
        const elasticsearchUrl = configService.get<string>('ELASTICSEARCH_URL') || 'http://localhost:9200';
        return new Client({
          node: elasticsearchUrl,
          maxRetries: 3,
          requestTimeout: 60000,
          sniffOnStart: false,
        });
      },
      inject: [ConfigService],
    },
    
    // Main service
    ElasticsearchService,
    
    // Modular services
    RecipeSearchService,
    AllergenProcessor,
  ],
  exports: [
    ElasticsearchService,
    // Export modular services for use in other modules if needed
    RecipeSearchService,
    AllergenProcessor,
  ],
})
export class ElasticsearchModule {}