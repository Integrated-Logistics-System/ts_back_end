import { Injectable, Logger } from '@nestjs/common';
import {
  PersonalizedContext,
  ConversationAnalysisResult,
  UserIntent,
  ChatMessage,
  TimeContext,
} from '../interfaces/chat.interface';

// Enhanced Intent Types
export interface EnhancedUserIntent extends UserIntent {
  entities: ExtractedEntity[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
  multipleIntents?: UserIntent[];
  semanticSimilarity?: number;
}

export interface ExtractedEntity {
  type: 'recipe' | 'ingredient' | 'cooking_method' | 'time' | 'allergen' | 'cuisine_type';
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface IntentPattern {
  type: string;
  keywords: string[];
  patterns: RegExp[];
  semanticKeywords: string[];
  weight: number;
}

@Injectable()
export class EnhancedIntentAnalyzer {
  private readonly logger = new Logger(EnhancedIntentAnalyzer.name);

  // Enhanced Intent Patterns with semantic understanding
  private readonly intentPatterns: IntentPattern[] = [
    {
      type: 'recipe_search',
      keywords: ['찾아', '추천', '뭐가', '어떤', '만들까', '요리', '음식', '메뉴'],
      patterns: [
        /(?:뭐|어떤|무엇).*?(?:먹을까|요리|만들까|음식)/g,
        /(?:추천|찾아|검색).*?(?:레시피|요리|음식)/g,
        /(오늘|저녁|점심|아침).*?(?:뭐|무엇).*?(?:먹을까|요리)/g,
      ],
      semanticKeywords: ['suggest', 'recommend', 'find', 'search', 'what', 'which', 'food', 'recipe', 'dish'],
      weight: 1.0
    },
    {
      type: 'recipe_detail',
      keywords: ['만드는 법', '조리법', '요리법', '레시피', '어떻게', '방법', '과정', '단계'],
      patterns: [
        /(?:어떻게|방법).*?(?:만들|요리|조리)/g,
        /(?:만드는|조리하는|요리하는).*?(?:법|방법|과정)/g,
        /(?:레시피|요리법|조리법).*?(?:알려|가르쳐|보여)/g,
      ],
      semanticKeywords: ['how', 'method', 'recipe', 'cooking', 'instructions', 'steps', 'process'],
      weight: 1.2
    },
    {
      type: 'cooking_advice',
      keywords: ['팁', '조언', '도움', '비법', '노하우', '기술', '실수', '개선'],
      patterns: [
        /(?:팁|조언|도움).*?(?:요리|조리)/g,
        /(?:비법|노하우|기술).*?(?:알려|가르쳐)/g,
        /(?:실수|잘못|개선).*?(?:요리|조리)/g,
      ],
      semanticKeywords: ['tip', 'advice', 'help', 'technique', 'secret', 'improve', 'mistake'],
      weight: 0.9
    },
    {
      type: 'ingredient_substitute',
      keywords: ['대신', '대체', '없으면', '빼고', '제외', '못먹', '알레르기'],
      patterns: [
        /(?:대신|대체).*?(?:무엇|뭘|어떤)/g,
        /(?:없으면|빼고|제외).*?(?:뭘|무엇|어떤)/g,
        /(?:못먹|알레르기).*?(?:대신|대체)/g,
      ],
      semanticKeywords: ['substitute', 'replace', 'instead', 'without', 'alternative', 'allergy'],
      weight: 1.1
    },
    {
      type: 'nutritional_info',
      keywords: ['칼로리', '영양', '건강', '다이어트', '살빼기', '단백질', '탄수화물'],
      patterns: [
        /(?:칼로리|영양).*?(?:얼마|어떻게|몇)/g,
        /(?:다이어트|살빼기).*?(?:요리|음식)/g,
        /(?:건강한|영양가).*?(?:요리|음식|레시피)/g,
      ],
      semanticKeywords: ['calorie', 'nutrition', 'healthy', 'diet', 'protein', 'carbs', 'fat'],
      weight: 0.8
    }
  ];

