import { Injectable, Logger } from '@nestjs/common';
import { ChatHistoryService } from '../chat/chat-history.service';

export interface ConversationState {
  sessionId: string;
  userId: string;
  currentStage: 'greeting' | 'exploring' | 'focused' | 'cooking' | 'clarifying';
  currentRecipes: RecipeReference[];
  selectedRecipe?: RecipeReference;
  currentStep?: number;
  userIntent: 'search' | 'detail' | 'substitute' | 'help' | 'chat';
  lastMention: string; // "첫 번째", "그 레시피" 등 참조 해결용
  contextHistory: ConversationTurn[];
}

export interface RecipeReference {
  id: string;
  title: string;
  titleKo: string;
  shortDescription: string;
  position: number; // 검색 결과에서의 순서 (1, 2, 3...)
  mentioned: boolean; // 대화에서 언급되었는지
}

export interface ConversationTurn {
  userMessage: string;
  aiResponse: string;
  intent: string;
  timestamp: number;
  recipes?: RecipeReference[];
}

@Injectable()
export class ConversationManagerService {
  private readonly logger = new Logger(ConversationManagerService.name);
  private activeStates = new Map<string, ConversationState>();

  constructor(private readonly chatHistoryService: ChatHistoryService) {}

  // ================== 대화 상태 관리 ==================

  async getOrCreateConversationState(userId: string, sessionId?: string): Promise<ConversationState> {
    const stateKey = sessionId || `${userId}_${Date.now()}`;
    
    if (this.activeStates.has(stateKey)) {
      return this.activeStates.get(stateKey)!;
    }

    // 이전 대화 히스토리에서 컨텍스트 복원
    const recentHistory = await this.chatHistoryService.getChatHistory(userId, 5);
    const context = this.buildContextFromHistory(recentHistory);

    const state: ConversationState = {
      sessionId: stateKey,
      userId,
      currentStage: 'greeting',
      currentRecipes: [],
      userIntent: 'chat',
      lastMention: '',
      contextHistory: context,
    };

    this.activeStates.set(stateKey, state);
    return state;
  }

  async updateConversationState(
    sessionId: string, 
    userMessage: string, 
    aiResponse: string,
    recipes?: RecipeReference[]
  ): Promise<void> {
    const state = this.activeStates.get(sessionId);
    if (!state) return;

    // 의도 분석
    state.userIntent = this.classifyIntent(userMessage);
    
    // 단계 업데이트
    state.currentStage = this.determineStage(state, userMessage);
    
    // 레시피 참조 업데이트
    if (recipes?.length) {
      state.currentRecipes = recipes;
    }

    // 참조 표현 기록
    state.lastMention = this.extractReference(userMessage);

    // 대화 턴 추가
    state.contextHistory.push({
      userMessage,
      aiResponse,
      intent: state.userIntent,
      timestamp: Date.now(),
      recipes,
    });

    // 최대 10턴만 유지
    if (state.contextHistory.length > 10) {
      state.contextHistory = state.contextHistory.slice(-10);
    }

    this.activeStates.set(sessionId, state);
  }

  // ================== 의도 분류 ==================

  private classifyIntent(message: string): ConversationState['userIntent'] {
    const msg = message.toLowerCase();

    // 상세 요청 우선 처리 (참조 표현 유무와 관계없이)
    if (msg.includes('자세히') || msg.includes('상세') || msg.includes('알려줘') || msg.includes('설명') || 
        msg.includes('어떻게 만들') || msg.includes('요리법') || msg.includes('조리법') || msg.includes('만드는 법')) {
      return 'detail';
    }

    // 재료 대체
    if (msg.includes('대신') || msg.includes('바꿔') || msg.includes('없으면') || msg.includes('대체')) {
      return 'substitute';
    }

    // 요리 도움
    if (msg.includes('어떻게') || msg.includes('방법') || msg.includes('팁') || msg.includes('주의')) {
      return 'help';
    }

    // 레시피 검색 (상세 요청이 아닌 경우에만)
    if (msg.includes('레시피') || msg.includes('요리') || msg.includes('만들') || msg.includes('추천')) {
      return 'search';
    }

    return 'chat';
  }

  // ================== 단계 결정 ==================

  private determineStage(state: ConversationState, message: string): ConversationState['currentStage'] {
    const intent = state.userIntent;

    if (intent === 'search') {
      return 'exploring';
    }

    if (intent === 'detail' && state.currentRecipes.length > 0) {
      return 'focused';
    }

    if (intent === 'help' || intent === 'substitute') {
      return 'cooking';
    }

    if (intent === 'chat') {
      return 'greeting';
    }

    return state.currentStage;
  }

  // ================== 참조 해결 ==================

