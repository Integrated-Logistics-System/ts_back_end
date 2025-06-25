import { Injectable, Logger } from '@nestjs/common';

// ================== 알레르기 관련 타입 정의 ==================
export interface AllergenData {
  ingredient_name: string;
  글루텐함유곡물?: number;
  갑각류?: number;
  난류?: number;
  어류?: number;
  땅콩?: number;
  대두?: number;
  우유?: number;
  견과류?: number;
  셀러리?: number;
  겨자?: number;
  참깨?: number;
  아황산류?: number;
  루핀?: number;
  연체동물?: number;
  복숭아?: number;
  토마토?: number;
  돼지고기?: number;
  쇠고기?: number;
  닭고기?: number;
  note?: string;
}

@Injectable()
export class ElasticsearchService {
  private readonly logger = new Logger(ElasticsearchService.name);
  private isConnected = false;

  constructor() {
    this.testConnection();
  }

  private async testConnection() {
    try {
      // Elasticsearch 연결 테스트
      const response = await fetch(`${process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'}/_cluster/health`);

      if (response.ok) {
        const health = await response.json();
        this.logger.log(`✅ Elasticsearch connected: ${health.status}`);
        this.isConnected = true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn('⚠️ Elasticsearch connection failed:', error.message);
      this.logger.warn('📝 Elasticsearch features will be disabled');
      this.isConnected = false;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  // ================== 레시피 검색 메서드 ==================

  async searchRecipes(query: string, options: { allergies?: string[], preferences?: string[] } = {}, limit: number = 10): Promise<any[]> {
    if (!this.isConnected) {
      this.logger.warn('Elasticsearch not available, returning empty results');
      return [];
    }

    try {
      // 알레르기와 선호도를 고려한 검색 쿼리 구성
      let searchBody: any = {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query,
                  fields: ['name^3', 'name_ko^3', 'description^2', 'ingredients^2']
                }
              }
            ],
            must_not: []
          }
        },
        size: Math.min(limit, 20)
      };

      // 알레르기 필터링
      if (options.allergies && options.allergies.length > 0) {
        options.allergies.forEach(allergy => {
          searchBody.query.bool.must_not.push({
            match: { ingredients: allergy }
          });
        });
      }

      // 선호도 부스팅
      if (options.preferences && options.preferences.length > 0) {
        searchBody.query.bool.should = options.preferences.map(pref => ({
          match: { tags: pref }
        }));
      }

      const response = await fetch(`${process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'}/recipes/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const recipes = data.hits?.hits?.map((hit: any) => hit._source) || [];
      const total = data.hits?.total?.value || 0;

      this.logger.log(`Found ${total} recipes for query: "${query}" with filters`);

      return recipes;

    } catch (error) {
      this.logger.error(`Recipe search failed for query: "${query}"`, error.message);
      return [];
    }
  }

  // ================== 알레르기 검색 메서드 ==================

  /**
   * 단일 재료의 알레르기 정보 검색
   */
  async searchAllergen(ingredientName: string): Promise<AllergenData | null> {
    if (!this.isConnected) {
      this.logger.warn('Elasticsearch not available for allergen search');
      return null;
    }

    try {
      const searchBody = {
        query: {
          bool: {
            should: [
              {
                term: {
                  "ingredient_name.keyword": ingredientName
                }
              },
              {
                match: {
                  ingredient_name: {
                    query: ingredientName,
                    fuzziness: "AUTO"
                  }
                }
              },
              {
                wildcard: {
                  ingredient_name: `*${ingredientName}*`
                }
              }
            ],
            minimum_should_match: 1
          }
        },
        size: 1
      };

      const response = await fetch(`${process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'}/allergens/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const hits = data.hits?.hits || [];

      if (hits.length > 0) {
        return hits[0]._source as AllergenData;
      }

      return null;

    } catch (error) {
      this.logger.error(`Allergen search failed for ingredient: "${ingredientName}"`, error.message);
      return null;
    }
  }

