import { Injectable } from '@nestjs/common';

@Injectable()
export class ValidationUtils {

  /**
   * 쿼리에서 알레르기 정보 추출
   */
  extractAllergies(query: string): string[] {
    const allergyKeywords = [
      { patterns: ['달걀', '계란', 'egg'], allergy: '달걀' },
      { patterns: ['우유', '유제품', 'milk'], allergy: '우유' },
      { patterns: ['땅콩', 'peanut'], allergy: '땅콩' },
      { patterns: ['대두', '콩', 'soy'], allergy: '대두' },
      { patterns: ['밀', '밀가루', 'wheat'], allergy: '밀' },
      { patterns: ['새우', '갑각류', 'shrimp'], allergy: '새우' },
      { patterns: ['생선', '어류', 'fish'], allergy: '생선' },
      { patterns: ['견과류', 'nuts'], allergy: '견과류' },
      { patterns: ['조개류', 'shellfish'], allergy: '조개류' },
      { patterns: ['참깨', 'sesame'], allergy: '참깨' },
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

  /**
   * 쿼리가 레시피 관련인지 확인
   */
  isRecipeRelated(query: string): boolean {
    const recipeKeywords = [
      // 기본 요리 키워드
      '레시피', '요리', '음식', '요리법', '만드는', '조리법',
      '추천', '알려줘', '가르쳐', '만들는', '요리하는',
      
      // 재료 키워드
      '닭가슴살', '돼지', '소고기', '생선', '달걀', '두부', '버섯',
      '양파', '마늘', '생강', '파', '고추', '당근', '감자',
      
      // 요리 종류
      '밥', '국', '찌개', '반찬', '볶음', '구이', '튀김',
      '스파게티', '파스타', '샐러드', '디저트', '케이크',
      '빵', '쿠키', '스프', '카레', '짜장', '짬뽕',
      
      // 동작 키워드
      '만들어', '요리해', '추천해', '알려줘', '가르쳐줘',
      '어떻게', '방법', '레시피', '만드는법', '조리법',
      
      // 음식 카테고리
      '한식', '중식', '양식', '일식', '아시안', '이탈리안',
      '멕시칸', '인도', '태국', '베트남', '프랑스',
      
      // 식사 시간
      '아침', '점심', '저녁', '야식', '간식', '디저트',
      '브런치', '런치', '디너'
    ];

    const queryLower = query.toLowerCase();
    return recipeKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * 쿼리에서 요리 시간 추출
   */
  extractCookingTime(query: string): number | null {
    const timePatterns = [
      /(\d+)\s*분/g,
      /(\d+)\s*minute/gi,
      /(\d+)\s*min/gi,
      /(\d+)\s*시간/g,
      /(\d+)\s*hour/gi,
      /(\d+)\s*hr/gi,
    ];

    for (const pattern of timePatterns) {
      const match = pattern.exec(query);
      if (match && match[1]) {
        const time = parseInt(match[1], 10);
        // 시간 단위인 경우 분으로 변환
        if (query.includes('시간') || query.includes('hour') || query.includes('hr')) {
          return time * 60;
        }
        return time;
      }
    }

    return null;
  }

  /**
   * 쿼리에서 인분 수 추출
   */
  extractServings(query: string): number | null {
    const servingPatterns = [
      /(\d+)\s*인분/g,
      /(\d+)\s*인용/g,
      /(\d+)\s*명/g,
      /(\d+)\s*serving/gi,
      /(\d+)\s*portion/gi,
    ];

    for (const pattern of servingPatterns) {
      const match = pattern.exec(query);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  }

  /**
   * 쿼리에서 난이도 추출
   */
  extractDifficulty(query: string): string | null {
    const difficultyMap = [
      { patterns: ['쉬운', '간단한', '초보', 'easy', 'simple'], difficulty: '쉬움' },
      { patterns: ['보통', '중간', 'medium', 'moderate'], difficulty: '보통' },
      { patterns: ['어려운', '복잡한', '고급', 'hard', 'difficult', 'advanced'], difficulty: '어려움' },
    ];

    const queryLower = query.toLowerCase();

    for (const { patterns, difficulty } of difficultyMap) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        return difficulty;
      }
    }

    return null;
  }

  /**
   * 쿼리에서 요리 종류 추출
   */
  extractCuisineType(query: string): string[] {
    const cuisineMap = [
      { patterns: ['한식', '한국', 'korean'], cuisine: '한식' },
      { patterns: ['중식', '중국', 'chinese'], cuisine: '중식' },
      { patterns: ['양식', '서양', 'western'], cuisine: '양식' },
      { patterns: ['일식', '일본', 'japanese'], cuisine: '일식' },
      { patterns: ['이탈리안', '이태리', 'italian'], cuisine: '이탈리안' },
      { patterns: ['프렌치', '프랑스', 'french'], cuisine: '프렌치' },
      { patterns: ['멕시칸', '멕시코', 'mexican'], cuisine: '멕시칸' },
      { patterns: ['인도', 'indian'], cuisine: '인도' },
      { patterns: ['태국', 'thai'], cuisine: '태국' },
      { patterns: ['베트남', 'vietnamese'], cuisine: '베트남' },
    ];

    const queryLower = query.toLowerCase();
    const cuisines: string[] = [];

    for (const { patterns, cuisine } of cuisineMap) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        cuisines.push(cuisine);
      }
    }

    return cuisines;
  }

