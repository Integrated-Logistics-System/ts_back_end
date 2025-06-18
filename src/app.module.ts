import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RecipeModule } from './modules/recipe/recipe.module';
import { RAGModule } from './modules/rag/rag.module';
import { AllergenModule } from './modules/allergen/allergen.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RecipeModule,
    RAGModule,
    AllergenModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
