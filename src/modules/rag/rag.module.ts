import { Module } from '@nestjs/common';
import { AdvancedRAGService } from './advanced-rag.service';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [ElasticsearchModule, AiModule],
  providers: [AdvancedRAGService],
  exports: [AdvancedRAGService],
})
export class RAGModule {}