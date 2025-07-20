import { Injectable, Logger } from '@nestjs/common';
import {
  PersonalizedContext,
  ConversationAnalysisResult,
  UserIntent,
  ChatMessage,
  TimeContext,
} from '../interfaces/chat.interface';

@Injectable()
export class ConversationAnalyzer {
  private readonly logger = new Logger(ConversationAnalyzer.name);

  // 상세 요청 키워드 패턴
  private readonly detailKeywords = [
    '만드는 법', '조리법', '요리법', '레시피', '어떻게 만들어',
    '재료', '만들기', '조리 과정', '요리 방법', '단계별',
    'how to make', 'recipe for', 'how to cook', 'ingredients for'
  ];

  // 일반적인 레시피 언급 패턴
  private readonly recipePatterns = [
    /([가-힣]+(?:볶음|찜|국|탕|찌개|전|구이|조림|무침|샐러드|파스타|피자|케이크|빵))/g,
    /([가-힣]+(?:라면|우동|냉면|국수|비빔밥|덮밥|김밥|주먹밥))/g,
    /(김치[가-힣]*|된장[가-힣]*|고추장[가-힣]*)/g,
    /([a-zA-Z]+(?:\s+[a-zA-Z]+)*(?:\s+(soup|stew|curry|pasta|salad|cake|bread|pizza)))/gi
  ];

  /**
   * 향상된 대화 컨텍스트 분석
   */
  async analyzeConversationContext(
    message: string,
    context: PersonalizedContext
  ): Promise<ConversationAnalysisResult> {
    try {
      const userIntent = this.analyzeUserIntent(message, context);
      const isDetailRequest = this.detectDetailRequest(message, context);
      const targetRecipe = await this.findTargetRecipe(message, context);
      
      const suggestedAction = this.determineSuggestedAction(
        isDetailRequest,
        userIntent,
        targetRecipe || undefined
      );

      return {
        isDetailRequest,
        targetRecipe: targetRecipe || undefined,
        userIntent,
        context: this.enrichContext(context),
        suggestedAction,
      };
    } catch (error) {
      this.logger.error('Conversation analysis failed:', error);
      return this.getDefaultAnalysis(context);
    }
  }

