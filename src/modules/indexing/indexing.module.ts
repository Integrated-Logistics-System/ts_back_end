import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IndexingController } from './indexing.controller';
import { IndexingService } from './services/indexing.service';
import { DataProcessingService } from './services/data-processing.service';
import { ElasticsearchIndexingService } from './services/elasticsearch-indexing.service';
import { MongodbStorageService } from './services/mongodb-storage.service';
import { RedisCacheService } from './services/redis-cache.service';
import { ProcessedRecipe, ProcessedRecipeSchema } from './schemas/processed-recipe.schema';
import { ProcessedIngredient, ProcessedIngredientSchema } from './schemas/processed-ingredient.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProcessedRecipe.name, schema: ProcessedRecipeSchema },
      { name: ProcessedIngredient.name, schema: ProcessedIngredientSchema },
    ]),
  ],
  controllers: [IndexingController],
  providers: [
    IndexingService,
    DataProcessingService,
    ElasticsearchIndexingService,
    MongodbStorageService,
    RedisCacheService,
  ],
  exports: [
    IndexingService,
    DataProcessingService,
    ElasticsearchIndexingService,
    MongodbStorageService,
    RedisCacheService,
  ],
})
export class IndexingModule {}
