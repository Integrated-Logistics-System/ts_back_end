import { Module } from '@nestjs/common';
import { DataController } from './data.controller';
import { RecipeModule } from '../recipe/recipe.module';

@Module({
  imports: [RecipeModule],
  controllers: [DataController],
})
export class DataModule {}
