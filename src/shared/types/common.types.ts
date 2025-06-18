/**
 * 공통 타입 정의
 */

// 언어 타입
export type SupportedLanguage = 'ko' | 'en' | 'auto';

// 알레르기 심각도 타입
export type AllergySeverity = 'low' | 'medium' | 'high';

// 위험도 타입
export type RiskLevel = 'low' | 'medium' | 'high';

// 응답 상태 타입
export type ResponseStatus = 'success' | 'error' | 'warning';

// 서비스 상태 타입
export type ServiceStatus = 'healthy' | 'unhealthy' | 'degraded';

// 검색 타입
export type SearchType = 'text' | 'semantic' | 'hybrid';

// 정렬 방향
export type SortDirection = 'asc' | 'desc';

// 알레르기 타입 리스트
export type AllergenType = 
  | 'gluten' 
  | 'crustacean' 
  | 'egg' 
  | 'fish' 
  | 'peanut' 
  | 'soy' 
  | 'milk' 
  | 'nuts'
  | 'celery' 
  | 'mustard' 
  | 'sesame' 
  | 'sulfites' 
  | 'lupin' 
  | 'mollusks' 
  | 'peach'
  | 'tomato' 
  | 'pork' 
  | 'beef' 
  | 'chicken';

// 레시피 난이도
export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

// 요리 방법
export type CookingMethod = 
  | 'baking' 
  | 'frying' 
  | 'boiling' 
  | 'grilling' 
  | 'steaming' 
  | 'roasting' 
  | 'sautéing';

// 식사 유형
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert';

// 식단 제한
export type DietaryRestriction = 
  | 'vegetarian' 
  | 'vegan' 
  | 'gluten-free' 
  | 'dairy-free' 
  | 'nut-free' 
  | 'low-carb' 
  | 'keto';
