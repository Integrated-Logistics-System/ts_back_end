export interface RawRecipe {
  name: string;
  id: number;
  minutes: number;
  contributor_id: number;
  submitted: string;
  tags: string; // Python list string
  nutrition: string; // Python list string
  n_steps: number;
  steps: string; // Python list string
  description: string;
  ingredients: string; // Python list string
  n_ingredients: number;
}

export interface ProcessedRecipe {
  id: number;
  name: string;
  name_keyword: string;
  description: string;
  ingredients_raw: string;
  ingredients_array: string[];
  ingredients_text: string;
  steps_array: string[];
  steps_text: string;
  tags: string[];
  minutes: number;
  n_ingredients: number;
  n_steps: number;
  nutrition: number[];
  submitted: string;
  contributor_id: number;
  // 알레르기 정보
  allergens: string[];
  allergen_score: number;
  safe_for_allergies: string[];
  match_rate: number;
  created_at: Date;
  updated_at: Date;
}

export interface AllergenIngredient {
  ingredient_name: string;
  글루텐함유곡물: number;
  갑각류: number;
  난류: number;
  어류: number;
  땅콩: number;
  대두: number;
  우유: number;
  견과류: number;
  셀러리: number;
  겨자: number;
  참깨: number;
  아황산류: number;
  루핀: number;
  연체동물: number;
  복숭아: number;
  토마토: number;
  돼지고기: number;
  쇠고기: number;
  닭고기: number;
  note?: string;
}

export interface ProcessedIngredient {
  name: string;
  name_keyword: string;
  allergens: string[];
  allergen_flags: Record<string, boolean>;
  note: string;
  created_at: Date;
  updated_at: Date;
}

export interface AllergenInfo {
  allergens: string[];
  score: number;
  safeFor: string[];
  matchedIngredients: string[];
  matchRate: number;
}
