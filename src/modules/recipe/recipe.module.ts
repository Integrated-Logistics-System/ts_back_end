import { Module } from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { RecipeController } from './recipe.controller';
import { ElasticsearchModule } from '@/modules/elasticsearch/elasticsearch.module';

@Module({
  imports: [ElasticsearchModule],
  controllers: [RecipeController],
  providers: [RecipeService],
  exports: [RecipeService],
})
export class RecipeModule {}
