import { Module } from '@nestjs/common';
import { ConversationManagerService } from './conversation-manager.service';
import { ConversationalAssistantController } from './conversational-assistant.controller';
import { ChatModule } from '../chat/chat.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    ChatModule, // 대화 히스토리 및 RAG
    ElasticsearchModule, // 레시피 검색
    UserModule, // 사용자 정보
    // AiModule은 Global이므로 자동으로 사용 가능
  ],
  controllers: [ConversationalAssistantController],
  providers: [
    ConversationManagerService,
  ],
  exports: [
    ConversationManagerService,
  ],
})
export class ConversationModule {
  constructor(private readonly conversationManager: ConversationManagerService) {
    // 정기적인 세션 정리 작업 시작
    this.conversationManager.startCleanupTimer();
  }
}