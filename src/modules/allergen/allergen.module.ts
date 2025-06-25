import { Module } from '@nestjs/common';
import { AllergenController } from './allergen.controller';
import { AllergenService } from './allergen.service';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [ElasticsearchModule],
  controllers: [AllergenController],
  providers: [AllergenService],
  exports: [AllergenService],
})
export class AllergenModule {}