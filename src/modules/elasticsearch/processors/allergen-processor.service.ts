import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchRecipe, AllergenInfo } from '../types/elasticsearch.types';

@Injectable()
export class AllergenProcessor {
  private readonly logger = new Logger(AllergenProcessor.name);

  // 알레르기 유발 가능 재료 데이터베이스
  private readonly allergenDatabase = new Map<string, string[]>([
    // 견과류
    ['아몬드', ['견과류']],
    ['호두', ['견과류']],
    ['땅콩', ['견과류', '콩류']],
    ['캐슈넛', ['견과류']],
    ['피스타치오', ['견과류']],
    ['마카다미아', ['견과류']],
    ['피칸', ['견과류']],
    ['브라질너트', ['견과류']],
    ['잣', ['견과류']],
    
    // 유제품
    ['우유', ['유제품']],
    ['치즈', ['유제품']],
    ['버터', ['유제품']],
    ['요구르트', ['유제품']],
    ['크림', ['유제품']],
    ['생크림', ['유제품']],
    ['연유', ['유제품']],
    ['분유', ['유제품']],
    
    // 해산물
    ['새우', ['갑각류', '해산물']],
    ['게', ['갑각류', '해산물']],
    ['랍스터', ['갑각류', '해산물']],
    ['조개', ['연체동물', '해산물']],
    ['굴', ['연체동물', '해산물']],
    ['전복', ['연체동물', '해산물']],
    ['오징어', ['연체동물', '해산물']],
    ['문어', ['연체동물', '해산물']],
    
    // 생선류
    ['고등어', ['어류', '해산물']],
    ['연어', ['어류', '해산물']],
    ['참치', ['어류', '해산물']],
    ['명태', ['어류', '해산물']],
    ['조기', ['어류', '해산물']],
    ['멸치', ['어류', '해산물']],
    ['꽁치', ['어류', '해산물']],
    
    // 계란
    ['계란', ['계란']],
    ['달걀', ['계란']],
    ['메추리알', ['계란']],
    ['오리알', ['계란']],
    
    // 콩류
    ['대두', ['콩류']],
    ['콩', ['콩류']],
    ['두부', ['콩류']],
    ['된장', ['콩류']],
    ['간장', ['콩류']],
    ['고추장', ['콩류']],
    ['청국장', ['콩류']],
    ['낫토', ['콩류']],
    
    // 밀
    ['밀가루', ['밀']],
    ['빵', ['밀']],
    ['파스타', ['밀']],
    ['라면', ['밀']],
    ['우동', ['밀']],
    ['만두피', ['밀']],
    ['빵가루', ['밀']],
    
    // 참깨
    ['참깨', ['참깨']],
    ['깨', ['참깨']],
    ['참기름', ['참깨']],
    ['깨소금', ['참깨']],
    
    // 기타 알레르기 유발 요소
    ['딸기', ['딸기']],
    ['복숭아', ['복숭아']],
    ['키위', ['키위']],
    ['토마토', ['토마토']],
    ['셀러리', ['셀러리']],
    ['겨자', ['겨자']],
    ['아황산류', ['아황산류']],
  ]);

  /**
   * 레시피의 알레르기 정보 생성
   */
  generateAllergenInfo(recipe: ElasticsearchRecipe): AllergenInfo {
    try {
      const ingredients = [
        ...recipe.ingredients,
        ...recipe.ingredientsKo,
        ...recipe.ingredientsEn,
      ];

      const allergenDetails = this.analyzeIngredients(ingredients);
      const containsAllergens = this.extractUniqueAllergens(allergenDetails);
      const highRiskIngredients = this.getHighRiskIngredients(allergenDetails);
      const allergenRiskScore = this.calculateRiskScore(allergenDetails);
      const safeFor = this.determineSafeFor(containsAllergens);

      return {
        allergen_risk_score: allergenRiskScore,
        contains_allergens: containsAllergens,
        high_risk_ingredients: highRiskIngredients,
        safe_for: safeFor,
        total_allergen_count: containsAllergens.length,
        ingredient_details: allergenDetails,
      };

    } catch (error) {
      this.logger.error('Failed to generate allergen info:', error);
      return this.getDefaultAllergenInfo();
    }
  }

  /**
   * 사용자 알레르기에 따른 안전한 레시피 필터링
   */
  filterSafeRecipes(
    recipes: ElasticsearchRecipe[],
    userAllergies: string[]
  ): ElasticsearchRecipe[] {
    if (!userAllergies.length) return recipes;

    return recipes.filter(recipe => {
      const allergenInfo = recipe.allergenInfo || this.generateAllergenInfo(recipe);
      return this.isRecipeSafeForUser(allergenInfo, userAllergies);
    });
  }

  /**
   * 레시피가 사용자에게 안전한지 확인
   */
  isRecipeSafeForUser(allergenInfo: AllergenInfo, userAllergies: string[]): boolean {
    const normalizedUserAllergies = userAllergies.map(allergy => 
      this.normalizeAllergenName(allergy)
    );

    const recipeAllergens = allergenInfo.contains_allergens.map(allergen =>
      this.normalizeAllergenName(allergen)
    );

    // 사용자 알레르기와 레시피 알레르기가 겹치는지 확인
    return !normalizedUserAllergies.some(userAllergy =>
      recipeAllergens.includes(userAllergy)
    );
  }