  // Entity extraction patterns
  private readonly entityPatterns = {
    recipe: [
      /([가-힣]+(?:볶음|찜|국|탕|찌개|전|구이|조림|무침|샐러드|파스타|피자|케이크|빵))/g,
      /([가-힣]+(?:라면|우동|냉면|국수|비빔밥|덮밥|김밥|주먹밥))/g,
      /(김치[가-힣]*|된장[가-힣]*|고추장[가-힣]*)/g,
    ],
    ingredient: [
      /(닭|돼지|소|생선|새우|오징어|계란|두부|버섯|양파|마늘|당근|감자|고구마)/g,
      /(쌀|밀가루|면|국수|파스타|빵|치즈|우유|요거트)/g,
    ],
    cooking_method: [
      /(볶|끓|삶|찌|굽|튀기|조리|무치|비비|섞)/g,
    ],
    time: [
      /(\d+)(?:분|시간|초)/g,
      /(빠른|간단한|오래|천천히)/g,
    ],
    allergen: [
      /(글루텐|견과류|새우|게|우유|계란|콩|땅콩)/g,
    ],
    cuisine_type: [
      /(한식|중식|일식|양식|이탈리안|프렌치|인도|태국|베트남)/g,
    ]
  };

  // Sentiment analysis keywords
  private readonly sentimentKeywords = {
    positive: ['좋아', '맛있', '최고', '훌륭', '완벽', '사랑', '좋은', '대단한', '감사'],
    negative: ['싫어', '별로', '안좋아', '못먹', '실패', '망', '어려워', '복잡', '귀찮']
  };

  // Urgency indicators
  private readonly urgencyIndicators = {
    high: ['급해', '빨리', '지금', '당장', '오늘', '바로'],
    medium: ['곧', '이따가', '나중에', '내일'],
    low: ['언젠가', '시간날때', '여유있을때']
  };

  /**
   * Enhanced conversation context analysis
   */
  async analyzeEnhancedConversationContext(
    message: string,
    context: PersonalizedContext
  ): Promise<ConversationAnalysisResult> {
    try {
      const enhancedIntent = await this.analyzeEnhancedUserIntent(message, context);
      const isDetailRequest = this.detectDetailRequest(message, context);
      const targetRecipe = await this.findTargetRecipeWithNLP(message, context);
      
      const suggestedAction = this.determineSuggestedAction(
        isDetailRequest,
        enhancedIntent,
        targetRecipe || undefined
      );

      return {
        isDetailRequest,
        targetRecipe: targetRecipe || undefined,
        userIntent: enhancedIntent,
        context: this.enrichContext(context),
        suggestedAction,
      };
    } catch (error) {
      this.logger.error('Enhanced conversation analysis failed:', error);
      return this.getDefaultAnalysis(context);
    }
  }

  /**
   * Enhanced user intent analysis with semantic understanding
   */
  async analyzeEnhancedUserIntent(
    message: string,
    context: PersonalizedContext
  ): Promise<EnhancedUserIntent> {
    try {
      const normalizedMessage = message.toLowerCase().trim();
      
      // Extract entities
      const entities = this.extractEntities(message);
      
      // Analyze sentiment
      const sentiment = this.analyzeSentiment(message);
      
      // Analyze urgency
      const urgency = this.analyzeUrgency(message);
      
      // Find multiple intents
      const intentCandidates = this.findMultipleIntents(message);
      
      // Select primary intent
      const primaryIntent = intentCandidates[0] || this.getDefaultIntent();
      
      // Calculate semantic similarity with context
      const semanticSimilarity = await this.calculateSemanticSimilarity(message, context);
      
      return {
        ...primaryIntent,
        entities,
        sentiment,
        urgency,
        multipleIntents: intentCandidates.length > 1 ? intentCandidates.slice(1) : undefined,
        semanticSimilarity,
      };
    } catch (error) {
      this.logger.error('Enhanced user intent analysis failed:', error);
      return this.getDefaultEnhancedIntent();
    }
  }