  /**
   * 상세 요청 감지
   */
  detectDetailRequest(message: string, context: PersonalizedContext): boolean {
    try {
      const normalizedMessage = message.toLowerCase().trim();
      
      // 직접적인 키워드 매칭
      const hasDetailKeyword = this.detailKeywords.some(keyword =>
        normalizedMessage.includes(keyword.toLowerCase())
      );

      if (hasDetailKeyword) {
        this.logger.debug('Detail request detected via keyword matching');
        return true;
      }

      // 컨텍스트 기반 감지
      if (this.hasRecentRecipeMention(context)) {
        const questionPatterns = [
          /어떻게/g, /방법/g, /과정/g, /단계/g,
          /how/gi, /way/gi, /method/gi, /steps/gi
        ];
        
        const hasQuestionPattern = questionPatterns.some(pattern =>
          pattern.test(normalizedMessage)
        );

        if (hasQuestionPattern) {
          this.logger.debug('Detail request detected via context + question pattern');
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Detail request detection failed:', error);
      return false;
    }
  }

  /**
   * 사용자 의도 분석
   */
  analyzeUserIntent(message: string, context: PersonalizedContext): UserIntent {
    try {
      const normalizedMessage = message.toLowerCase().trim();
      const keywords = this.extractKeywords(normalizedMessage);
      
      // 레시피 검색 의도 감지
      if (this.isRecipeSearchIntent(normalizedMessage, keywords)) {
        return {
          type: 'recipe_search',
          confidence: this.calculateConfidence(normalizedMessage, 'recipe_search'),
          keywords,
          specificRequest: this.extractSpecificRequest(message),
        };
      }

      // 상세 정보 요청 의도 감지
      if (this.isDetailRequestIntent(normalizedMessage, keywords)) {
        return {
          type: 'recipe_detail',
          confidence: this.calculateConfidence(normalizedMessage, 'recipe_detail'),
          keywords,
          targetRecipe: this.extractTargetRecipe(message),
        };
      }

      // 요리 조언 의도 감지
      if (this.isCookingAdviceIntent(normalizedMessage, keywords)) {
        return {
          type: 'cooking_advice',
          confidence: this.calculateConfidence(normalizedMessage, 'cooking_advice'),
          keywords,
          specificRequest: this.extractSpecificRequest(message),
        };
      }

      // 기본값: 일반 대화
      return {
        type: 'general_chat',
        confidence: 0.5,
        keywords,
      };
    } catch (error) {
      this.logger.error('User intent analysis failed:', error);
      return {
        type: 'general_chat',
        confidence: 0.1,
        keywords: [],
      };
    }
  }

  /**
   * 대상 레시피 찾기 (다중 전략)
   */
  async findTargetRecipe(message: string, context: PersonalizedContext): Promise<string | null> {
    try {
      // 전략 1: 메타데이터에서 레시피 검색
      const metadataRecipe = this.searchRecipeByMetadata(context);
      if (metadataRecipe) {
        this.logger.debug('Recipe found via metadata search');
        return metadataRecipe;
      }

      // 전략 2: 텍스트 패턴 매칭
      const patternRecipe = this.searchRecipeByTextPattern(message);
      if (patternRecipe) {
        this.logger.debug('Recipe found via text pattern matching');
        return patternRecipe;
      }

      // 전략 3: 메시지에서 레시피 추출
      const extractedRecipe = this.extractRecipeFromMessage(message);
      if (extractedRecipe) {
        this.logger.debug('Recipe found via message extraction');
        return extractedRecipe;
      }

      // 전략 4: 대화 기록에서 최근 레시피 찾기
      const historyRecipe = this.findRecipeInHistory(context);
      if (historyRecipe) {
        this.logger.debug('Recipe found via conversation history');
        return historyRecipe;
      }

      return null;
    } catch (error) {
      this.logger.error('Target recipe search failed:', error);
      return null;
    }
  }

  /**
   * 시간 컨텍스트 생성
   */
  createTimeContext(): TimeContext {
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth();
    const dayOfWeek = now.getDay();

    const timeOfDay = 
      hour < 6 ? 'night' :
      hour < 12 ? 'morning' :
      hour < 18 ? 'afternoon' : 'evening';

    const mealTime = 
      hour >= 6 && hour < 10 ? 'breakfast' :
      hour >= 11 && hour < 15 ? 'lunch' :
      hour >= 17 && hour < 21 ? 'dinner' :
      undefined;

    const season = 
      month >= 2 && month <= 4 ? 'spring' :
      month >= 5 && month <= 7 ? 'summer' :
      month >= 8 && month <= 10 ? 'fall' : 'winter';

    return {
      currentTime: now,
      timeOfDay,
      mealTime,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      season,
    };
  }

  // ==================== Private Helper Methods ====================

  private hasRecentRecipeMention(context: PersonalizedContext): boolean {
    if (!context.conversationHistory?.length) return false;

    const recentMessages = context.conversationHistory.slice(-5);
    return recentMessages.some(msg => 
      msg.metadata?.recipeId || 
      this.recipePatterns.some(pattern => pattern.test(msg.content))
    );
  }

  private searchRecipeByMetadata(context: PersonalizedContext): string | null {
    if (!context.conversationHistory?.length) return null;

    // 최근 메시지의 메타데이터에서 레시피 검색
    const recentMessages = context.conversationHistory.slice(-10);
    for (const msg of recentMessages.reverse()) {
      if (msg.metadata?.recipeId && msg.metadata?.recipeName) {
        return msg.metadata.recipeName;
      }
    }

    return null;
  }

  private searchRecipeByTextPattern(message: string): string | null {
    for (const pattern of this.recipePatterns) {
      const matches = message.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0].trim();
      }
    }
    return null;
  }

