import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService, AllergenData } from '../elasticsearch/elasticsearch.service';

export interface AllergenCheckResult {
  isAllergenic: boolean;
  allergenTypes: string[];
  severity: 'low' | 'medium' | 'high';
  details: {
    ingredient: string;
    allergens: Array<{
      type: string;
      value: number;
      koreanName: string;
    }>;
  };
}

export interface AllergenSummary {
  totalIngredients: number;
  allergenicIngredients: number;
  allergenTypes: string[];
  riskLevel: 'safe' | 'caution' | 'danger';
}

@Injectable()
export class AllergenService {
  private readonly logger = new Logger(AllergenService.name);

  // 알레르기 타입 매핑
  private readonly allergenMap = {
    '글루텐함유곡물': '글루텐',
    '갑각류': '갑각류',
    '난류': '달걀',
    '어류': '생선',
    '땅콩': '땅콩',
    '대두': '대두',
    '우유': '유제품',
    '견과류': '견과류',
    '셀러리': '셀러리',
    '겨자': '겨자',
    '참깨': '참깨',
    '아황산류': '아황산류',
    '루핀': '루핀',
    '연체동물': '연체동물',
    '복숭아': '복숭아',
    '토마토': '토마토',
    '돼지고기': '돼지고기',
    '쇠고기': '쇠고기',
    '닭고기': '닭고기'
  };

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  /**
   * 특정 재료의 알레르기 정보 조회
   */
  async checkIngredientAllergen(ingredientName: string): Promise<AllergenCheckResult | null> {
    try {
      const normalizedName = this.normalizeIngredientName(ingredientName);
      
      const allergenData = await this.elasticsearchService.searchAllergen(normalizedName);
      
      if (!allergenData) {
        // Try partial matching with original name
        const partialResult = await this.elasticsearchService.searchAllergen(ingredientName);
        if (!partialResult) {
          return null;
        }
        return this.processAllergenData(partialResult);
      }

      return this.processAllergenData(allergenData);
    } catch (error) {
      this.logger.error(`Error checking allergen for ${ingredientName}:`, error);
      return null;
    }
  }

  /**
   * 여러 재료들의 알레르기 정보 체크
   */
  async checkMultipleIngredients(ingredients: string[]): Promise<AllergenSummary> {
    try {
      const normalizedIngredients = ingredients.map(ing => this.normalizeIngredientName(ing));
      const allergenDataList = await this.elasticsearchService.searchAllergensMultiple(normalizedIngredients);
      
      const results: AllergenCheckResult[] = [];
      
      for (const allergenData of allergenDataList) {
        const result = this.processAllergenData(allergenData);
        if (result) {
          results.push(result);
        }
      }

      return this.summarizeAllergens(ingredients, results);
    } catch (error) {
      this.logger.error('Error checking multiple ingredients:', error);
      return {
        totalIngredients: ingredients.length,
        allergenicIngredients: 0,
        allergenTypes: [],
        riskLevel: 'safe'
      };
    }
  }

  /**
   * 사용자 알레르기와 레시피 재료 비교
   */
  async checkRecipeAgainstAllergies(
    recipeIngredients: string[], 
    userAllergies: string[]
  ): Promise<{
    isSafe: boolean;
    conflicts: Array<{
      ingredient: string;
      allergenType: string;
      severity: string;
    }>;
    warnings: string[];
  }> {
    try {
      const conflicts = [];
      const warnings = [];

        const allergenDataList = await this.elasticsearchService.searchAllergensMultiple(recipeIngredients);
      
      for (let i = 0; i < recipeIngredients.length; i++) {
        const ingredient = recipeIngredients[i];
        const allergenData = allergenDataList.find(data => 
          this.normalizeIngredientName(data.ingredient_name) === this.normalizeIngredientName(ingredient)
        );
        
        if (allergenData) {
          const allergenResult = this.processAllergenData(allergenData);
          
          if (allergenResult && allergenResult.isAllergenic) {
            const matchedAllergies = allergenResult.allergenTypes.filter(allergen =>
              userAllergies.some(userAllergy => 
                this.normalizeAllergenType(allergen) === this.normalizeAllergenType(userAllergy)
              )
            );

            if (matchedAllergies.length > 0) {
              conflicts.push({
                ingredient,
                allergenType: matchedAllergies.join(', '),
                severity: allergenResult.severity
              });
            }
          }
        }
      }

      // 경고 메시지 생성
      if (conflicts.length > 0) {
        warnings.push(`⚠️ 알레르기 주의: ${conflicts.map(c => c.ingredient).join(', ')}`);
        
        const highRiskItems = conflicts.filter(c => c.severity === 'high');
        if (highRiskItems.length > 0) {
          warnings.push(`🚨 고위험: ${highRiskItems.map(c => c.ingredient).join(', ')}`);
        }
      }

      return {
        isSafe: conflicts.length === 0,
        conflicts,
        warnings
      };
    } catch (error) {
      this.logger.error('Error checking recipe against allergies:', error);
      return {
        isSafe: false,
        conflicts: [],
        warnings: ['알레르기 검사 중 오류가 발생했습니다.']
      };
    }
  }

