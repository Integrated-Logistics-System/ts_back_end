/**
 * 🦜 LangChain 에이전트 서비스
 * ReAct 패턴 기반 에이전트 구현
 */

import { Injectable, Logger } from '@nestjs/common';
import { LangChainCoreService } from './langchain-core.service';
import { LangChainPromptService } from './langchain-prompt.service';
import { LangChainChatService } from './langchain-chat.service';

export interface AgentTool {
  name: string;
  description: string;
  execute: (input: string) => Promise<string>;
}

export interface AgentStep {
  thought: string;
  action: string;
  actionInput: string;
  observation: string;
}

export interface AgentResponse {
  finalAnswer: string;
  steps: AgentStep[];
  totalSteps: number;
  processingTime: number;
}

export interface AgentQuery {
  question: string;
  sessionId?: string;
  maxIterations?: number;
  tools?: AgentTool[];
}

@Injectable()
export class LangChainAgentService {
  private readonly logger = new Logger(LangChainAgentService.name);
  private readonly maxIterations = 5;
  private tools: Map<string, AgentTool> = new Map();

  constructor(
    private readonly coreService: LangChainCoreService,
    private readonly promptService: LangChainPromptService,
    private readonly chatService: LangChainChatService
  ) {
    this.initializeDefaultTools();
  }

  /**
   * 기본 도구들 초기화
   */
  private initializeDefaultTools(): void {
    // 검색 도구
    this.addTool({
      name: 'search',
      description: '인터넷에서 정보를 검색합니다',
      execute: async (query: string) => {
        // 실제 구현에서는 검색 API 연동
        return `검색 결과: ${query}에 대한 정보를 찾았습니다.`;
      },
    });

    // 계산 도구
    this.addTool({
      name: 'calculator',
      description: '수학 계산을 수행합니다',
      execute: async (expression: string) => {
        try {
          // 안전한 계산을 위해 간단한 eval 대신 파싱 라이브러리 사용 권장
          const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
          return `계산 결과: ${result}`;
        } catch (error) {
          return '계산 오류: 유효하지 않은 수식입니다.';
        }
      },
    });

    // 메모리 도구 (채팅 히스토리)
    this.addTool({
      name: 'memory',
      description: '이전 대화 내용을 조회합니다',
      execute: async (sessionId: string) => {
        const history = await this.chatService.getChatHistory(sessionId, 5);
        return `최근 대화: ${history.map(msg => `${msg.role}: ${msg.content}`).join(', ')}`;
      },
    });
  }

