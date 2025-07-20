// src/modules/websocket/websocket.module.ts (Refactored with Modular Architecture)

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { LanggraphModule } from '@/modules/langgraph/langgraph.module';
import { ConversationModule } from '../conversation/conversation.module';
import { ChatModule } from '../chat/chat.module';

// Main services
import { ChatGateway } from './websocket.gateway';
import { PersonalChatService } from './personal-chat.service';

// Refactored modular services - PersonalChat
import { ConversationAnalyzer } from './processors/conversation-analyzer.service';
import { EnhancedIntentAnalyzer } from './processors/enhanced-intent-analyzer.service';
import { DetailRequestProcessor } from './processors/detail-request.processor';
import { RecipeRequestProcessor } from './processors/recipe-request.processor';

// Managers - PersonalChat & WebSocket
import { MessageStorageManager } from './managers/message-storage.manager';
import { ContextManager } from './managers/context.manager';
import { ConnectionManager } from './managers/connection.manager';
import { AuthenticationManager } from './managers/authentication.manager';

// Handlers - WebSocket
import { LangGraphHandler } from './handlers/langgraph.handler';
import { ChatHandler } from './handlers/chat.handler';
import { StatusHandler } from './handlers/status.handler';

// Utilities
import { PromptBuilder } from './utils/prompt-builder.util';
import { WebSocketUtils } from './utils/websocket.utils';

@Module({
  imports: [
    AuthModule,        // JWT 인증 전용
    UserModule,        // 사용자 프로필 조회 전용
    LanggraphModule,   // LangGraph AI 워크플로우 서비스
    ConversationModule, // ChatGPT 스타일 대화형 시스템
    ChatModule,        // 채팅 히스토리 서비스
    // AiModule은 Global로 등록되어 있으므로 import 불필요
    // CacheModule은 Global이므로 import 불필요
  ],
  providers: [
    // Main services
    ChatGateway,
    PersonalChatService,
    
    // Modular processors - PersonalChat
    ConversationAnalyzer,
    EnhancedIntentAnalyzer,
    DetailRequestProcessor,
    RecipeRequestProcessor,
    
    // Managers - PersonalChat & WebSocket
    MessageStorageManager,
    ContextManager,
    ConnectionManager,
    AuthenticationManager,
    
    // Handlers - WebSocket
    LangGraphHandler,
    ChatHandler,
    StatusHandler,
    
    // Utilities
    PromptBuilder,
    WebSocketUtils,
  ],
  exports: [
    PersonalChatService,
    // Export modular services for use in other modules if needed
    ConversationAnalyzer,
    EnhancedIntentAnalyzer,
    MessageStorageManager,
    ContextManager,
  ],
})
export class WebsocketModule {}