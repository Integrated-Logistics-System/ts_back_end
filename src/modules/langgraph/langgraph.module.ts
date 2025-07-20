// src/modules/langgraph/langgraph.module.ts - 모듈화된 LangGraph 모듈
import { Module } from '@nestjs/common';
import { LangGraphService } from './langgraph.service';
import { LanggraphController } from './langgraph.controller';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { UserModule } from '../user/user.module';
import { ChatModule } from '../chat/chat.module';

// 워크플로우 관련
import { WorkflowBuilder } from './workflow/workflow.builder';
import { AnalyzeNode } from './workflow/nodes/analyze.node';
import { SearchNode } from './workflow/nodes/search.node';
import { GenerateNode } from './workflow/nodes/generate.node';
import { ResponseNode } from './workflow/nodes/response.node';

// 스트리밍 관련
import { StreamHandler } from './streaming/stream.handler';
import { WebSocketAdapter } from './streaming/websocket.adapter';

// 포맷터 관련
import { RecipeFormatter } from './formatters/recipe.formatter';
import { ResponseFormatter } from './formatters/response.formatter';

// 유틸리티 관련
import { RecipeUtils } from './utils/recipe.utils';
import { ValidationUtils } from './utils/validation.utils';

@Module({
  imports: [
    ElasticsearchModule, // 레시피 검색용
    UserModule, // 사용자 정보 관련
    ChatModule, // 대화 히스토리 및 RAG
    // CacheModule과 AiModule은 Global이므로 import 불필요
  ],
  controllers: [LanggraphController],
  providers: [
    // 메인 서비스
    LangGraphService,
    
    // 워크플로우 관련
    WorkflowBuilder,
    AnalyzeNode,
    SearchNode,
    GenerateNode,
    ResponseNode,
    
    // 스트리밍 관련
    StreamHandler,
    WebSocketAdapter,
    
    // 포맷터 관련
    RecipeFormatter,
    ResponseFormatter,
    
    // 유틸리티 관련
    RecipeUtils,
    ValidationUtils,
  ],
  exports: [LangGraphService],
})
export class LanggraphModule {}