  /**
   * Extract structured entities from message
   */
  private extractEntities(message: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    Object.entries(this.entityPatterns).forEach(([type, patterns]) => {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(message)) !== null) {
          entities.push({
            type: type as ExtractedEntity['type'],
            value: match[0],
            confidence: this.calculateEntityConfidence(match[0], type),
            startIndex: match.index,
            endIndex: match.index + match[0].length,
          });
        }
      });
    });

    return entities.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze sentiment of the message
   */
  private analyzeSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    const normalizedMessage = message.toLowerCase();
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    this.sentimentKeywords.positive.forEach(keyword => {
      if (normalizedMessage.includes(keyword)) positiveScore++;
    });
    
    this.sentimentKeywords.negative.forEach(keyword => {
      if (normalizedMessage.includes(keyword)) negativeScore++;
    });
    
    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  /**
   * Analyze urgency level
   */
  private analyzeUrgency(message: string): 'low' | 'medium' | 'high' {
    const normalizedMessage = message.toLowerCase();
    
    for (const [level, indicators] of Object.entries(this.urgencyIndicators)) {
      if (indicators.some(indicator => normalizedMessage.includes(indicator))) {
        return level as 'low' | 'medium' | 'high';
      }
    }
    
    // Check for question marks and exclamation marks
    if (message.includes('?') && message.includes('!')) return 'high';
    if (message.includes('!')) return 'medium';
    
    return 'low';
  }

  /**
   * Find multiple potential intents in the message
   */
  private findMultipleIntents(message: string): UserIntent[] {
    const intents: Array<UserIntent & { score: number }> = [];
    
    this.intentPatterns.forEach(pattern => {
      const score = this.calculateIntentScore(message, pattern);
      
      if (score > 0.3) {
        intents.push({
          type: pattern.type as UserIntent['type'],
          confidence: Math.min(score, 1.0),
          keywords: this.extractKeywordsForIntent(message, pattern),
          score,
        });
      }
    });
    
    return intents
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // Top 3 intents
      .map(intent => ({
        type: intent.type,
        confidence: intent.confidence,
        keywords: intent.keywords,
      }));
  }

  /**
   * Calculate intent score using multiple factors
   */
  private calculateIntentScore(message: string, pattern: IntentPattern): number {
    const normalizedMessage = message.toLowerCase();
    let score = 0;
    
    // Keyword matching score
    const keywordMatches = pattern.keywords.filter(keyword => 
      normalizedMessage.includes(keyword)
    ).length;
    const keywordScore = (keywordMatches / pattern.keywords.length) * 0.4;
    
    // Pattern matching score
    const patternMatches = pattern.patterns.filter(regex => 
      regex.test(normalizedMessage)
    ).length;
    const patternScore = (patternMatches / pattern.patterns.length) * 0.4;
    
    // Semantic keyword score
    const semanticMatches = pattern.semanticKeywords.filter(keyword => 
      normalizedMessage.includes(keyword)
    ).length;
    const semanticScore = (semanticMatches / pattern.semanticKeywords.length) * 0.2;
    
    score = (keywordScore + patternScore + semanticScore) * pattern.weight;
    
    return score;
  }

  /**
   * Calculate semantic similarity with conversation context
   */
  private async calculateSemanticSimilarity(
    message: string,
    context: PersonalizedContext
  ): Promise<number> {
    if (!context.conversationHistory?.length) return 0;
    
    const recentMessages = context.conversationHistory.slice(-5);
    const contextText = recentMessages.map(msg => msg.content).join(' ');
    
    // Simple semantic similarity using shared keywords
    // In a real implementation, you would use embeddings or transformer models
    const messageWords = this.tokenize(message);
    const contextWords = this.tokenize(contextText);
    
    const sharedWords = messageWords.filter(word => contextWords.includes(word));
    const totalWords = new Set([...messageWords, ...contextWords]).size;
    
    return totalWords > 0 ? sharedWords.length / totalWords : 0;
  }

  /**
   * Enhanced target recipe finding with NLP
   */
  private async findTargetRecipeWithNLP(
    message: string,
    context: PersonalizedContext
  ): Promise<string | null> {
    try {
      // Extract recipe entities first
      const recipeEntities = this.extractEntities(message)
        .filter(entity => entity.type === 'recipe')
        .sort((a, b) => b.confidence - a.confidence);
      
      if (recipeEntities.length > 0 && recipeEntities[0]) {
        return recipeEntities[0].value;
      }
      
      // Fallback to original method
      return this.findTargetRecipeOriginal(message, context);
    } catch (error) {
      this.logger.error('NLP target recipe search failed:', error);
      return null;
    }
  }

  /**
   * Calculate entity confidence based on context and patterns
   */
  private calculateEntityConfidence(value: string, type: string): number {
    let confidence = 0.6; // Base confidence
    
    // Longer entities tend to be more specific
    if (value.length > 3) confidence += 0.1;
    if (value.length > 6) confidence += 0.1;
    
    // Common patterns boost confidence
    if (type === 'recipe' && /[가-힣]+(?:볶음|찜|국|탕)/.test(value)) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Extract keywords specific to an intent pattern
   */
  private extractKeywordsForIntent(message: string, pattern: IntentPattern): string[] {
    const words = this.tokenize(message);
    const relevantKeywords: string[] = [];
    
    // Add matched pattern keywords
    pattern.keywords.forEach(keyword => {
      if (message.toLowerCase().includes(keyword)) {
        relevantKeywords.push(keyword);
      }
    });
    
    // Add matched semantic keywords
    pattern.semanticKeywords.forEach(keyword => {
      if (message.toLowerCase().includes(keyword)) {
        relevantKeywords.push(keyword);
      }
    });
    
    return [...new Set(relevantKeywords)];
  }

  /**
   * Simple tokenization
   */
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 1)
      .filter(word => !['은', '는', '이', '가', '을', '를', 'the', 'a', 'an'].includes(word));
  }

  // Legacy method compatibility
  private detectDetailRequest(message: string, context: PersonalizedContext): boolean {
    const detailKeywords = [
      '만드는 법', '조리법', '요리법', '레시피', '어떻게 만들어',
      '재료', '만들기', '조리 과정', '요리 방법', '단계별'
    ];
    
    const normalizedMessage = message.toLowerCase();
    return detailKeywords.some(keyword => normalizedMessage.includes(keyword));
  }

  private findTargetRecipeOriginal(message: string, context: PersonalizedContext): string | null {
    // Original implementation for fallback
    const recipePatterns = [
      /([가-힣]+(?:볶음|찜|국|탕|찌개|전|구이|조림|무침|샐러드|파스타|피자|케이크|빵))/g,
      /([가-힣]+(?:라면|우동|냉면|국수|비빔밥|덮밥|김밥|주먹밥))/g,
    ];
    
    for (const pattern of recipePatterns) {
      const match = message.match(pattern);
      if (match && match.length > 0) {
        return match[0];
      }
    }
    
    return null;
  }

  private determineSuggestedAction(
    isDetailRequest: boolean,
    intent: EnhancedUserIntent,
    targetRecipe?: string
  ): 'process_detail' | 'process_recipe' | 'general_chat' {
    if (isDetailRequest && targetRecipe) {
      return 'process_detail';
    }

    if (intent.type === 'recipe_search' || intent.confidence > 0.7) {
      return 'process_recipe';
    }

    return 'general_chat';
  }

  private enrichContext(context: PersonalizedContext): PersonalizedContext {
    return {
      ...context,
      currentSession: context.currentSession ? {
        ...context.currentSession,
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

  private getDefaultIntent(): UserIntent {
    return {
      type: 'general_chat',
      confidence: 0.5,
      keywords: [],
    };
  }

  private getDefaultEnhancedIntent(): EnhancedUserIntent {
    return {
      type: 'general_chat',
      confidence: 0.1,
      keywords: [],
      entities: [],
      sentiment: 'neutral',
      urgency: 'low',
    };
  }

  private getDefaultAnalysis(context: PersonalizedContext): ConversationAnalysisResult {
    return {
      isDetailRequest: false,
      userIntent: this.getDefaultIntent(),
      context,
      suggestedAction: 'general_chat',
    };
  }
}