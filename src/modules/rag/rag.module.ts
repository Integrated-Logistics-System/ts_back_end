import { Module } from '@nestjs/common';
import { KoreanRAGService } from './korean-rag.service';
import { AdvancedRAGService } from './advanced-rag.service';
import { RAGController } from './rag.controller';
import { RAGPipelineController } from './rag-pipeline.controller';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { AiModule } from '../ai/ai.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [ElasticsearchModule, AiModule, UserModule],
  providers: [KoreanRAGService, AdvancedRAGService],
  controllers: [RAGController, RAGPipelineController],
  exports: [KoreanRAGService, AdvancedRAGService],
})
export class RAGModule {}