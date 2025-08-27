import { Injectable, Logger } from '@nestjs/common';
import { Ollama } from '@langchain/ollama';
import { RecipeSearchService } from './recipe-search.service';
import { ElasticsearchService } from '../../elasticsearch/elasticsearch.service';
import { ConversationContext } from '../types/langchain.types';
import { RecipeTransformUtil } from '../utils/recipe-transform.util';

/**
 * 🧠 진짜 ReAct (Reasoning + Acting) 패턴 에이전트
 * LLM이 실제로 추론하고 도구를 선택하여 사용
 */
@Injectable()
export class ReactAgentService {
  private readonly logger = new Logger(ReactAgentService.name);
  private readonly ollama: Ollama;

  constructor(
    private readonly recipeSearchService: RecipeSearchService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {
    this.ollama = new Ollama({
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3:1.7b',
      temperature: 0.3, // ReAct는 낮은 온도로 추론 안정성 확보
    });
    
    this.logger.log('🧠 Real ReAct Agent Service initialized');
  }

  /**
   * 🤔 진짜 ReAct 실행: LLM이 직접 추론하고 도구 선택
   */
  async *executeReactStream(
    input: string, 
    _sessionId: string,
    _context?: ConversationContext
  ): AsyncGenerator<any, void, unknown> {
    
    let step = 0;
    const maxSteps = 5; // 무한 루프 방지
    let finalAnswer = '';
    
    // 사용 가능한 도구들 정의
    const availableTools = [
      'recipe_search: 레시피를 검색합니다',
      'get_cooking_tips: 요리 팁을 제공합니다', 
      'ingredient_substitute: 재료 대체 방법을 알려줍니다'
    ];

    while (step < maxSteps && !finalAnswer) {
      step++;
      
      // Step 1: LLM에게 현재 상황을 분석하고 다음 행동 결정하도록 요청
      const thinkingPrompt = this.buildThinkingPrompt(input, step, availableTools);
      
      yield {
        type: 'thought',
        content: `💭 **단계 ${step} 추론 중...**`,
        step: `thinking_${step}`,
        timestamp: Date.now()
      };

      // LLM이 실제로 추론
      const thinkingResponse = await this.ollama.invoke(thinkingPrompt);
      const reasoning = typeof thinkingResponse === 'string' 
        ? thinkingResponse 
        : (thinkingResponse as any)?.content || String(thinkingResponse);
      
      yield {
        type: 'thought',
        content: reasoning,
        step: `analysis_${step}`,
        timestamp: Date.now()
      };

      // Step 2: LLM이 선택한 도구 파싱 및 실행
      const actionDecision = this.parseActionFromReasoning(reasoning);
      
      if (actionDecision.action === 'final_answer') {
        // 최종 답변 도달
        finalAnswer = actionDecision.content;
        yield {
          type: 'final_answer',
          content: finalAnswer,
          step: 'complete',
          timestamp: Date.now()
        };
        break;
      }
      
      if (actionDecision.action !== 'none') {
        yield {
          type: 'action',
          content: `🔧 **도구 실행**: ${actionDecision.action}`,
          step: `action_${step}`,
          timestamp: Date.now()
        };

        // 실제 도구 실행
        const toolResult = await this.executeTool(actionDecision.action, actionDecision.input);
        
        yield {
          type: 'observation',
          content: `📊 **결과**: ${toolResult}`,
          data: toolResult,
          step: `result_${step}`,
          timestamp: Date.now()
        };

        // LLM에게 결과를 바탕으로 최종 답변 생성하도록 요청
        const conclusionPrompt = this.buildConclusionPrompt(input, reasoning, toolResult);
        const conclusion = await this.ollama.invoke(conclusionPrompt);
        finalAnswer = typeof conclusion === 'string' 
          ? conclusion 
          : (conclusion as any)?.content || String(conclusion);
        
        yield {
          type: 'final_answer',
          content: finalAnswer,
          step: 'complete',
          timestamp: Date.now()
        };
        break;
      }
    }

    if (!finalAnswer) {
      yield {
        type: 'error',
        content: '최대 단계 수에 도달했습니다. 더 구체적으로 질문해주세요.',
        step: 'timeout',
        timestamp: Date.now()
      };
    }
  }

  /**
   * 🧠 LLM이 추론할 수 있는 프롬프트 생성
   */
  private buildThinkingPrompt(input: string, step: number, tools: string[]): string {
    return `당신은 전문 AI 요리사입니다. 다음 사용자 요청을 분석하고 적절한 행동을 결정하세요.

사용자 요청: "${input}"
현재 단계: ${step}

사용 가능한 도구들:
${tools.map(tool => `- ${tool}`).join('\n')}

다음 중 하나를 선택하세요:
1. recipe_search: 레시피 검색이 필요한 경우
2. get_cooking_tips: 요리 팁이 필요한 경우  
3. ingredient_substitute: 재료 대체가 필요한 경우
4. final_answer: 충분한 정보가 있어 바로 답변 가능한 경우

응답 형식:
REASONING: [왜 이 행동을 선택했는지 설명]
ACTION: [선택한 도구 이름 또는 final_answer]
INPUT: [도구에 전달할 입력값, final_answer인 경우 답변 내용]`;
  }

  /**
   * 🔍 LLM 응답에서 실행할 액션 파싱
   */
  private parseActionFromReasoning(reasoning: string): { action: string; input: string; content: string } {
    const actionMatch = reasoning.match(/ACTION:\s*(.+)/i);
    const inputMatch = reasoning.match(/INPUT:\s*(.+)/i);
    
    if (!actionMatch || !actionMatch[1]) {
      return { action: 'none', input: '', content: '' };
    }
    
    const action = actionMatch[1].trim().toLowerCase();
    const input = inputMatch && inputMatch[1] ? inputMatch[1].trim() : '';
    
    return { action, input, content: input };
  }

  /**
   * 🔧 실제 도구 실행
   */
  private async executeTool(toolName: string, input: string): Promise<string> {
    try {
      switch (toolName) {
        case 'recipe_search':
          const searchResult = await this.recipeSearchService.searchAndProcessRecipes(input);
          const transformed = RecipeTransformUtil.transformRecipes(searchResult.recipes);
          return `${transformed.length}개의 레시피를 찾았습니다: ${transformed.slice(0, 3).map(r => r.title).join(', ')}`;
          
        case 'get_cooking_tips':
          return this.getCookingTips(input);
          
        case 'ingredient_substitute':
          return this.getIngredientSubstitutes(input);
          
        default:
          return '알 수 없는 도구입니다.';
      }
    } catch (error) {
      this.logger.error(`Tool execution error: ${error}`);
      return '도구 실행 중 오류가 발생했습니다.';
    }
  }

  /**
   * 📝 최종 답변 생성 프롬프트
   */
  private buildConclusionPrompt(userInput: string, reasoning: string, toolResult: string): string {
    return `사용자 요청: "${userInput}"
이전 추론: ${reasoning}
도구 실행 결과: ${toolResult}

위 정보를 바탕으로 사용자에게 도움이 되는 친근한 답변을 작성해주세요. 구체적이고 실용적인 조언을 포함하세요.`;
  }

  /**
   * 요리 팁 제공 (간단한 룰 베이스)
   */
  private getCookingTips(ingredient: string): string {
    const tips: Record<string, string> = {
      '닭가슴살': '조리 전 소금물에 30분 담가두면 부드러워집니다.',
      '파스타': '물에 소금을 넣고 끓이면 더 맛있어요.',
      '스테이크': '고기를 실온에 30분 두었다가 구우세요.',
    };
    
    return tips[ingredient] || '해당 재료의 팁을 찾을 수 없습니다.';
  }

  /**
   * 재료 대체 방법
   */
  private getIngredientSubstitutes(ingredient: string): string {
    const substitutes: Record<string, string> = {
      '버터': '식물성 오일이나 마가린으로 대체 가능합니다.',
      '우유': '두유나 아몬드 밀크로 대체 가능합니다.',
      '달걀': '아쿠아파바(콩 삶은 물)로 대체 가능합니다.',
    };
    
    return substitutes[ingredient] || '해당 재료의 대체 방법을 찾을 수 없습니다.';
  }
}