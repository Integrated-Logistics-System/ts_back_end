import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { RecipeMetadata, RecipeMetadataSchema } from './recipe-metadata.schema';
import { UserRecipe, UserRecipeSchema } from './user-recipe.schema';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { UserModule } from '../user/user.module';
import { RecipeMetadataService } from './services/recipe-metadata.service';
import { RecipeUserActionsService } from './services/recipe-user-actions.service';
import { RecipeStatsService } from './services/recipe-stats.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RecipeMetadata.name, schema: RecipeMetadataSchema },
      { name: UserRecipe.name, schema: UserRecipeSchema },
    ]),
    ElasticsearchModule, // 검색 기능을 위해
    UserModule,         // 사용자 프로필 접근을 위해
  ],
  controllers: [RecipeController],
  providers: [
    RecipeService,
    RecipeMetadataService,
    RecipeUserActionsService,
    RecipeStatsService,
  ],
  exports: [RecipeService],
})
export class RecipeModule {}