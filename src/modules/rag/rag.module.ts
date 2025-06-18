import { Module } from '@nestjs/common';
import { RAGService } from './rag.service';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { OllamaModule } from '../../shared/ollama/ollama.module';
import { AllergenModule } from '../allergen/allergen.module';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [ElasticsearchModule, OllamaModule, AllergenModule, TranslationModule],
  providers: [RAGService],
  exports: [RAGService],
})
export class RAGModule {}
