import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { AgentModule } from '../agent/agent.module';
import { ChatModule } from '../chat/chat.module';
import { AiModule } from '../ai/ai.module';

import { ChatGateway } from './websocket.gateway';

@Module({
  imports: [
    AuthModule,
    UserModule,
    AgentModule,
    ChatModule,
    AiModule,
  ],
  providers: [
    ChatGateway,
  ],
  exports: [
    ChatGateway,
  ],
})
export class WebsocketModule {}