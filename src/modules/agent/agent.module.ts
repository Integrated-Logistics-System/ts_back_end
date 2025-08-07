import { Module } from '@nestjs/common';
import { RecipeAgentService } from './core/main-agent';
import { ConversationContextService } from './context/context-analyzer';
import { IntentClassifierService } from './classification/intent-classifier';
import { AlternativeRecipeGeneratorService } from './generation/recipe-generator';
import { LlmFallbackAnalyzerService } from './context/fallback-analyzer';
import { AiModule } from '../ai/ai.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { ElasticsearchAgentService } from './search/elasticsearch-agent';
import { TcreiPromptLoaderService } from '../prompt-templates/tcrei/tcrei-prompt-loader.service';
import { PromptFileLoaderService } from '../prompt-templates/tcrei/prompt-file-loader.service';

@Module({
  imports: [AiModule, ElasticsearchModule],
  providers: [
    RecipeAgentService,
    ConversationContextService,
    IntentClassifierService,
    AlternativeRecipeGeneratorService,
    LlmFallbackAnalyzerService,
    ElasticsearchAgentService,
    PromptFileLoaderService,
    TcreiPromptLoaderService
  ],
  exports: [RecipeAgentService, ElasticsearchAgentService],
})
export class AgentModule {}