import { Module } from '@nestjs/common';
import { AllergenService } from './allergen.service';
import { AllergenController } from './allergen.controller';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [ElasticsearchModule],
  controllers: [AllergenController],
  providers: [AllergenService],
  exports: [AllergenService], // RAG 서비스에서 사용할 수 있도록 export
})
export class AllergenModule {}
