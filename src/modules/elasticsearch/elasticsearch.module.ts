import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

// Main service
import { ElasticsearchService } from './elasticsearch.service';

// Modular services
import { RecipeSearchService } from './search/recipe-search.service';
import { RecipeManagementService } from './management/recipe-management.service';
import { AllergenProcessor } from './processors/allergen-processor.service';

// Utility services
import { QueryBuilder } from './utils/query-builder.util';
import { ResponseFormatter } from './utils/response-formatter.util';
import { RecipeValidator } from './utils/recipe-validator.util';

@Module({
  imports: [ConfigModule],
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
    RecipeManagementService,
    AllergenProcessor,
    
    // Utility services
    QueryBuilder,
    ResponseFormatter,
    RecipeValidator,
  ],
  exports: [
    ElasticsearchService,
    // Export modular services for use in other modules if needed
    RecipeSearchService,
    RecipeManagementService,
    AllergenProcessor,
  ],
})
export class ElasticsearchModule {}