  /**
   * 레시피의 안전도 점수 계산
   */
  calculateSafetyScore(
    recipe: ElasticsearchRecipe,
    userAllergies: string[] = []
  ): number {
    const allergenInfo = recipe.allergenInfo || this.generateAllergenInfo(recipe);
    
    // 기본 점수 (100점 만점)
    let score = 100;

    // 일반적인 알레르기 위험도에 따른 점수 차감
    score -= allergenInfo.allergen_risk_score;

    // 사용자 특정 알레르기가 있는 경우 대폭 차감
    if (userAllergies.length > 0 && !this.isRecipeSafeForUser(allergenInfo, userAllergies)) {
      score -= 50;
    }

    // 고위험 재료 개수에 따른 추가 차감
    score -= allergenInfo.high_risk_ingredients.length * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 대체 재료 제안
   */
  suggestAllergenFreeAlternatives(
    ingredients: string[],
    userAllergies: string[]
  ): Array<{ original: string; alternatives: string[] }> {
    const suggestions: Array<{ original: string; alternatives: string[] }> = [];

    for (const ingredient of ingredients) {
      const allergens = this.getAllergensInIngredient(ingredient);
      const hasUserAllergy = allergens.some(allergen =>
        userAllergies.some(userAllergy =>
          this.normalizeAllergenName(allergen) === this.normalizeAllergenName(userAllergy)
        )
      );

      if (hasUserAllergy) {
        const alternatives = this.getAlternativeIngredients(ingredient, allergens);
        if (alternatives.length > 0) {
          suggestions.push({
            original: ingredient,
            alternatives,
          });
        }
      }
    }

    return suggestions;
  }

  // ==================== Private Helper Methods ====================

  private analyzeIngredients(ingredients: string[]): Array<{
    name: string;
    allergens: string[];
    risk_level: string;
  }> {
    return ingredients.map(ingredient => {
      const allergens = this.getAllergensInIngredient(ingredient);
      const riskLevel = this.determineRiskLevel(allergens);

      return {
        name: ingredient,
        allergens,
        risk_level: riskLevel,
      };
    });
  }

  private getAllergensInIngredient(ingredient: string): string[] {
    const normalizedIngredient = ingredient.toLowerCase().trim();
    const allergens: string[] = [];

    // 정확한 매칭
    if (this.allergenDatabase.has(normalizedIngredient)) {
      allergens.push(...this.allergenDatabase.get(normalizedIngredient)!);
    }

    // 부분 매칭
    for (const [knownIngredient, knownAllergens] of this.allergenDatabase.entries()) {
      if (normalizedIngredient.includes(knownIngredient) || 
          knownIngredient.includes(normalizedIngredient)) {
        allergens.push(...knownAllergens);
      }
    }

    return [...new Set(allergens)]; // 중복 제거
  }

  private extractUniqueAllergens(
    ingredientDetails: Array<{ allergens: string[] }>
  ): string[] {
    const allAllergens = ingredientDetails.flatMap(detail => detail.allergens);
    return [...new Set(allAllergens)];
  }

  private getHighRiskIngredients(
    ingredientDetails: Array<{ name: string; risk_level: string }>
  ): string[] {
    return ingredientDetails
      .filter(detail => detail.risk_level === 'high')
      .map(detail => detail.name);
  }

  private calculateRiskScore(
    ingredientDetails: Array<{ allergens: string[]; risk_level: string }>
  ): number {
    let score = 0;

    for (const detail of ingredientDetails) {
      // 알레르기 개수에 따른 점수
      score += detail.allergens.length * 2;

      // 위험도에 따른 추가 점수
      switch (detail.risk_level) {
        case 'high':
          score += 10;
          break;
        case 'medium':
          score += 5;
          break;
        case 'low':
          score += 1;
          break;
      }
    }

    return Math.min(100, score); // 최대 100점
  }

  private determineRiskLevel(allergens: string[]): string {
    if (allergens.length === 0) return 'low';
    
    const highRiskAllergens = ['견과류', '갑각류', '계란', '유제품'];
    const hasHighRiskAllergen = allergens.some(allergen =>
      highRiskAllergens.includes(allergen)
    );

    if (hasHighRiskAllergen) return 'high';
    if (allergens.length >= 2) return 'medium';
    return 'low';
  }

  private determineSafeFor(containsAllergens: string[]): string[] {
    const allKnownAllergens = [
      '견과류', '유제품', '갑각류', '연체동물', '어류', '해산물',
      '계란', '콩류', '밀', '참깨', '딸기', '복숭아', '키위',
      '토마토', '셀러리', '겨자', '아황산류'
    ];

    return allKnownAllergens.filter(allergen =>
      !containsAllergens.includes(allergen)
    );
  }

  private normalizeAllergenName(allergen: string): string {
    return allergen.toLowerCase().trim()
      .replace(/[^a-z가-힣0-9]/g, ''); // 특수문자 제거
  }

  private getAlternativeIngredients(ingredient: string, allergens: string[]): string[] {
    // 알레르기 유형별 대체 재료 제안
    const alternatives: string[] = [];

    for (const allergen of allergens) {
      switch (allergen) {
        case '유제품':
          alternatives.push('아몬드 우유', '두유', '오트 밀크', '코코넛 밀크');
          break;
        case '계란':
          alternatives.push('아쿠아파바', '바나나', '아마씨겔', '치아시드');
          break;
        case '밀':
          alternatives.push('쌀가루', '아몬드가루', '코코넛가루', '귀리가루');
          break;
        case '견과류':
          alternatives.push('해바라기씨', '호박씨', '수박씨');
          break;
        case '콩류':
          alternatives.push('코코넛 아미노', '타마리 소스');
          break;
      }
    }

    return [...new Set(alternatives)];
  }

  private getDefaultAllergenInfo(): AllergenInfo {
    return {
      allergen_risk_score: 0,
      contains_allergens: [],
      high_risk_ingredients: [],
      safe_for: [],
      total_allergen_count: 0,
      ingredient_details: [],
    };
  }
}