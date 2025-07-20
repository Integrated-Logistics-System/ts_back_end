import { Injectable, Logger } from '@nestjs/common';
import { GraphState } from '../../types/workflow.types';
import { ValidationUtils } from '../../utils/validation.utils';

@Injectable()
export class AnalyzeNode {
  private readonly logger = new Logger(AnalyzeNode.name);

  constructor(private readonly validationUtils: ValidationUtils) {}

  async analyzeQuery(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`📝 Analyzing query: "${state.query}"`);

    const startTime = Date.now();
    
    // 쿼리 유형 분석
    const queryAnalysis = this.validationUtils.analyzeQueryType(state.query);
    
    // 기존 분석 로직
    const allergies = this.extractAllergies(state.query);
    const isRecipeQuery = this.isRecipeRelated(state.query);
    const searchKeywords = this.extractSearchKeywords(state.query);
    const searchFilters = this.extractSearchFilters(state.query);

    this.logger.log(`✅ Query analysis complete: type=${queryAnalysis.type}, isRecipe=${isRecipeQuery}, allergies=[${allergies.join(', ')}], keywords=[${searchKeywords.join(', ')}]`);

    return {
      userAllergies: allergies,
      searchKeywords,
      searchFilters,
      currentStep: 'analyze_complete',
      queryType: queryAnalysis.type,
      queryConfidence: queryAnalysis.confidence,
      isFollowUp: queryAnalysis.type === 'follow_up' || queryAnalysis.type === 'recipe_detail',
      metadata: {
        ...state.metadata,
        searchTime: Date.now() - startTime,
        originalQuery: state.query,
        processedKeywords: searchKeywords,
        queryType: queryAnalysis.type,
        queryConfidence: queryAnalysis.confidence,
      },
    };
  }

  private extractAllergies(query: string): string[] {
    const allergyKeywords = [
      { patterns: ['달걀', '계란', 'egg'], allergy: '달걀' },
      { patterns: ['우유', '유제품', 'milk'], allergy: '우유' },
      { patterns: ['땅콩', 'peanut'], allergy: '땅콩' },
      { patterns: ['대두', '콩', 'soy'], allergy: '대두' },
      { patterns: ['밀', '밀가루', 'wheat'], allergy: '밀' },
      { patterns: ['새우', '갑각류', 'shrimp'], allergy: '새우' },
      { patterns: ['생선', '어류', 'fish'], allergy: '생선' },
    ];

    const detected: string[] = [];
    const queryLower = query.toLowerCase();

    for (const { patterns, allergy } of allergyKeywords) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        if (queryLower.includes('알레르기') || queryLower.includes('못먹') || queryLower.includes('제외')) {
          detected.push(allergy);
        }
      }
    }

    return detected;
  }

  private isRecipeRelated(query: string): boolean {
    const recipeKeywords = [
      '레시피', '요리', '음식', '요리법', '만드는', '조리법',
      '추천', '알려줘', '가르쳐', '만들는', '요리하는',
      '닭가슴살', '돼지', '소고기', '생선', '달걀',
      '밥', '국', '찌개', '반찬', '볶음', '구이', '튀김',
      '스파게티', '파스타', '샐러드', '디저트', '케이크',
      '만들어', '요리해', '추천해', '알려줘', '가르쳐줘'
    ];

    const queryLower = query.toLowerCase();
    return recipeKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * 자연어 쿼리에서 검색 키워드 추출
   */
  private extractSearchKeywords(query: string): string[] {
    const keywords: string[] = [];
    const queryLower = query.toLowerCase();

    // 시간대 및 식사 키워드
    const mealTimeKeywords = {
      '아침': ['아침', '모닝', '브런치'],
      '점심': ['점심', '런치'],
      '저녁': ['저녁', '디너'],
      '간식': ['간식', '스낵']
    };

    // 시간대 검출
    for (const [mealType, patterns] of Object.entries(mealTimeKeywords)) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        keywords.push(mealType);
      }
    }

    // 요리 스타일 키워드
    const styleKeywords = {
      '간단': ['간단', '쉽', '빠른', '급해', '간편'],
      '한식': ['한식', '한국', '국물', '찌개', '밥'],
      '양식': ['양식', '파스타', '스테이크', '샐러드'],
      '중식': ['중식', '중국', '만두', '짜장'],
      '일식': ['일식', '일본', '스시', '우동'],
      '볶음': ['볶음', '볶아'],
      '찌개': ['찌개', '찌개류'],
      '국': ['국', '국물'],
      '샐러드': ['샐러드', '야채']
    };

    for (const [style, patterns] of Object.entries(styleKeywords)) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        keywords.push(style);
      }
    }

    // 단백질 소스 키워드
    const proteinKeywords = {
      '닭가슴살': ['닭가슴살', '닭고기', '치킨'],
      '돼지고기': ['돼지', '돼지고기', '삼겹살', '목살'],
      '소고기': ['소고기', '송아지', '불고기'],
      '생선': ['생선', '연어', '고등어', '전어'],
      '두부': ['두부', '콩'],
      '달걀': ['달걀', '계란']
    };

    for (const [protein, patterns] of Object.entries(proteinKeywords)) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        keywords.push(protein);
      }
    }

    // 요리법 키워드
    const methodKeywords = {
      '볶음': ['볶', '볶음', '삭음'],
      '찌개': ['찌개', '찌감', '끈음'],
      '구이': ['구이', '구워', '그릴'],
      '삶음': ['삶', '삶음', '수육'],
      '트김': ['트김', '트기기', '녹이기']
    };

    for (const [method, patterns] of Object.entries(methodKeywords)) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        keywords.push(method);
      }
    }

    // 기본 키워드가 없으면 일반적인 요리 키워드 추가
    if (keywords.length === 0) {
      if (queryLower.includes('레시피') || queryLower.includes('요리')) {
        keywords.push('요리');
      }
    }

    return keywords;
  }

  /**
   * 쿼리에서 검색 필터 추출
   */
  private extractSearchFilters(query: string): any {
    const queryLower = query.toLowerCase();
    const filters: any = {};

    // 난이도 추출
    if (queryLower.includes('간단') || queryLower.includes('쉽') || queryLower.includes('빠른')) {
      filters.difficulty = '초급';
    } else if (queryLower.includes('어려움') || queryLower.includes('복잡')) {
      filters.difficulty = '고급';
    }

    // 시간 추출 (예: "10분", "30분 이내")
    const timeMatch = queryLower.match(/(\d+)분/);
    if (timeMatch && timeMatch[1]) {
      filters.maxCookingTime = parseInt(timeMatch[1]);
    } else if (queryLower.includes('빠른') || queryLower.includes('간단')) {
      filters.maxCookingTime = 30; // 기본 30분 이내
    }

    // 인분수 추출
    const servingMatch = queryLower.match(/(\d+)인분/);
    if (servingMatch && servingMatch[1]) {
      filters.servings = parseInt(servingMatch[1]);
    }

    return filters;
  }
}