import { Injectable, Logger } from '@nestjs/common';
import { GraphState } from '../../types/workflow.types';

// Enhanced analysis interfaces
export interface EnhancedAnalysisResult {
  userAllergies: string[];
  searchKeywords: string[];
  searchFilters: SearchFilter[];
  queryIntent: QueryIntent;
  extractedEntities: QueryEntity[];
  semanticTags: string[];
  confidenceScore: number;
  queryComplexity: 'simple' | 'medium' | 'complex';
  suggestedRefinements?: string[];
}

export interface QueryIntent {
  primary: 'recipe_search' | 'recipe_detail' | 'ingredient_substitute' | 'cooking_advice' | 'nutritional_info';
  secondary?: string[];
  confidence: number;
}

export interface QueryEntity {
  type: 'ingredient' | 'dish' | 'cuisine_type' | 'cooking_method' | 'dietary_restriction' | 'nutrition';
  value: string;
  confidence: number;
  synonyms?: string[];
}

export interface SearchFilter {
  type: 'difficulty' | 'cooking_time' | 'servings' | 'cuisine_type' | 'dietary' | 'nutrition';
  value: string | number;
  operator?: 'eq' | 'lt' | 'gt' | 'range';
}

@Injectable()
export class EnhancedAnalyzeNode {
  private readonly logger = new Logger(EnhancedAnalyzeNode.name);

  // Enhanced keyword mappings with synonyms and variations
  private readonly enhancedKeywordMappings = {
    // Cooking methods with expanded variations
    cookingMethods: {
      '볶음': ['볶', '볶아', '볶은', '볶기', 'stir-fry', 'sauté'],
      '찜': ['찜', '찐', '찌기', 'steam', 'steamed'],
      '구이': ['구운', '굽', '굽기', 'grill', 'grilled', 'roast', 'roasted'],
      '튀김': ['튀긴', '튀겨', '튀기기', 'fried', 'deep-fried'],
      '조림': ['조린', '조리기', 'braised', 'simmered'],
      '삶음': ['삶은', '삶기', 'boiled'],
      '무침': ['무친', '무치기', 'seasoned', 'marinated'],
    },
    
    // Ingredients with nutritional categories
    ingredients: {
      '닭가슴살': ['닭가슴살', '닭', '치킨', 'chicken breast', 'chicken'],
      '돼지고기': ['돼지', '돼지고기', '삼겹살', 'pork', 'pork belly'],
      '소고기': ['소고기', '쇠고기', '스테이크', 'beef', 'steak'],
      '생선': ['생선', '물고기', '고등어', '연어', 'fish', 'salmon', 'mackerel'],
      '두부': ['두부', 'tofu'],
      '계란': ['계란', '달걀', '에그', 'egg', 'eggs'],
    },
    
    // Cuisine types with cultural variations
    cuisineTypes: {
      '한식': ['한식', '한국요리', '전통요리', 'korean', 'k-food'],
      '양식': ['양식', '서양요리', '이탈리안', '프렌치', 'western', 'italian', 'french'],
      '중식': ['중식', '중국요리', '차이니즈', 'chinese'],
      '일식': ['일식', '일본요리', '재패니즈', 'japanese'],
      '동남아': ['태국', '베트남', '인도', 'thai', 'vietnamese', 'indian'],
    },
    
    // Dietary restrictions and health considerations
    dietary: {
      '비건': ['비건', '채식', 'vegan', 'plant-based'],
      '글루텐프리': ['글루텐프리', '밀가루없는', 'gluten-free'],
      '저염': ['저염', '싱겁게', 'low-sodium'],
      '저칼로리': ['저칼로리', '다이어트', 'low-calorie', 'diet'],
      '고단백': ['고단백', '단백질', 'high-protein', 'protein-rich'],
    },
    
    // Time and difficulty indicators
    difficulty: {
      '간단': ['간단', '쉬운', '초보', 'easy', 'simple', 'beginner'],
      '보통': ['보통', '적당', 'medium', 'moderate'],
      '어려운': ['어려운', '복잡', '고급', 'hard', 'difficult', 'advanced'],
    },
    
    time: {
      '빠른': ['빠른', '급한', '10분', '15분', 'quick', 'fast'],
      '보통': ['30분', '1시간', 'medium'],
      '오래': ['2시간', '3시간', '천천히', 'slow', 'long'],
    }
  };

