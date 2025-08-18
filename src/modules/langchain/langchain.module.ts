import { Module } from '@nestjs/common';
import { LangChainService } from './langchain.service';
import { IntentAnalysisService } from './services/intent-analysis.service';
import { StreamingService } from './services/streaming.service';
import { RecipeSearchService } from './services/recipe-search.service';
import { DataTransformService } from './services/data-transform.service';
import { ReactAgentService } from './services/react-agent.service';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [ElasticsearchModule],
  providers: [
    // 🎯 메인 오케스트레이터
    LangChainService,
    
    // 🧠 ReAct 에이전트 서비스
    ReactAgentService,
    
    // 📋 전문화된 서비스들
    IntentAnalysisService,
    StreamingService,
    RecipeSearchService,
    DataTransformService,
  ],
  exports: [
    LangChainService,
    // ReAct 에이전트 서비스 export
    ReactAgentService,
    // 다른 모듈에서도 사용할 수 있도록 서브 서비스들도 export
    IntentAnalysisService,
    StreamingService,
    RecipeSearchService,
    DataTransformService,
  ],
})
export class LangChainModule {}