  async resolveReference(state: ConversationState, message: string): Promise<RecipeReference | null> {
    const reference = this.extractReference(message);
    
    if (!reference || !state.currentRecipes.length) {
      return null;
    }

    // 순서 참조 ("첫 번째", "두 번째", "마지막")
    const orderMatch = this.extractOrder(reference);
    if (orderMatch !== null) {
      const recipe = state.currentRecipes[orderMatch];
      if (recipe) {
        recipe.mentioned = true;
        state.selectedRecipe = recipe;
        return recipe;
      }
    }

    // 직접 참조 ("그거", "이것", "저것")
    if (this.isDirectReference(reference)) {
      // 가장 최근에 언급된 레시피 또는 첫 번째 레시피
      const recipe = state.selectedRecipe || state.currentRecipes[0];
      if (recipe) {
        recipe.mentioned = true;
        state.selectedRecipe = recipe;
        return recipe;
      }
    }

    return null;
  }

  // ================== 컨텍스트 구성 ==================

  buildConversationContext(state: ConversationState): string {
    let context = '';

    // 현재 단계에 따른 컨텍스트
    switch (state.currentStage) {
      case 'exploring':
        context += '사용자가 레시피를 탐색하고 있습니다.\n';
        if (state.currentRecipes.length) {
          context += `현재 검색된 레시피: ${state.currentRecipes.map((r, i) => `${i + 1}. ${r.titleKo}`).join(', ')}\n`;
        }
        break;

      case 'focused':
        if (state.selectedRecipe) {
          context += `현재 집중하고 있는 레시피: ${state.selectedRecipe.titleKo}\n`;
        }
        break;

      case 'cooking':
        if (state.selectedRecipe) {
          context += `현재 요리 중인 레시피: ${state.selectedRecipe.titleKo}\n`;
          if (state.currentStep) {
            context += `현재 단계: ${state.currentStep}단계\n`;
          }
        }
        break;
    }

    // 최근 대화 요약
    if (state.contextHistory.length > 0) {
      context += '\n최근 대화:\n';
      state.contextHistory.slice(-3).forEach((turn, i) => {
        context += `${i + 1}. 사용자: "${turn.userMessage}"\n`;
        context += `   AI: "${turn.aiResponse.substring(0, 50)}..."\n`;
      });
    }

    return context;
  }

  // ================== 헬퍼 메서드 ==================

  private buildContextFromHistory(history: any[]): ConversationTurn[] {
    return history.map(msg => ({
      userMessage: msg.message,
      aiResponse: msg.response,
      intent: 'chat',
      timestamp: msg.timestamp,
    }));
  }

  private hasReference(message: string): boolean {
    const references = [
      '첫 번째', '두 번째', '세 번째', '마지막',
      '그거', '이것', '저것', '그 레시피', '이 레시피',
      '앞에', '위에', '방금', '아까'
    ];
    
    return references.some(ref => message.includes(ref));
  }

  private extractReference(message: string): string {
    const referencePatterns = [
      /(?:첫\s*번째|1번째|첫번째)/,
      /(?:두\s*번째|2번째|둘째)/,
      /(?:세\s*번째|3번째|셋째)/,
      /(?:마지막|끝)/,
      /(?:그거|그것|그\s*레시피)/,
      /(?:이것|이거|이\s*레시피)/,
      /(?:저것|저거|저\s*레시피)/,
    ];

    for (const pattern of referencePatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return '';
  }

  private extractOrder(reference: string): number | null {
    if (reference.includes('첫') || reference.includes('1')) return 0;
    if (reference.includes('두') || reference.includes('2')) return 1;
    if (reference.includes('세') || reference.includes('3')) return 2;
    if (reference.includes('마지막')) return -1; // 마지막은 특별 처리 필요
    
    return null;
  }

  private isDirectReference(reference: string): boolean {
    return ['그거', '그것', '그 레시피', '이것', '이거', '이 레시피', '저것', '저거'].some(
      ref => reference.includes(ref)
    );
  }

  // ================== 정리 ==================

  clearConversationState(sessionId: string): void {
    this.activeStates.delete(sessionId);
  }

  getActiveSessionsCount(): number {
    return this.activeStates.size;
  }

  // 일정 시간 후 자동 정리 (30분)
  private cleanupOldSessions(): void {
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;

    for (const [sessionId, state] of this.activeStates.entries()) {
      const lastActivity = state.contextHistory?.length > 0 
        ? state.contextHistory?.[state.contextHistory.length - 1]?.timestamp || 0
        : 0;

      if (now - lastActivity > thirtyMinutes) {
        this.activeStates.delete(sessionId);
        this.logger.log(`🧹 Cleaned up inactive session: ${sessionId}`);
      }
    }
  }

  // 정기적 정리 작업 (5분마다)
  startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupOldSessions();
    }, 5 * 60 * 1000);
  }
}