  /**
   * 쿼리에서 요리 방법 추출
   */
  extractCookingMethod(query: string): string[] {
    const methodMap = [
      { patterns: ['볶음', '볶은', '볶기'], method: '볶음' },
      { patterns: ['구이', '구운', '굽기'], method: '구이' },
      { patterns: ['튀김', '튀긴', '튀기기'], method: '튀김' },
      { patterns: ['찜', '찐', '찌기'], method: '찜' },
      { patterns: ['삶은', '삶기', '끓인'], method: '삶기' },
      { patterns: ['무침', '무친'], method: '무침' },
      { patterns: ['조림', '조린'], method: '조림' },
      { patterns: ['국', '탕', '찌개'], method: '국물' },
    ];

    const queryLower = query.toLowerCase();
    const methods: string[] = [];

    for (const { patterns, method } of methodMap) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        methods.push(method);
      }
    }

    return methods;
  }

  /**
   * 텍스트 입력 검증
   */
  validateTextInput(text: string, options: {
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
    allowSpecialChars?: boolean;
  } = {}): { isValid: boolean; error?: string } {
    const {
      minLength = 0,
      maxLength = 1000,
      allowEmpty = false,
      allowSpecialChars = true
    } = options;

    if (!text && !allowEmpty) {
      return { isValid: false, error: '텍스트가 비어있습니다.' };
    }

    if (text.length < minLength) {
      return { isValid: false, error: `텍스트가 너무 짧습니다. 최소 ${minLength}자 이상이어야 합니다.` };
    }

    if (text.length > maxLength) {
      return { isValid: false, error: `텍스트가 너무 깁니다. 최대 ${maxLength}자 이하여야 합니다.` };
    }

    if (!allowSpecialChars) {
      const specialChars = /[<>\"'&]/;
      if (specialChars.test(text)) {
        return { isValid: false, error: '특수 문자는 사용할 수 없습니다.' };
      }
    }

    return { isValid: true };
  }

  /**
   * 숫자 입력 검증
   */
  validateNumberInput(value: any, options: {
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}): { isValid: boolean; error?: string } {
    const { min, max, integer = false } = options;

    const num = Number(value);
    if (isNaN(num)) {
      return { isValid: false, error: '유효한 숫자가 아닙니다.' };
    }

    if (integer && !Number.isInteger(num)) {
      return { isValid: false, error: '정수여야 합니다.' };
    }

    if (min !== undefined && num < min) {
      return { isValid: false, error: `${min} 이상이어야 합니다.` };
    }

    if (max !== undefined && num > max) {
      return { isValid: false, error: `${max} 이하여야 합니다.` };
    }

    return { isValid: true };
  }

  /**
   * 배열 입력 검증
   */
  validateArrayInput(value: any, options: {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any) => boolean;
  } = {}): { isValid: boolean; error?: string } {
    const { minLength = 0, maxLength = 100, itemValidator } = options;

    if (!Array.isArray(value)) {
      return { isValid: false, error: '배열이 아닙니다.' };
    }

    if (value.length < minLength) {
      return { isValid: false, error: `배열 길이가 너무 짧습니다. 최소 ${minLength}개 이상이어야 합니다.` };
    }

    if (value.length > maxLength) {
      return { isValid: false, error: `배열 길이가 너무 깁니다. 최대 ${maxLength}개 이하여야 합니다.` };
    }

    if (itemValidator) {
      for (let i = 0; i < value.length; i++) {
        if (!itemValidator(value[i])) {
          return { isValid: false, error: `배열의 ${i + 1}번째 항목이 유효하지 않습니다.` };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * 이메일 형식 검증
   */
  validateEmail(email: string): { isValid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false, error: '유효한 이메일 형식이 아닙니다.' };
    }

    return { isValid: true };
  }

  /**
   * JSON 형식 검증
   */
  validateJSON(jsonString: string): { isValid: boolean; error?: string; data?: any } {
    try {
      const data = JSON.parse(jsonString);
      return { isValid: true, data };
    } catch (error) {
      return { 
        isValid: false, 
        error: `유효한 JSON 형식이 아닙니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * 후속 질문인지 확인
   */
  isFollowUpQuestion(query: string): boolean {
    const followUpKeywords = [
      '팁', '비법', '포인트', '주의사항', '더', '자세히', 
      '추가', '다른', '또', '그리고', '어떻게', '왜',
      '방법', '노하우', '비결', '요령', '코츠',
      'tip', 'tips', 'more', 'detail', 'how', 'why', 'additional',
      'secret', 'trick', 'technique', 'method'
    ];
    
    const queryLower = query.toLowerCase();
    return followUpKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * 레시피 세부 정보 요청인지 확인
   */
  isRecipeDetailRequest(query: string): boolean {
    const detailKeywords = [
      '팁', '비법', '주의사항', '포인트', '더 자세히', 
      '추가 정보', '더 알고 싶', '어떻게 하', '왜',
      '만드는 방법', '조리 팁', '요리 팁', '노하우',
      'tip', 'tips', 'secret', 'detail', 'more info', 'how to', 'why',
      'cooking tip', 'cooking secret', 'technique', 'method'
    ];
    
    const queryLower = query.toLowerCase();
    return detailKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * 기존 레시피에 대한 추가 질문인지 확인
   */
  isRecipeFollowUpQuestion(query: string): boolean {
    const followUpPatterns = [
      // 직접적인 질문
      /이\s*(요리|레시피|음식).*팁/,
      /이\s*(요리|레시피|음식).*비법/,
      /이\s*(요리|레시피|음식).*방법/,
      /이\s*(요리|레시피|음식).*주의/,
      
      // 간접적인 질문
      /팁.*있/,
      /비법.*있/,
      /주의.*있/,
      /포인트.*있/,
      /노하우.*있/,
      
      // 영어 패턴
      /tip.*for.*this/i,
      /secret.*for.*this/i,
      /how.*to.*better/i,
      /any.*advice/i,
    ];
    
    return followUpPatterns.some(pattern => pattern.test(query));
  }

  /**
   * 쿼리 유형 분석
   */
  analyzeQueryType(query: string): {
    type: 'new_recipe' | 'follow_up' | 'recipe_detail' | 'general';
    confidence: number;
    keywords: string[];
  } {
    const queryLower = query.toLowerCase();
    
    // 후속 질문 확인
    if (this.isFollowUpQuestion(query) || this.isRecipeFollowUpQuestion(query)) {
      return {
        type: 'follow_up',
        confidence: 0.9,
        keywords: ['팁', '비법', '방법', '주의사항']
      };
    }
    
    // 레시피 세부 정보 요청 확인
    if (this.isRecipeDetailRequest(query)) {
      return {
        type: 'recipe_detail',
        confidence: 0.8,
        keywords: ['자세히', '더', '추가 정보']
      };
    }
    
    // 새로운 레시피 요청 확인
    if (this.isRecipeRelated(query)) {
      return {
        type: 'new_recipe',
        confidence: 0.7,
        keywords: ['레시피', '요리', '만들기']
      };
    }
    
    // 일반적인 질문
    return {
      type: 'general',
      confidence: 0.5,
      keywords: []
    };
  }

  /**
   * 사용자 입력 위험 요소 검사
   */
  checkSecurityThreats(input: string): { isSafe: boolean; threats: string[] } {
    const threats: string[] = [];
    const inputLower = input.toLowerCase();

    // SQL Injection 패턴
    const sqlPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+set/i,
      /exec\s*\(/i,
      /script\s*>/i,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(inputLower)) {
        threats.push('SQL Injection');
        break;
      }
    }

    // XSS 패턴
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /eval\s*\(/i,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(inputLower)) {
        threats.push('XSS');
        break;
      }
    }

    // 과도한 특수 문자
    const specialCharCount = (input.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
    if (specialCharCount > input.length * 0.3) {
      threats.push('Excessive Special Characters');
    }

    return {
      isSafe: threats.length === 0,
      threats
    };
  }
}