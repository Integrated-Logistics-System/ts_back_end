// src/modules/langgraph/langgraph.module.ts - LangGraph 모듈 (WebSocket 전용)
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LangGraphService } from './langgraph.service';
import { UserModule } from '../user/user.module';
import { CacheModule } from '../cache/cache.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

// 워크플로우 관련
import { WorkflowBuilder } from './workflow/workflow.builder';

// 독립적인 노드들
import {
  IntentAnalysisNode,
  RecipeSearchNode,
  CookingHelpNode,
  GeneralChatNode,
  ResponseIntegrationNode,
} from './workflow/nodes';

@Module({
  imports: [
    ConfigModule,
    UserModule, // 사용자 상태 서비스용
    CacheModule, // 캐싱용
    ElasticsearchModule, // 벡터 검색용
  ],
  controllers: [
    // REST API 제거 - WebSocket 전용
  ],
  providers: [
    // LangGraph v0.3.8 서비스
    LangGraphService,
    WorkflowBuilder,
    
    // 독립적인 워크플로우 노드들
    IntentAnalysisNode,
    RecipeSearchNode,
    CookingHelpNode,
    GeneralChatNode,
    ResponseIntegrationNode,
  ],
  exports: [
    LangGraphService, // LangGraph v0.3.8 WebSocket 서비스
    WorkflowBuilder, // 워크플로우 빌더
    
    // 노드들도 export (다른 모듈에서 사용할 수 있도록)
    IntentAnalysisNode,
    RecipeSearchNode,
    CookingHelpNode,
    GeneralChatNode,
    ResponseIntegrationNode,
  ],
})
export class LanggraphModule {}
