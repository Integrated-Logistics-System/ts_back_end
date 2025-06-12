import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly client: Client;

  constructor(private configService: ConfigService) {
    this.client = new Client({
      node: this.configService.get('ELASTICSEARCH_URL'),
    });
  }

  async indexRecipe(recipe: any): Promise<void> {
    try {
      await this.client.index({
        index: 'recipes',
        id: recipe.id.toString(),
        body: recipe,
      });
    } catch (error) {
      this.logger.error('레시피 인덱싱 실패:', error);
    }
  }

  async searchRecipes(searchDto: any): Promise<{ recipes: any[]; total: number }> {
    try {
      const query: any = {
        bool: {
          must: [],
          filter: [],
        },
      };

      // 텍스트 검색
      if (searchDto.query) {
        query.bool.must.push({
          multi_match: {
            query: searchDto.query,
            fields: ['name^3', 'description^2', 'ingredients', 'tags'],
            fuzziness: 'AUTO',
          },
        });
      }

      // 재료 검색
      if (searchDto.ingredients?.length > 0) {
        query.bool.must.push({
          terms: { ingredients: searchDto.ingredients },
        });
      }

      // 알레르기 제외
      if (searchDto.excludeAllergens?.length > 0) {
        query.bool.filter.push({
          bool: {
            must_not: {
              terms: { unsafeAllergens: searchDto.excludeAllergens },
            },
          },
        });
      }

      // 조리시간 필터
      if (searchDto.maxMinutes) {
        query.bool.filter.push({
          range: { minutes: { lte: searchDto.maxMinutes } },
        });
      }

      const response = await this.client.search({
        index: 'recipes',
        body: {
          query,
          size: searchDto.limit || 20,
          from: searchDto.offset || 0,
          sort: [{ _score: { order: 'desc' } }, { allergyScore: { order: 'desc' } }],
        },
      });

      return {
        recipes: response.hits.hits.map((hit: any) => ({
          id: hit._id,
          score: hit._score,
          ...hit._source,
        })),
        total: typeof response.hits.total === 'number' ? response.hits.total : response.hits.total.value,
      };
    } catch (error) {
      this.logger.error('레시피 검색 실패:', error);
      return { recipes: [], total: 0 };
    }
  }

  async findRecipesByIngredients(dto: any): Promise<any[]> {
    try {
      const response = await this.client.search({
        index: 'recipes',
        body: {
          query: {
            bool: {
              should: dto.ingredients.map((ingredient: string) => ({
                match: { ingredients: ingredient },
              })),
              minimum_should_match: 1,
              filter: dto.excludeAllergens?.length > 0 ? [
                {
                  bool: {
                    must_not: {
                      terms: { unsafeAllergens: dto.excludeAllergens },
                    },
                  },
                },
              ] : [],
            },
          },
          size: dto.limit || 20,
        },
      });

      return response.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      }));
    } catch (error) {
      this.logger.error('재료 기반 검색 실패:', error);
      return [];
    }
  }
}