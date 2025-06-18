/**
 * 알레르기 관련 인터페이스 정의
 */

export interface AllergenInfo {
  ingredient_name: string;
  allergens: {
    gluten: number;
    crustacean: number;
    egg: number;
    fish: number;
    peanut: number;
    soy: number;
    milk: number;
    nuts: number;
    celery: number;
    mustard: number;
    sesame: number;
    sulfites: number;
    lupin: number;
    mollusks: number;
    peach: number;
    tomato: number;
    pork: number;
    beef: number;
    chicken: number;
  };
  allergen_count: number;
  allergen_types: string[];
  note?: string;
}

export interface AllergenCheckResult {
  isSafe: boolean;
  warnings: AllergenWarning[];
  riskLevel: 'low' | 'medium' | 'high';
  checkedIngredients: string[];
  unknownIngredients: string[];
}

export interface AllergenWarning {
  ingredient: string;
  allergens: string[];
  severity: 'low' | 'medium' | 'high';
  note?: string;
}

export interface UserAllergenProfile {
  userId?: string;
  allergies: string[];
  severity: {
    [allergen: string]: 'low' | 'medium' | 'high';
  };
  customIngredients?: string[]; // 사용자가 직접 추가한 위험 재료
}

export interface AllergenSearchCriteria {
  allergenType: string;
  limit?: number;
}

export interface AllergenValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface AllergenStats {
  allergen_distribution: any;
  common_allergens: any;
  gluten_stats: any;
  milk_stats: any;
}
