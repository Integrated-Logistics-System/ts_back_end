import { Module } from '@nestjs/common';
import { LangchainService } from './langchain.service';
import { LangchainController } from './langchain.controller';
import { RedisModule } from '../redis/redis.module';
import { OllamaModule } from '../ollama/ollama.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { AllergenModule } from '../allergen/allergen.module';

@Module({
  imports: [
    RedisModule,
    OllamaModule,
    ElasticsearchModule,
    AllergenModule,
  ],
  controllers: [LangchainController],
  providers: [LangchainService],
  exports: [LangchainService],
})
export class LangchainModule {}