  // Expanded allergy detection with cross-contamination awareness
  private readonly allergyDatabase = [
    {
      name: '달걀',
      patterns: ['달걀', '계란', '에그', 'egg', 'eggs'],
      crossContamination: ['마요네즈', '케이크', '파스타', '빵'],
      alternatives: ['아쿠아파바', '아마씨겔', '바나나']
    },
    {
      name: '우유',
      patterns: ['우유', '유제품', '치즈', '버터', 'milk', 'dairy', 'cheese', 'butter'],
      crossContamination: ['빵', '케이크', '초콜릿', '크림'],
      alternatives: ['두유', '아몬드우유', '오트우유', '코코넛우유']
    },
    {
      name: '견과류',
      patterns: ['견과류', '땅콩', '아몬드', '호두', 'nuts', 'peanut', 'almond', 'walnut'],
      crossContamination: ['초콜릿', '과자', '빵', '시리얼'],
      alternatives: ['씨앗류', '해바라기씨']
    },
    {
      name: '글루텐',
      patterns: ['글루텐', '밀', '밀가루', '보리', '호밀', 'gluten', 'wheat', 'barley', 'rye'],
      crossContamination: ['빵', '파스타', '면', '과자', '맥주'],
      alternatives: ['쌀가루', '옥수수가루', '메밀가루', '아몬드가루']
    },
    {
      name: '갑각류',
      patterns: ['새우', '게', '갑각류', '랍스터', 'shrimp', 'crab', 'lobster', 'shellfish'],
      crossContamination: ['해산물', '젓갈', '국물'],
      alternatives: ['버섯', '두부', '식물성 단백질']
    },
    {
      name: '어류',
      patterns: ['생선', '어류', '참치', '연어', 'fish', 'tuna', 'salmon'],
      crossContamination: ['젓갈', '피시소스', '다시마'],
      alternatives: ['해조류', '버섯', '두부']
    },
    {
      name: '대두',
      patterns: ['콩', '대두', '간장', '된장', 'soy', 'soybean', 'tofu'],
      crossContamination: ['간장', '된장', '고추장', '두부'],
      alternatives: ['코코넛아미노', '타마리']
    }
  ];

  async analyzeQueryEnhanced(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`🔍 Enhanced analysis starting for: "${state.query}"`);
    
    const startTime = Date.now();
    
