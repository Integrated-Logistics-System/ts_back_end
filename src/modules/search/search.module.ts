import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { VectorModule } from '../vector/vector.module';
import { RecipeModule } from '../recipe/recipe.module';

@Module({
  imports: [VectorModule, RecipeModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
