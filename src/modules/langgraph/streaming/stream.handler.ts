import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { WebSocketStreamChunk, RAGRecipeRequest } from '@/shared/interfaces/langgraph.interface';
import {GraphState, UserProfile} from '../types/workflow.types';
import { ElasticsearchService } from '@/modules/elasticsearch/elasticsearch.service';

@Injectable()
export class StreamHandler {
  private readonly logger = new Logger(StreamHandler.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async *streamRecipeWorkflowForWebSocket(
    workflow: Runnable<GraphState, GraphState>,
    query: string,
    allergies: string[] = [],
    userId?: string,
    userProfile: UserProfile | null = null
  ): AsyncGenerator<WebSocketStreamChunk, void, unknown> {
    try {

      const initialState: GraphState = {
        messages: [new HumanMessage(query)],
        query,
        userAllergies: allergies,
        searchResults: [],
        generatedRecipe: null,
        finalResponse: '',
        currentStep: 'start',
        userId: userId || null,
        userProfile: userProfile || null,
        metadata: {
          searchTime: 0,
          generationTime: 0,
          totalTime: 0,
        },
      };

      // 🔥 실제 스트리밍 - 각 노드 실행마다 실시간 전송
      const stream = await workflow.stream(initialState);
      
      let finalResult: GraphState | null = null;

      for await (const chunk of stream) {
        // LangGraph stream에서 나오는 chunk 형태: { nodeName: nodeOutput }
        const entries = Object.entries(chunk);
        if (entries.length === 0) continue;
        
        const entry = entries[0];
        if (!entry) continue;
        
        const [nodeName, nodeOutput] = entry;
        if (!nodeName || !nodeOutput) continue;
        
        const state = nodeOutput as GraphState;
        
        // 각 노드 완료시마다 상태 전송
        const statusMessage = this.getStatusMessage(state.currentStep, state, nodeName);

        yield {
          type: 'status',
          content: statusMessage,
          timestamp: Date.now(),
          userId,
          query,
          data: {
            currentStep: state.currentStep,
            nodeName,
            metadata: state.metadata
          }
        };

        finalResult = state;
      }

      // 최종 결과 전송
      if (finalResult) {
        yield {
          type: 'complete',
          content: finalResult.finalResponse,
          data: finalResult,
          timestamp: Date.now(),
          userId,
          query
        };
      }

    } catch (error: unknown) {
      this.logger.error('WebSocket streaming workflow failed:', error instanceof Error ? error.message : 'Unknown error');
      yield {
        type: 'error',
        content: `워크플로우 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        userId,
        query
      };
    }
  }

  async *streamRAGForWebSocket(
    request: RAGRecipeRequest,
    userId?: string
  ): AsyncGenerator<WebSocketStreamChunk, void, unknown> {
    try {
      yield {
        type: 'status',
        content: '🔍 RAG 처리 시작...',
        timestamp: Date.now(),
        userId,
        query: request.query
      };

      const startTime = Date.now();
      const searchResults = await this.elasticsearchService.searchRecipes(request.query, {
        limit: 10,
        page: 1,
        allergies: request.userAllergies || [],
        preferences: request.preferences || [],
      });

      const recipes = searchResults.recipes || [];
      const isLast = true;

      yield {
        type: isLast ? 'complete' : 'status',
        content: this.buildSearchResponse(recipes, request.query, request.userAllergies || []),
        data: {
          searchResults: recipes,
          query: request.query,
          userAllergies: request.userAllergies || [],
          metadata: {
            searchTime: Date.now() - startTime,
            totalTime: Date.now() - startTime,
            generationTime: 0,
          }
        },
        timestamp: Date.now(),
        userId,
        query: request.query
      };

    } catch (error: unknown) {
      this.logger.error('RAG streaming failed:', error instanceof Error ? error.message : 'Unknown error');
      yield {
        type: 'error',
        content: `RAG 처리 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        userId,
        query: request.query
      };
    }
  }

  private getStatusMessage(currentStep: string, state: GraphState, nodeName: string): string {
    switch (currentStep) {
      case 'analyze_complete':
        return '✅ 쿼리 분석 완료';
      case 'search_complete':
        return `🔍 레시피 검색 완료 (${state.searchResults?.length || 0}개 발견)`;
      case 'search_disabled':
        return '⚠️ RAG 워크플로우 비활성화됨';
      case 'search_failed':
        return '❌ 레시피 검색 실패';
      case 'generation_complete':
        return '🍳 새 레시피 생성 완료';
      case 'generation_failed':
        return '❌ 레시피 생성 실패';
      case 'complete':
        return '📝 최종 응답 생성 완료';
      case 'response_failed':
        return '❌ 응답 생성 실패';
      default:
        return `⚙️ ${nodeName} 단계 진행 중... (${currentStep})`;
    }
  }

  private buildSearchResponse(recipes: any[], query: string, allergies: string[]): string {
    const topRecipes = recipes.slice(0, 3);

    const recipeList = topRecipes.map((recipe, i) =>
      `${i + 1}. **${recipe.nameKo || recipe.name}** (${recipe.minutes}분)\n   - 재료: ${recipe.ingredients?.slice(0, 3).join(', ')}${recipe.ingredients?.length > 3 ? ' 등' : ''}\n   - 난이도: ${recipe.difficulty}`
    ).join('\n\n');

    const allergyInfo = allergies.length > 0
      ? `✅ ${allergies.join(', ')} 알레르기 안전 확인됨`
      : '';

    return `## 🔍 "${query}" 검색 결과\n\n${recipeList}\n\n${allergyInfo}\n\n💡 **더 자세한 레시피를 원하시면 "첫 번째 레시피 자세히 알려줘"라고 말씀해주세요!**`;
  }

  chunkResponse(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }
}