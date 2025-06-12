import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { RecipeModule } from '../recipe/recipe.module';
import { IngredientModule } from '../ingredient/ingredient.module';
import { UserModule } from '../user/user.module';
import { OllamaModule } from '../../shared/ollama/ollama.module';
import { LangGraphModule } from '../langgraph/langgraph.module';

@Module({
  imports: [
    RecipeModule,
    IngredientModule,
    UserModule,
    OllamaModule,
    LangGraphModule,
  ],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}