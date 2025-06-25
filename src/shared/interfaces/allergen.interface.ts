// 알레르기 인터페이스 (사용 안함)
export interface AllergenInfo {
  ingredient_name: string;
  [key: string]: number | string;
}

export interface AllergenCheckResult {
  safe: boolean;
  warnings: string[];
  allergens: string[];
}