  /**
   * 도구 추가
   */
  addTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    this.logger.debug(`도구 추가됨: ${tool.name}`);
  }

  /**
   * 도구 제거
   */
  removeTool(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.logger.debug(`도구 제거됨: ${name}`);
    }
    return removed;
  }

  /**
   * ReAct 에이전트 실행
   */
  async runAgent(query: AgentQuery): Promise<AgentResponse> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    const maxIterations = query.maxIterations || this.maxIterations;
    const availableTools = query.tools || Array.from(this.tools.values());

    this.logger.debug(`🤖 에이전트 실행: ${query.question}`);

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        this.logger.debug(`반복 ${iteration + 1}/${maxIterations}`);

        // ReAct 프롬프트 생성
        const prompt = this.createReActPrompt(query.question, availableTools, steps);

        // AI 추론 단계
        const response = await this.coreService.generateJSON<{
          thought: string;
          action: string;
          actionInput: string;
        }>(prompt, null, { temperature: 0.3 });

        const step: AgentStep = {
          thought: response.thought,
          action: response.action,
          actionInput: response.actionInput,
          observation: '',
        };

        // Final Answer 체크
        if (response.action.toLowerCase() === 'final answer') {
          return {
            finalAnswer: response.actionInput,
            steps,
            totalSteps: iteration + 1,
            processingTime: Date.now() - startTime,
          };
        }

        // 도구 실행
        const tool = availableTools.find(t => t.name === response.action);
        if (tool) {
          try {
            step.observation = await tool.execute(response.actionInput);
          } catch (error) {
            step.observation = `도구 실행 오류: ${error}`;
          }
        } else {
          step.observation = `알 수 없는 도구: ${response.action}`;
        }

        steps.push(step);

        // 관찰 결과가 최종 답변을 제공하는 경우
        if (step.observation.includes('최종 답변:')) {
          return {
            finalAnswer: step.observation.replace('최종 답변:', '').trim(),
            steps,
            totalSteps: iteration + 1,
            processingTime: Date.now() - startTime,
          };
        }
      }

      // 최대 반복 도달 시 현재까지의 결과 반환
      const fallbackAnswer = await this.generateFallbackAnswer(query.question, steps);
      
      return {
        finalAnswer: fallbackAnswer,
        steps,
        totalSteps: maxIterations,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      this.logger.error('에이전트 실행 실패:', error);
      throw new Error('Agent execution failed');
    }
  }

  /**
   * ReAct 프롬프트 생성
   */
  private createReActPrompt(
    question: string,
    tools: AgentTool[],
    previousSteps: AgentStep[]
  ): string {
    const systemPrompt = this.promptService.createSystemPrompt({
      role: 'ReAct 패턴 기반 에이전트',
      outputFormat: 'json',
      constraints: [
        '단계별로 생각하고 행동하세요',
        '도구를 적절히 활용하세요',
        '최종 답변을 제공할 준비가 되면 "Final Answer" 액션을 사용하세요'
      ]
    });

    const toolDescriptions = tools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    let prompt = `${systemPrompt}

질문: ${question}

사용 가능한 도구:
${toolDescriptions}

이전 단계들:`;

    if (previousSteps.length === 0) {
      prompt += '\n(없음)';
    } else {
      previousSteps.forEach((step, index) => {
        prompt += `\n\n단계 ${index + 1}:
생각: ${step.thought}
행동: ${step.action}
행동 입력: ${step.actionInput}
관찰: ${step.observation}`;
      });
    }

    prompt += `

다음 단계를 JSON 형식으로 응답해주세요:

{
  "thought": "현재 상황에 대한 생각",
  "action": "수행할 행동 (도구 이름 또는 'Final Answer')",
  "actionInput": "행동에 필요한 입력값"
}

중요: 최종 답변을 할 준비가 되었다면 action을 "Final Answer"로 설정하고, actionInput에 최종 답변을 작성하세요.`;

    return prompt;
  }

  /**
   * 폴백 답변 생성
   */
  private async generateFallbackAnswer(
    question: string,
    steps: AgentStep[]
  ): Promise<string> {
    const prompt = `다음 질문에 대해 지금까지의 추론 과정을 바탕으로 최선의 답변을 제공해주세요:

질문: ${question}

추론 과정:
${steps.map((step, index) => `
단계 ${index + 1}: ${step.thought}
행동: ${step.action} (${step.actionInput})
결과: ${step.observation}
`).join('')}

위 정보를 종합하여 질문에 대한 최선의 답변을 제공해주세요.`;

    return await this.coreService.generateText(prompt, { temperature: 0.7 });
  }

  /**
   * 간단한 질문 응답 (도구 없이)
   */
  async simpleQuery(question: string, sessionId?: string): Promise<string> {
    const prompt = this.promptService.createGeneralChatPrompt({
      message: question,
      conversationHistory: sessionId ? 
        (await this.chatService.getChatHistory(sessionId))
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n') : 
        undefined,
    });

    return await this.coreService.generateText(prompt);
  }

  /**
   * 도구 목록 조회
   */
  getAvailableTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 에이전트 상태 조회
   */
  getStatus(): {
    isReady: boolean;
    availableTools: string[];
    coreServiceStatus: any;
  } {
    return {
      isReady: this.coreService.getStatus().isReady,
      availableTools: Array.from(this.tools.keys()),
      coreServiceStatus: this.coreService.getStatus(),
    };
  }
}