  /**
   * 여러 재료의 알레르기 정보를 한 번에 검색
   */
  async searchAllergensMultiple(ingredientNames: string[]): Promise<AllergenData[]> {
    if (!this.isConnected) {
      this.logger.warn('Elasticsearch not available for multiple allergen search');
      return [];
    }

    try {
      const searches = [];

      for (const ingredient of ingredientNames) {
        searches.push({ index: 'allergens' });
        searches.push({
          query: {
            bool: {
              should: [
                {
                  term: {
                    "ingredient_name.keyword": ingredient
                  }
                },
                {
                  match: {
                    ingredient_name: {
                      query: ingredient,
                      fuzziness: "AUTO"
                    }
                  }
                },
                {
                  wildcard: {
                    ingredient_name: `*${ingredient}*`
                  }
                }
              ],
              minimum_should_match: 1
            }
          },
          size: 1
        });
      }

      const response = await fetch(`${process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'}/_msearch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
        },
        body: searches.map(s => JSON.stringify(s)).join('\n') + '\n'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const results: AllergenData[] = [];

      if (data.responses) {
        data.responses.forEach((response: any, index: number) => {
          if (response.hits?.hits?.length > 0) {
            results.push(response.hits.hits[0]._source as AllergenData);
          }
        });
      }

      this.logger.log(`Found allergen data for ${results.length} out of ${ingredientNames.length} ingredients`);
      return results;

    } catch (error) {
      this.logger.error('Multiple allergen search failed:', error.message);
      return [];
    }
  }

  /**
   * 알레르기 통계 정보 조회
   */
  async getAllergenStats(): Promise<{
    totalIngredients: number;
    allergenicIngredients: number;
    allergenDistribution: Array<{ type: string; count: number }>;
  }> {
    if (!this.isConnected) {
      return {
        totalIngredients: 0,
        allergenicIngredients: 0,
        allergenDistribution: []
      };
    }

    try {
      // 전체 재료 수 조회
      const countResponse = await fetch(`${process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'}/allergens/_count`);
      const countData = await countResponse.json();
      const totalIngredients = countData.count || 0;

      // 알레르기 분포 조회
      const aggregationBody = {
        size: 0,
        aggs: {
          allergen_types: {
            terms: {
              script: {
                source: `
                  List allergens = [];
                  if (doc['글루텐함유곡물'].size() > 0 && doc['글루텐함유곡물'].value > 0) allergens.add('글루텐');
                  if (doc['갑각류'].size() > 0 && doc['갑각류'].value > 0) allergens.add('갑각류');
                  if (doc['난류'].size() > 0 && doc['난류'].value > 0) allergens.add('달걀');
                  if (doc['어류'].size() > 0 && doc['어류'].value > 0) allergens.add('생선');
                  if (doc['땅콩'].size() > 0 && doc['땅콩'].value > 0) allergens.add('땅콩');
                  if (doc['대두'].size() > 0 && doc['대두'].value > 0) allergens.add('대두');
                  if (doc['우유'].size() > 0 && doc['우유'].value > 0) allergens.add('유제품');
                  if (doc['견과류'].size() > 0 && doc['견과류'].value > 0) allergens.add('견과류');
                  return allergens;
                `,
                lang: 'painless'
              },
              size: 20
            }
          },
          allergenic_count: {
            filter: {
              bool: {
                should: [
                  { range: { "글루텐함유곡물": { gt: 0 } } },
                  { range: { "갑각류": { gt: 0 } } },
                  { range: { "난류": { gt: 0 } } },
                  { range: { "어류": { gt: 0 } } },
                  { range: { "땅콩": { gt: 0 } } },
                  { range: { "대두": { gt: 0 } } },
                  { range: { "우유": { gt: 0 } } },
                  { range: { "견과류": { gt: 0 } } }
                ],
                minimum_should_match: 1
              }
            }
          }
        }
      };

      const statsResponse = await fetch(`${process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'}/allergens/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aggregationBody)
      });

      if (!statsResponse.ok) {
        throw new Error(`HTTP ${statsResponse.status}`);
      }

      const statsData = await statsResponse.json();

      const allergenDistribution = statsData.aggregations?.allergen_types?.buckets?.map((bucket: any) => ({
        type: bucket.key,
        count: bucket.doc_count
      })) || [];

      const allergenicIngredients = statsData.aggregations?.allergenic_count?.doc_count || 0;

      this.logger.log(`Allergen stats: ${totalIngredients} total, ${allergenicIngredients} allergenic`);

      return {
        totalIngredients,
        allergenicIngredients,
        allergenDistribution
      };

    } catch (error) {
      this.logger.error('Failed to get allergen stats:', error.message);
      return {
        totalIngredients: 0,
        allergenicIngredients: 0,
        allergenDistribution: []
      };
    }
  }

  // ================== 기존 레시피 메서드들 ==================

  async getPopularRecipes(limit: number = 10): Promise<any> {
    if (!this.isConnected) {
      return {
        recipes: [],
        message: 'Search service temporarily unavailable'
      };
    }

    try {
      const response = await fetch(`${process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'}/recipes/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          size: Math.min(limit, 20),
          sort: [
            { '_score': { 'order': 'desc' } }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const recipes = data.hits?.hits?.map((hit: any) => hit._source) || [];

      this.logger.log(`Fetched ${recipes.length} popular recipes`);

      return {
        recipes,
        success: true
      };

    } catch (error) {
      this.logger.error('Popular recipes fetch failed:', error.message);
      return {
        recipes: [],
        success: false,
        error: 'Failed to fetch popular recipes'
      };
    }
  }

  async getRecipeById(id: string): Promise<any> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const response = await fetch(`${process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'}/recipes/_doc/${id}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data._source;

    } catch (error) {
      this.logger.error(`Recipe not found with ID: ${id}`, error.message);
      return null;
    }
  }

  async getRecipeStats(): Promise<any> {
    if (!this.isConnected) {
      return {
        totalRecipes: 0,
        message: 'Stats service temporarily unavailable'
      };
    }

    try {
      const response = await fetch(`${process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200'}/recipes/_count`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        totalRecipes: data.count || 0,
        success: true
      };

    } catch (error) {
      this.logger.error('Recipe stats failed:', error.message);
      return {
        totalRecipes: 0,
        success: false,
        error: 'Failed to get stats'
      };
    }
  }
}