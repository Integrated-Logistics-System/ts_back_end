import { Module } from '@nestjs/common';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { AgentModule } from '../agent/agent.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    AgentModule,        // 🤖 Agent 기반 검색 기능을 위해
    UserModule,         // 사용자 프로필 접근을 위해
  ],
  controllers: [RecipeController],
  providers: [
    RecipeService,
  ],
  exports: [RecipeService],
})
export class RecipeModule {}