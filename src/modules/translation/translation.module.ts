import { Module } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { OllamaModule } from '../../shared/ollama/ollama.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [
    OllamaModule,
    ElasticsearchModule,
  ],
  providers: [TranslationService],
  exports: [TranslationService],
})
export class TranslationModule {}