  private extractRecipeFromMessage(message: string): string | null {
    // 명시적 레시피 언급 패턴
    const explicitPatterns = [
      /(?:레시피|요리법|만드는 법)(?:\s+(?:for|of|는|의))?\s*([가-힣\w\s]+?)(?:\s+(?:알려|가르쳐|보여|찾아))/g,
      /([가-힣\w\s]+?)(?:\s+(?:만드는|요리하는|조리하는))\s*(?:법|방법)/g,
    ];

    for (const pattern of explicitPatterns) {
      const match = pattern.exec(message);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private findRecipeInHistory(context: PersonalizedContext): string | null {
    if (!context.conversationHistory?.length) return null;

    // 최근 10개 메시지에서 레시피 관련 내용 검색
    const recentMessages = context.conversationHistory.slice(-10);
    
    for (const msg of recentMessages.reverse()) {
      if (msg.role === 'assistant' && msg.metadata?.recipeName) {
        return msg.metadata.recipeName;
      }
      
      const extractedRecipe = this.searchRecipeByTextPattern(msg.content);
      if (extractedRecipe) {
        return extractedRecipe;
      }
    }

    return null;
  }

  private isRecipeSearchIntent(message: string, keywords: string[]): boolean {
    const searchIndicators = ['찾아', '추천', '뭐가', '어떤', 'suggest', 'recommend', 'find'];
    return searchIndicators.some(indicator => message.includes(indicator)) ||
           keywords.some(keyword => ['recipe', 'food', '요리', '음식'].includes(keyword));
  }

  private isDetailRequestIntent(message: string, keywords: string[]): boolean {
    return this.detailKeywords.some(keyword => message.includes(keyword)) ||
           keywords.some(keyword => ['how', 'method', '방법', '과정'].includes(keyword));
  }

  private isCookingAdviceIntent(message: string, keywords: string[]): boolean {
    const adviceIndicators = ['팁', '조언', '도움', 'tip', 'advice', 'help'];
    return adviceIndicators.some(indicator => message.includes(indicator)) ||
           keywords.some(keyword => ['cooking', 'technique', '기술', '노하우'].includes(keyword));
  }

  private extractKeywords(message: string): string[] {
    // 간단한 키워드 추출 (실제로는 더 정교한 NLP 처리 필요)
    const words = message.toLowerCase().split(/\s+/);
    const stopWords = ['은', '는', '이', '가', '을', '를', '에', '의', 'the', 'a', 'an', 'and', 'or'];
    
    return words
      .filter(word => word.length > 1 && !stopWords.includes(word))
      .slice(0, 10); // 최대 10개 키워드
  }

  private calculateConfidence(message: string, intentType: string): number {
    // 의도별 신뢰도 계산 로직
    const baseConfidence = 0.6;
    let confidence = baseConfidence;

    switch (intentType) {
      case 'recipe_search':
        if (message.includes('추천') || message.includes('recommend')) confidence += 0.2;
        if (message.includes('찾아') || message.includes('find')) confidence += 0.1;
        break;
      case 'recipe_detail':
        if (this.detailKeywords.some(k => message.includes(k))) confidence += 0.3;
        if (message.includes('?')) confidence += 0.1;
        break;
      case 'cooking_advice':
        if (message.includes('팁') || message.includes('tip')) confidence += 0.2;
        if (message.includes('조언') || message.includes('advice')) confidence += 0.2;
        break;
    }

    return Math.min(1.0, confidence);
  }

  private extractSpecificRequest(message: string): string {
    // 구체적인 요청 내용 추출
    return message.length > 100 ? message.substring(0, 100) + '...' : message;
  }

  private extractTargetRecipe(message: string): string | undefined {
    return this.searchRecipeByTextPattern(message) || undefined;
  }

  private determineSuggestedAction(
    isDetailRequest: boolean,
    userIntent: UserIntent,
    targetRecipe?: string
  ): 'process_detail' | 'process_recipe' | 'general_chat' {
    if (isDetailRequest && targetRecipe) {
      return 'process_detail';
    }

    if (userIntent.type === 'recipe_search' || userIntent.confidence > 0.7) {
      return 'process_recipe';
    }

    return 'general_chat';
  }

  private enrichContext(context: PersonalizedContext): PersonalizedContext {
    return {
      ...context,
      currentSession: context.currentSession ? {
        ...context.currentSession,
        sessionId: context.currentSession.sessionId || context.userId,
        lastActivity: new Date(),
      } : {
        sessionId: context.userId,
        startTime: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        recipeRequests: 0,
      },
    };
  }

  private getDefaultAnalysis(context: PersonalizedContext): ConversationAnalysisResult {
    return {
      isDetailRequest: false,
      userIntent: {
        type: 'general_chat',
        confidence: 0.5,
        keywords: [],
      },
      context,
      suggestedAction: 'general_chat',
    };
  }
}