import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { 
  AllergenInfo, 
  AllergenCheckResult, 
  AllergenWarning, 
  UserAllergenProfile,
  AllergenStats
} from '../../shared/interfaces';
import { AllergySeverity, AllergenType } from '../../shared/types';

@Injectable()
export class AllergenService {
  private readonly logger = new Logger(AllergenService.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  /**
   * 특정 재료의 알레르기 정보 조회
   */
  async getIngredientAllergens(ingredientName: string): Promise<AllergenInfo | null> {
    try {
      const searchBody = {
        query: {
          bool: {
            should: [
              { match: { ingredient_name: { query: ingredientName, boost: 3 } } },
              { match: { "ingredient_name.keyword": { query: ingredientName, boost: 5 } } },
              { fuzzy: { ingredient_name: { value: ingredientName, fuzziness: "AUTO" } } }
            ],
            minimum_should_match: 1
          }
        },
        size: 1
      };

      const response = await this.elasticsearchService.search('allergens', searchBody);
      
      if (response.hits?.hits?.length > 0) {
        return response.hits.hits[0]._source;
      }

      return null;
    } catch (error) {
      this.logger.error(`재료 알레르기 조회 실패 [${ingredientName}]:`, error.message);
      return null;
    }
  }

  /**
   * 여러 재료의 알레르기 정보 일괄 조회
   */
  async getMultipleIngredientAllergens(ingredients: string[]): Promise<Map<string, AllergenInfo>> {
    const allergenMap = new Map<string, AllergenInfo>();

    try {
      // 배치 크기를 줄여서 안정성 향상
      const batchSize = 10;
      
      for (let i = 0; i < ingredients.length; i += batchSize) {
        const batch = ingredients.slice(i, i + batchSize);
        
        const searchBody = {
          query: {
            bool: {
              should: batch.map(ingredient => ({
                bool: {
                  should: [
                    { match: { ingredient_name: { query: ingredient, boost: 3 } } },
                    { match: { "ingredient_name.keyword": { query: ingredient, boost: 5 } } },
                    { fuzzy: { ingredient_name: { value: ingredient, fuzziness: "AUTO" } } }
                  ]
                }
              })),
              minimum_should_match: 1
            }
          },
          size: batch.length * 2 // 퍼지 매칭으로 인한 여분
        };

        const response = await this.elasticsearchService.search('allergens', searchBody);
        
        if (response.hits?.hits) {
          response.hits.hits.forEach(hit => {
            const allergenInfo = hit._source;
            // 입력 재료와 가장 유사한 매칭 찾기
            const matchedIngredient = this.findBestMatch(allergenInfo.ingredient_name, batch);
            if (matchedIngredient) {
              allergenMap.set(matchedIngredient, allergenInfo);
            }
          });
        }
      }

    } catch (error) {
      this.logger.error('다중 재료 알레르기 조회 실패:', error.message);
    }

    return allergenMap;
  }

  /**
   * 레시피의 알레르기 안전성 체크
   */
  async checkRecipeAllergens(
    ingredients: string[], 
    userProfile: UserAllergenProfile
  ): Promise<AllergenCheckResult> {
    try {
      this.logger.log(`🔍 알레르기 체크 시작: ${ingredients.length}개 재료`);

      // 재료명 정규화
      const normalizedIngredients = ingredients.map(ing => this.normalizeIngredientName(ing));
      
      // 알레르기 정보 조회
      const allergenMap = await this.getMultipleIngredientAllergens(normalizedIngredients);
      
      const warnings: AllergenWarning[] = [];
      const checkedIngredients: string[] = [];
      const unknownIngredients: string[] = [];

      // 각 재료별 알레르기 체크
      for (const ingredient of normalizedIngredients) {
        const allergenInfo = allergenMap.get(ingredient);
        
        if (allergenInfo) {
          checkedIngredients.push(ingredient);
          const ingredientWarnings = this.checkIngredientAllergens(
            ingredient, 
            allergenInfo, 
            userProfile
          );
          warnings.push(...ingredientWarnings);
        } else {
          unknownIngredients.push(ingredient);
          
          // 사용자 커스텀 위험 재료 체크
          if (userProfile.customIngredients?.includes(ingredient.toLowerCase())) {
            warnings.push({
              ingredient,
              allergens: ['custom'],
              severity: 'high',
              note: '사용자 지정 위험 재료'
            });
          }
        }
      }

      // 위험도 계산
      const riskLevel = this.calculateRiskLevel(warnings);
      const isSafe = warnings.length === 0;

      this.logger.log(`✅ 알레르기 체크 완료: ${isSafe ? '안전' : '위험'} (${warnings.length}개 경고)`);

      return {
        isSafe,
        warnings,
        riskLevel,
        checkedIngredients,
        unknownIngredients
      };

    } catch (error) {
      this.logger.error('레시피 알레르기 체크 실패:', error.message);
      
      // 에러 시 안전을 위해 위험으로 분류
      return {
        isSafe: false,
        warnings: [{
          ingredient: 'system_error',
          allergens: ['unknown'],
          severity: 'high',
          note: '알레르기 체크 중 오류가 발생했습니다. 안전을 위해 섭취를 피해주세요.'
        }],
        riskLevel: 'high',
        checkedIngredients: [],
        unknownIngredients: ingredients
      };
    }
  }

  /**
   * 특정 알레르기 유형을 가진 재료 검색
   */
  async searchAllergenicIngredients(allergenType: string, limit: number = 20): Promise<AllergenInfo[]> {
    try {
      const searchBody = {
        query: {
          range: {
            [`allergens.${allergenType}`]: {
              gt: 0
            }
          }
        },
        sort: [
          { [`allergens.${allergenType}`]: { order: 'desc' } },
          { allergen_count: { order: 'desc' } }
        ],
        size: limit
      };

      const response = await this.elasticsearchService.search('allergens', searchBody);
      
      if (response.hits?.hits) {
        return response.hits.hits.map(hit => hit._source);
      }

      return [];
    } catch (error) {
      this.logger.error(`알레르기 재료 검색 실패 [${allergenType}]:`, error.message);
      return [];
    }
  }

  /**
   * 알레르기 통계 정보 조회
   */
  async getAllergenStats(): Promise<any> {
    try {
      const searchBody = {
        size: 0,
        aggs: {
          allergen_distribution: {
            terms: {
              field: 'allergen_count',
              size: 20
            }
          },
          common_allergens: {
            terms: {
              field: 'allergen_types.keyword',
              size: 20
            }
          },
          gluten_stats: {
            stats: {
              field: 'allergens.gluten'
            }
          },
          milk_stats: {
            stats: {
              field: 'allergens.milk'
            }
          }
        }
      };

      const response = await this.elasticsearchService.search('allergens', searchBody);
      return response.aggregations;
    } catch (error) {
      this.logger.error('알레르기 통계 조회 실패:', error.message);
      return null;
    }
  }

  /**
   * 재료명 정규화
   */
  private normalizeIngredientName(ingredient: string): string {
    return ingredient
      .toLowerCase()
      .trim()
      .replace(/\([^)]*\)/g, '') // 괄호 제거
      .replace(/\d+\s*(g|kg|ml|l|컵|큰술|작은술|개|마리|장|포|병|캔|팩|슬라이스|조각|tbsp|tsp|cup|oz|lb)/gi, '') // 측정 단위 제거
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 가장 유사한 재료 매칭
   */
  private findBestMatch(foundIngredient: string, searchIngredients: string[]): string | null {
    const normalized = foundIngredient.toLowerCase();
    
    // 정확한 매치 우선
    for (const ingredient of searchIngredients) {
      if (ingredient.toLowerCase() === normalized) {
        return ingredient;
      }
    }

    // 부분 매치
    for (const ingredient of searchIngredients) {
      if (normalized.includes(ingredient.toLowerCase()) || 
          ingredient.toLowerCase().includes(normalized)) {
        return ingredient;
      }
    }

    return null;
  }

  /**
   * 특정 재료의 알레르기 체크
   */
  private checkIngredientAllergens(
    ingredient: string,
    allergenInfo: AllergenInfo,
    userProfile: UserAllergenProfile
  ): AllergenWarning[] {
    const warnings: AllergenWarning[] = [];

    for (const userAllergen of userProfile.allergies) {
      const allergenValue = allergenInfo.allergens[userAllergen];
      
      if (allergenValue && allergenValue > 0) {
        const severity = userProfile.severity[userAllergen] || 'medium';
        
        warnings.push({
          ingredient,
          allergens: [userAllergen],
          severity,
          note: allergenInfo.note || `${userAllergen} 알레르기 주의`
        });
      }
    }

    return warnings;
  }

  /**
   * 전체 위험도 계산
   */
  private calculateRiskLevel(warnings: AllergenWarning[]): 'low' | 'medium' | 'high' {
    if (warnings.length === 0) return 'low';

    const hasHigh = warnings.some(w => w.severity === 'high');
    const hasMedium = warnings.some(w => w.severity === 'medium');

    if (hasHigh) return 'high';
    if (hasMedium || warnings.length > 2) return 'medium';
    return 'low';
  }
}