  /**
   * 알레르기 타입 목록 조회
   */
  getAllergenTypes(): Array<{ key: string; name: string; description: string }> {
    return [
      { key: 'gluten', name: '글루텐', description: '밀, 보리, 호밀 등의 곡물' },
      { key: 'crustacean', name: '갑각류', description: '새우, 게, 가재 등' },
      { key: 'egg', name: '달걀', description: '닭달걀 및 달걀 제품' },
      { key: 'fish', name: '생선', description: '각종 어류' },
      { key: 'peanut', name: '땅콩', description: '땅콩 및 땅콩 제품' },
      { key: 'soy', name: '대두', description: '콩 및 콩 제품' },
      { key: 'milk', name: '유제품', description: '우유 및 유제품' },
      { key: 'nuts', name: '견과류', description: '아몬드, 호두, 캐슈넛 등' },
      { key: 'celery', name: '셀러리', description: '셀러리 및 셀러리 제품' },
      { key: 'mustard', name: '겨자', description: '겨자 및 겨자 제품' },
      { key: 'sesame', name: '참깨', description: '참깨 및 참깨 제품' },
      { key: 'sulfite', name: '아황산류', description: '방부제로 사용되는 황 화합물' },
      { key: 'lupin', name: '루핀', description: '루핀콩 및 루핀 제품' },
      { key: 'mollusc', name: '연체동물', description: '조개, 굴, 오징어 등' },
      { key: 'peach', name: '복숭아', description: '복숭아 및 복숭아 제품' },
      { key: 'tomato', name: '토마토', description: '토마토 및 토마토 제품' },
      { key: 'pork', name: '돼지고기', description: '돼지고기 및 돼지고기 제품' },
      { key: 'beef', name: '쇠고기', description: '쇠고기 및 쇠고기 제품' },
      { key: 'chicken', name: '닭고기', description: '닭고기 및 닭고기 제품' }
    ];
  }

  /**
   * 알레르기 통계 조회
   */
  async getAllergenStats(): Promise<{
    totalIngredients: number;
    allergenicIngredients: number;
    allergenDistribution: Array<{ type: string; count: number }>;
  }> {
    try {
      return await this.elasticsearchService.getAllergenStats();
    } catch (error) {
      this.logger.error('Error getting allergen stats:', error);
      return {
        totalIngredients: 0,
        allergenicIngredients: 0,
        allergenDistribution: []
      };
    }
  }

  private processAllergenData(allergenData: AllergenData): AllergenCheckResult {
    const allergens = [];
    let maxValue = 0;

    // 모든 알레르기 필드 체크
    for (const [dbField, displayName] of Object.entries(this.allergenMap)) {
      const value = allergenData[dbField] || 0;
      if (value > 0) {
        allergens.push({
          type: displayName,
          value,
          koreanName: displayName
        });
        maxValue = Math.max(maxValue, value);
      }
    }

    // 심각도 계산
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (maxValue >= 0.8) severity = 'high';
    else if (maxValue >= 0.5) severity = 'medium';

    return {
      isAllergenic: allergens.length > 0,
      allergenTypes: allergens.map(a => a.type),
      severity,
      details: {
        ingredient: allergenData.ingredient_name,
        allergens
      }
    };
  }

  private summarizeAllergens(ingredients: string[], results: AllergenCheckResult[]): AllergenSummary {
    const allergenicCount = results.filter(r => r.isAllergenic).length;
    const allAllergenTypes = [...new Set(results.flatMap(r => r.allergenTypes))];
    
    // 위험도 계산
    let riskLevel: 'safe' | 'caution' | 'danger' = 'safe';
    const highRiskCount = results.filter(r => r.severity === 'high').length;
    const mediumRiskCount = results.filter(r => r.severity === 'medium').length;

    if (highRiskCount > 0) riskLevel = 'danger';
    else if (mediumRiskCount > 0 || allergenicCount > ingredients.length * 0.3) riskLevel = 'caution';

    return {
      totalIngredients: ingredients.length,
      allergenicIngredients: allergenicCount,
      allergenTypes: allAllergenTypes,
      riskLevel
    };
  }

  private normalizeIngredientName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w가-힣]/g, '')
      .replace(/\s+/g, '');
  }

  private normalizeAllergenType(allergen: string): string {
    const mapping = {
      '글루텐': ['글루텐', '밀가루', '밀'],
      '갑각류': ['갑각류', '새우', '게'],
      '달걀': ['달걀', '계란', '난류'],
      '생선': ['생선', '어류', '물고기'],
      '견과류': ['견과류', '너트', '아몬드', '호두'],
      '유제품': ['유제품', '우유', '치즈', '버터'],
      '대두': ['대두', '콩', '된장'],
      '땅콩': ['땅콩', '피넛']
    };

    for (const [standard, variants] of Object.entries(mapping)) {
      if (variants.some(variant => allergen.includes(variant))) {
        return standard;
      }
    }

    return allergen;
  }
}