    try {
      // Enhanced analysis pipeline
      const analysisResult = await this.performEnhancedAnalysis(state.query, state.userAllergies || []);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.log(`✅ Enhanced analysis complete in ${processingTime}ms - Intent: ${analysisResult.queryIntent.primary} (confidence: ${analysisResult.confidenceScore})`);
      
      return {
        userAllergies: analysisResult.userAllergies,
        searchKeywords: analysisResult.searchKeywords,
        searchFilters: analysisResult.searchFilters,
        currentStep: 'enhanced_analyze_complete',
        metadata: {
          ...state.metadata,
          searchTime: processingTime,
          originalQuery: state.query,
          processedKeywords: analysisResult.searchKeywords,
          queryIntent: analysisResult.queryIntent,
          extractedEntities: analysisResult.extractedEntities,
          semanticTags: analysisResult.semanticTags,
          confidenceScore: analysisResult.confidenceScore,
          queryComplexity: analysisResult.queryComplexity,
          suggestedRefinements: analysisResult.suggestedRefinements,
        },
      };
    } catch (error) {
      this.logger.error('Enhanced analysis failed:', error);
      return this.getFallbackAnalysis(state);
    }
  }

  private async performEnhancedAnalysis(query: string, existingAllergies: string[]): Promise<EnhancedAnalysisResult> {
    const queryLower = query.toLowerCase().trim();
    
    // Step 1: Extract entities with confidence scoring
    const extractedEntities = this.extractEntitiesWithConfidence(query);
    
    // Step 2: Analyze query intent with multiple possibilities
    const queryIntent = this.analyzeQueryIntent(query, extractedEntities);
    
    // Step 3: Enhanced allergy extraction with cross-contamination awareness
    const userAllergies = this.extractAllergiesEnhanced(query, existingAllergies);
    
    // Step 4: Generate semantic search keywords
    const searchKeywords = this.generateSemanticKeywords(query, extractedEntities);
    
    // Step 5: Extract advanced search filters
    const searchFilters = this.extractAdvancedSearchFilters(query, extractedEntities);
    
    // Step 6: Generate semantic tags for better matching
    const semanticTags = this.generateSemanticTags(extractedEntities, queryIntent);
    
    // Step 7: Calculate overall confidence score
    const confidenceScore = this.calculateOverallConfidence(queryIntent, extractedEntities);
    
    // Step 8: Assess query complexity
    const queryComplexity = this.assessQueryComplexity(query, extractedEntities);
    
    // Step 9: Generate refinement suggestions
    const suggestedRefinements = this.generateRefinementSuggestions(query, queryIntent, extractedEntities);
    
    return {
      userAllergies,
      searchKeywords,
      searchFilters,
      queryIntent,
      extractedEntities,
      semanticTags,
      confidenceScore,
      queryComplexity,
      suggestedRefinements,
    };
  }

  private extractEntitiesWithConfidence(query: string): QueryEntity[] {
    const entities: QueryEntity[] = [];
    const queryLower = query.toLowerCase();
    
    // Extract cooking methods
    Object.entries(this.enhancedKeywordMappings.cookingMethods).forEach(([method, synonyms]) => {
      synonyms.forEach(synonym => {
        if (queryLower.includes(synonym.toLowerCase())) {
          entities.push({
            type: 'cooking_method',
            value: method,
            confidence: this.calculateEntityConfidence(synonym, queryLower),
            synonyms: synonyms.filter(s => s !== synonym),
          });
        }
      });
    });

    // Extract ingredients with nutritional awareness
    Object.entries(this.enhancedKeywordMappings.ingredients).forEach(([ingredient, synonyms]) => {
      synonyms.forEach(synonym => {
        if (queryLower.includes(synonym.toLowerCase())) {
          entities.push({
            type: 'ingredient',
            value: ingredient,
            confidence: this.calculateEntityConfidence(synonym, queryLower),
            synonyms: synonyms.filter(s => s !== synonym),
          });
        }
      });
    });

    // Extract cuisine types
    Object.entries(this.enhancedKeywordMappings.cuisineTypes).forEach(([cuisine, synonyms]) => {
      synonyms.forEach(synonym => {
        if (queryLower.includes(synonym.toLowerCase())) {
          entities.push({
            type: 'cuisine_type',
            value: cuisine,
            confidence: this.calculateEntityConfidence(synonym, queryLower),
            synonyms: synonyms.filter(s => s !== synonym),
          });
        }
      });
    });

    // Extract dietary restrictions
    Object.entries(this.enhancedKeywordMappings.dietary).forEach(([restriction, synonyms]) => {
      synonyms.forEach(synonym => {
        if (queryLower.includes(synonym.toLowerCase())) {
          entities.push({
            type: 'dietary_restriction',
            value: restriction,
            confidence: this.calculateEntityConfidence(synonym, queryLower),
            synonyms: synonyms.filter(s => s !== synonym),
          });
        }
      });
    });

    // Deduplicate and sort by confidence
    const uniqueEntities = entities.reduce((acc, entity) => {
      const existing = acc.find(e => e.type === entity.type && e.value === entity.value);
      if (!existing || existing.confidence < entity.confidence) {
        if (existing) {
          acc.splice(acc.indexOf(existing), 1);
        }
        acc.push(entity);
      }
      return acc;
    }, [] as QueryEntity[]);

    return uniqueEntities.sort((a, b) => b.confidence - a.confidence);
  }

  private analyzeQueryIntent(query: string, entities: QueryEntity[]): QueryIntent {
    const queryLower = query.toLowerCase();
    const intentScores = {
      recipe_search: 0,
      recipe_detail: 0,
      ingredient_substitute: 0,
      cooking_advice: 0,
      nutritional_info: 0,
    };

    // Recipe search intent patterns
    const searchPatterns = [
      /(?:추천|찾아|검색|뭐|어떤|무엇).*?(?:요리|음식|레시피|만들)/g,
      /(?:오늘|저녁|점심|아침).*?(?:뭐|무엇).*?(?:먹을까|요리)/g,
    ];
    
    searchPatterns.forEach(pattern => {
      if (pattern.test(queryLower)) intentScores.recipe_search += 0.3;
    });

    // Recipe detail intent patterns
    const detailPatterns = [
      /(?:어떻게|방법|과정|단계).*?(?:만들|요리|조리)/g,
      /(?:만드는|조리하는|요리하는).*?(?:법|방법|과정)/g,
    ];
    
    detailPatterns.forEach(pattern => {
      if (pattern.test(queryLower)) intentScores.recipe_detail += 0.4;
    });

    // Ingredient substitute intent
    if (/(?:대신|대체|없으면|빼고|제외)/.test(queryLower)) {
      intentScores.ingredient_substitute += 0.5;
    }

    // Cooking advice intent
    if (/(?:팁|조언|도움|비법|노하우)/.test(queryLower)) {
      intentScores.cooking_advice += 0.4;
    }

    // Nutritional info intent
    if (/(?:칼로리|영양|건강|다이어트|단백질|탄수화물)/.test(queryLower)) {
      intentScores.nutritional_info += 0.4;
    }

    // Boost scores based on entities
    entities.forEach(entity => {
      if (entity.type === 'dietary_restriction' || entity.type === 'nutrition') {
        intentScores.nutritional_info += 0.2;
      }
      if (entity.type === 'ingredient') {
        intentScores.recipe_search += 0.1;
      }
      if (entity.type === 'cooking_method') {
        intentScores.recipe_detail += 0.1;
      }
    });

    // Find primary intent
    const sortedIntents = Object.entries(intentScores)
      .sort(([,a], [,b]) => b - a)
      .filter(([,score]) => score > 0);

    const primaryIntent = sortedIntents[0] || ['recipe_search', 0.5];
    const secondaryIntents = sortedIntents.slice(1, 3).map(([intent]) => intent);

    return {
      primary: primaryIntent[0] as QueryIntent['primary'],
      secondary: secondaryIntents.length > 0 ? secondaryIntents : undefined,
      confidence: Math.min(primaryIntent[1], 1.0),
    };
  }

  private extractAllergiesEnhanced(query: string, existingAllergies: string[]): string[] {
    const detectedAllergies = new Set(existingAllergies);
    const queryLower = query.toLowerCase();
    
    // Check for explicit allergy mentions
    const allergyIndicators = ['알레르기', '못먹', '제외', '빼고', '없이', 'allergic', 'without', 'exclude'];
    const hasAllergyContext = allergyIndicators.some(indicator => queryLower.includes(indicator));
    
    if (hasAllergyContext) {
      this.allergyDatabase.forEach(allergy => {
        allergy.patterns.forEach(pattern => {
          if (queryLower.includes(pattern.toLowerCase())) {
            detectedAllergies.add(allergy.name);
            this.logger.log(`🚫 Detected allergy: ${allergy.name} from pattern: ${pattern}`);
          }
        });
      });
    }
    
    return Array.from(detectedAllergies);
  }

  private generateSemanticKeywords(query: string, entities: QueryEntity[]): string[] {
    const keywords = new Set<string>();
    
    // Add entity values as keywords
    entities.forEach(entity => {
      keywords.add(entity.value);
      entity.synonyms?.forEach(synonym => keywords.add(synonym));
    });
    
    // Add contextual keywords based on query patterns
    const queryLower = query.toLowerCase();
    
    // Time-based keywords
    if (/(?:아침|morning|breakfast)/.test(queryLower)) keywords.add('아침');
    if (/(?:점심|lunch)/.test(queryLower)) keywords.add('점심');
    if (/(?:저녁|dinner|evening)/.test(queryLower)) keywords.add('저녁');
    if (/(?:간식|snack)/.test(queryLower)) keywords.add('간식');
    
    // Health-related keywords
    if (/(?:건강|헬시|다이어트)/.test(queryLower)) keywords.add('건강한');
    if (/(?:간단|쉬운|빠른)/.test(queryLower)) keywords.add('간단한');
    
    return Array.from(keywords).slice(0, 15); // Limit to prevent over-matching
  }

  private extractAdvancedSearchFilters(query: string, entities: QueryEntity[]): SearchFilter[] {
    const filters: SearchFilter[] = [];
    const queryLower = query.toLowerCase();
    
    // Difficulty filters
    Object.entries(this.enhancedKeywordMappings.difficulty).forEach(([difficulty, patterns]) => {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        filters.push({
          type: 'difficulty',
          value: difficulty,
        });
      }
    });
    
    // Time filters
    const timeMatch = queryLower.match(/(\d+)(?:분|시간|minutes?|hours?)/);
    if (timeMatch) {
      const timeValue = parseInt(timeMatch[1] || '0');
      const unit = timeMatch[0].includes('시간') || timeMatch[0].includes('hour') ? 'hours' : 'minutes';
      
      filters.push({
        type: 'cooking_time',
        value: unit === 'hours' ? timeValue * 60 : timeValue,
        operator: 'lt',
      });
    }
    
    // Servings filters
    const servingsMatch = queryLower.match(/(\d+)(?:인분|명|people|persons?|servings?)/);
    if (servingsMatch) {
      filters.push({
        type: 'servings',
        value: parseInt(servingsMatch[1] || '0'),
      });
    }
    
    // Dietary filters from entities
    entities.forEach(entity => {
      if (entity.type === 'dietary_restriction') {
        filters.push({
          type: 'dietary',
          value: entity.value,
        });
      }
      if (entity.type === 'cuisine_type') {
        filters.push({
          type: 'cuisine_type',
          value: entity.value,
        });
      }
    });
    
    return filters;
  }

  private generateSemanticTags(entities: QueryEntity[], intent: QueryIntent): string[] {
    const tags = new Set<string>();
    
    // Add intent-based tags
    tags.add(`intent:${intent.primary}`);
    
    // Add entity-based tags
    entities.forEach(entity => {
      tags.add(`${entity.type}:${entity.value}`);
    });
    
    // Add combination tags for better matching
    const ingredients = entities.filter(e => e.type === 'ingredient');
    const methods = entities.filter(e => e.type === 'cooking_method');
    
    if (ingredients.length > 0 && methods.length > 0) {
      ingredients.forEach(ingredient => {
        methods.forEach(method => {
          tags.add(`combo:${ingredient.value}+${method.value}`);
        });
      });
    }
    
    return Array.from(tags);
  }

  private calculateEntityConfidence(synonym: string, query: string): number {
    let confidence = 0.6; // Base confidence
    
    // Exact match bonus
    if (query.includes(synonym)) confidence += 0.2;
    
    // Length bonus (longer terms are more specific)
    if (synonym.length > 3) confidence += 0.1;
    if (synonym.length > 6) confidence += 0.1;
    
    // Context bonus (if surrounded by related words)
    const contextWords = ['요리', '만들', '레시피', '음식'];
    if (contextWords.some(word => query.includes(word))) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  private calculateOverallConfidence(intent: QueryIntent, entities: QueryEntity[]): number {
    let confidence = intent.confidence * 0.5; // Intent confidence contributes 50%
    
    // Entity confidence contributes 30%
    const avgEntityConfidence = entities.length > 0 
      ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length 
      : 0.3;
    confidence += avgEntityConfidence * 0.3;
    
    // Query completeness contributes 20%
    const completenessScore = Math.min(entities.length / 3, 1.0); // Ideal: 3+ entities
    confidence += completenessScore * 0.2;
    
    return Math.min(confidence, 1.0);
  }

  private assessQueryComplexity(query: string, entities: QueryEntity[]): 'simple' | 'medium' | 'complex' {
    let complexityScore = 0;
    
    // Word count
    const wordCount = query.split(/\s+/).length;
    if (wordCount > 10) complexityScore += 2;
    else if (wordCount > 5) complexityScore += 1;
    
    // Entity count
    if (entities.length > 5) complexityScore += 2;
    else if (entities.length > 2) complexityScore += 1;
    
    // Multiple intents (complex queries often have multiple intentions)
    const queryLower = query.toLowerCase();
    const intentKeywords = ['그리고', '또는', '하지만', '그런데', 'and', 'or', 'but'];
    if (intentKeywords.some(keyword => queryLower.includes(keyword))) {
      complexityScore += 2;
    }
    
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'medium';
    return 'simple';
  }

  private generateRefinementSuggestions(
    query: string, 
    intent: QueryIntent, 
    entities: QueryEntity[]
  ): string[] {
    const suggestions: string[] = [];
    
    // Low confidence suggestions
    if (intent.confidence < 0.6) {
      suggestions.push('더 구체적인 요리 이름이나 재료를 명시해보세요');
    }
    
    // Missing ingredient suggestions
    const hasIngredients = entities.some(e => e.type === 'ingredient');
    if (!hasIngredients && intent.primary === 'recipe_search') {
      suggestions.push('어떤 재료를 사용하고 싶은지 알려주세요');
    }
    
    // Missing cooking method suggestions
    const hasCookingMethod = entities.some(e => e.type === 'cooking_method');
    if (!hasCookingMethod && intent.primary === 'recipe_detail') {
      suggestions.push('어떤 조리 방법을 원하는지 알려주세요 (예: 볶음, 찜, 구이)');
    }
    
    // Time constraint suggestions
    const hasTimeFilter = entities.some(e => e.type === 'cooking_method');
    if (!hasTimeFilter && intent.primary === 'recipe_search') {
      suggestions.push('조리 시간 제한이 있다면 알려주세요 (예: 30분 이내)');
    }
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  private getFallbackAnalysis(state: GraphState): Partial<GraphState> {
    this.logger.warn('Using fallback analysis due to error');
    
    return {
      userAllergies: state.userAllergies || [],
      searchKeywords: ['요리', '레시피'],
      searchFilters: [],
      currentStep: 'analyze_fallback',
      metadata: {
        ...state.metadata,
        searchTime: 0,
        originalQuery: state.query,
        processedKeywords: ['요리'],
        confidenceScore: 0.3,
        queryComplexity: 'simple',
        fallbackUsed: true,
      },
    };
  }
}