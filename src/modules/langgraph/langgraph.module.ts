import { Module } from '@nestjs/common';
import { LangGraphService } from './langgraph.service';
import { RecipeModule } from '../recipe/recipe.module';
import { IngredientModule } from '../ingredient/ingredient.module';
import { UserModule } from '../user/user.module';
import { OllamaModule } from '../../shared/ollama/ollama.module';

@Module({
  imports: [RecipeModule, IngredientModule, UserModule, OllamaModule],
  providers: [LangGraphService],
  exports: [LangGraphService],
})
export class LangGraphModule {}