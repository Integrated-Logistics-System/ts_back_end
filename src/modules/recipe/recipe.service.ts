import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Recipe, RecipeDocument } from './schemas/recipe.schema';
import { CreateRecipeDto, SearchRecipeDto, RecipeByIngredientsDto } from './dto/recipe.dto';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RecipeService {
  constructor(
    @InjectModel(Recipe.name) private recipeModel: Model<RecipeDocument>,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly redisService: RedisService,
  ) {}

  async create(createRecipeDto: CreateRecipeDto): Promise<Recipe> {
    const createdRecipe = new this.recipeModel(createRecipeDto);
    const savedRecipe = await createdRecipe.save();
    
    // Elasticsearch에 인덱싱
    await this.elasticsearchService.indexRecipe(savedRecipe);
    
    return savedRecipe;
  }

  async findById(id: number): Promise<Recipe> {
    // 캐시 확인
    const cacheKey = `recipe:${id}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const recipe = await this.recipeModel.findOne({ id }).exec();
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }

    // 조회수 증가
    await this.recipeModel.updateOne({ id }, { $inc: { viewCount: 1 } });

    // 캐시 저장 (1시간)
    await this.redisService.setex(cacheKey, 3600, JSON.stringify(recipe));

    return recipe;
  }

  async search(searchDto: SearchRecipeDto): Promise<{ recipes: Recipe[]; total: number }> {
    const cacheKey = `search:${JSON.stringify(searchDto)}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // MongoDB 쿼리 빌드
    let query: any = {};
    
    // 기본 검색
    if (searchDto.query) {
      query.$text = { $search: searchDto.query };
    }
    
    // 재료 검색
    if (searchDto.ingredients && searchDto.ingredients.length > 0) {
      query.ingredients = { $in: searchDto.ingredients };
    }
    
    // 태그 필터
    if (searchDto.tags && searchDto.tags.length > 0) {
      query.tags = { $in: searchDto.tags };
    }
    
    // 시간 필터
    if (searchDto.maxMinutes) {
      query.minutes = { $lte: searchDto.maxMinutes };
    }
    
    // 난이도 필터
    if (searchDto.difficulty) {
      query.difficulty = searchDto.difficulty;
    }
    
    // 알레르기 제외
    if (searchDto.excludeAllergens && searchDto.excludeAllergens.length > 0) {
      query.unsafeAllergens = { $nin: searchDto.excludeAllergens };
    }

    let aggregationPipeline: any[] = [
      { $match: query }
    ];

    // Nutrition 필터링 (virtual 필드 사용)
    if (searchDto.maxCalories || searchDto.minCalories || searchDto.maxFat || 
        searchDto.maxSodium || searchDto.calorieLevel || searchDto.dietFriendly || 
        searchDto.minHealthScore) {
      
      aggregationPipeline.push({
        $addFields: {
          nutritionParsed: {
            $cond: {
              if: { $ne: ["$nutrition", null] },
              then: {
                $let: {
                  vars: {
                    nutritionArray: {
                      $map: {
                        input: { $split: [{ $trim: { input: { $replaceAll: { input: { $replaceAll: { input: "$nutrition", find: "[", replacement: "" } }, find: "]", replacement: "" } } } }, ","] },
                        as: "item",
                        in: { $toDouble: "$$item" }
                      }
                    }
                  },
                  in: {
                    calories: { $arrayElemAt: ["$$nutritionArray", 0] },
                    fat: { $arrayElemAt: ["$$nutritionArray", 1] },
                    saturatedFat: { $arrayElemAt: ["$$nutritionArray", 2] },
                    cholesterol: { $arrayElemAt: ["$$nutritionArray", 3] },
                    sodium: { $arrayElemAt: ["$$nutritionArray", 4] },
                    carbohydrates: { $arrayElemAt: ["$$nutritionArray", 5] },
                    fiber: { $arrayElemAt: ["$$nutritionArray", 6] }
                  }
                }
              },
              else: null
            }
          }
        }
      });

      let nutritionMatch: any = {};

      if (searchDto.maxCalories) {
        nutritionMatch["nutritionParsed.calories"] = { $lte: searchDto.maxCalories };
      }
      
      if (searchDto.minCalories) {
        nutritionMatch["nutritionParsed.calories"] = { ...nutritionMatch["nutritionParsed.calories"], $gte: searchDto.minCalories };
      }
      
      if (searchDto.maxFat) {
        nutritionMatch["nutritionParsed.fat"] = { $lte: searchDto.maxFat };
      }
      
      if (searchDto.maxSodium) {
        nutritionMatch["nutritionParsed.sodium"] = { $lte: searchDto.maxSodium };
      }

      if (searchDto.calorieLevel) {
        if (searchDto.calorieLevel === 'low') {
          nutritionMatch["nutritionParsed.calories"] = { $lt: 200 };
        } else if (searchDto.calorieLevel === 'medium') {
          nutritionMatch["nutritionParsed.calories"] = { $gte: 200, $lt: 500 };
        } else if (searchDto.calorieLevel === 'high') {
          nutritionMatch["nutritionParsed.calories"] = { $gte: 500 };
        }
      }

      if (searchDto.dietFriendly) {
        nutritionMatch["nutritionParsed.calories"] = { $lt: 400 };
        nutritionMatch["nutritionParsed.fat"] = { $lt: 30 };
        nutritionMatch["nutritionParsed.sodium"] = { $lt: 30 };
      }

      if (Object.keys(nutritionMatch).length > 0) {
        aggregationPipeline.push({ $match: nutritionMatch });
      }
    }

    // 정렬
    aggregationPipeline.push({ $sort: { favoriteCount: -1, viewCount: -1 } });
    
    // 페이징
    if (searchDto.offset) {
      aggregationPipeline.push({ $skip: searchDto.offset });
    }
    
    if (searchDto.limit) {
      aggregationPipeline.push({ $limit: searchDto.limit });
    }

    const [recipes, totalCount] = await Promise.all([
      this.recipeModel.aggregate(aggregationPipeline),
      this.recipeModel.countDocuments(query)
    ]);

    const result = {
      recipes: recipes,
      total: totalCount
    };
    
    // 캐시 저장 (30분)
    await this.redisService.setex(cacheKey, 1800, JSON.stringify(result));
    
    return result;
  }

  async findByIngredients(dto: RecipeByIngredientsDto): Promise<Recipe[]> {
    const cacheKey = `ingredients:${JSON.stringify(dto)}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.elasticsearchService.findRecipesByIngredients(dto);
    
    // 캐시 저장 (1시간)
    await this.redisService.setex(cacheKey, 3600, JSON.stringify(result));
    
    return result;
  }

  async getPopular(limit: number = 10): Promise<Recipe[]> {
    const cacheKey = `popular:recipes:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const recipes = await this.recipeModel
      .find()
      .sort({ favoriteCount: -1, viewCount: -1 })
      .limit(limit)
      .exec();

    // 캐시 저장 (6시간)
    await this.redisService.setex(cacheKey, 21600, JSON.stringify(recipes));
    
    return recipes;
  }

  async getRecommendations(userId: string, allergies: string[] = []): Promise<Recipe[]> {
    const cacheKey = `recommendations:${userId}:${allergies.join(',')}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // 안전한 레시피만 필터링
    const query: any = {};
    if (allergies.length > 0) {
      query.unsafeAllergens = { $nin: allergies };
    }

    const recipes = await this.recipeModel
      .find(query)
      .sort({ allergyScore: -1, favoriteCount: -1 })
      .limit(20)
      .exec();

    // 캐시 저장 (2시간)
    await this.redisService.setex(cacheKey, 7200, JSON.stringify(recipes));
    
    return recipes;
  }

  async updateAllergyInfo(id: number, allergyScore: number, safeForAllergies: string[], unsafeAllergens: string[]): Promise<Recipe> {
    const recipe = await this.recipeModel.findOneAndUpdate(
      { id },
      { 
        allergyScore,
        safeForAllergies,
        unsafeAllergens
      },
      { new: true }
    ).exec();

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }

    // 캐시 무효화
    await this.redisService.del(`recipe:${id}`);
    
    return recipe;
  }

  // 건강한 레시피 추천
  async getHealthyRecipes(limit: number = 10): Promise<Recipe[]> {
    const cacheKey = `healthy:recipes:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const recipes = await this.recipeModel.aggregate([
      {
        $addFields: {
          nutritionParsed: {
            $cond: {
              if: { $ne: ["$nutrition", null] },
              then: {
                $let: {
                  vars: {
                    nutritionArray: {
                      $map: {
                        input: { $split: [{ $trim: { input: { $replaceAll: { input: { $replaceAll: { input: "$nutrition", find: "[", replacement: "" } }, find: "]", replacement: "" } } } }, ","] },
                        as: "item",
                        in: { $toDouble: "$$item" }
                      }
                    }
                  },
                  in: {
                    calories: { $arrayElemAt: ["$$nutritionArray", 0] },
                    fat: { $arrayElemAt: ["$$nutritionArray", 1] },
                    sodium: { $arrayElemAt: ["$$nutritionArray", 4] },
                    fiber: { $arrayElemAt: ["$$nutritionArray", 6] }
                  }
                }
              },
              else: null
            }
          }
        }
      },
      {
        $match: {
          "nutritionParsed.calories": { $lt: 400, $gt: 0 },
          "nutritionParsed.fat": { $lt: 30 },
          "nutritionParsed.sodium": { $lt: 30 }
        }
      },
      {
        $addFields: {
          healthScore: {
            $add: [
              { $cond: [{ $lt: ["$nutritionParsed.calories", 300] }, 20, 0] },
              { $cond: [{ $lt: ["$nutritionParsed.fat", 20] }, 15, 0] },
              { $cond: [{ $gt: ["$nutritionParsed.fiber", 20] }, 15, 0] },
              { $cond: [{ $lt: ["$nutritionParsed.sodium", 20] }, 10, 0] }
            ]
          }
        }
      },
      { $sort: { healthScore: -1, favoriteCount: -1 } },
      { $limit: limit }
    ]);

    // 캐시 저장 (2시간)
    await this.redisService.setex(cacheKey, 7200, JSON.stringify(recipes));
    
    return recipes;
  }

  // 저칼로리 레시피 추천
  async getLowCalorieRecipes(maxCalories: number = 300, limit: number = 10): Promise<Recipe[]> {
    const cacheKey = `lowcalorie:${maxCalories}:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const recipes = await this.recipeModel.aggregate([
      {
        $addFields: {
          nutritionParsed: {
            $cond: {
              if: { $ne: ["$nutrition", null] },
              then: {
                $let: {
                  vars: {
                    nutritionArray: {
                      $map: {
                        input: { $split: [{ $trim: { input: { $replaceAll: { input: { $replaceAll: { input: "$nutrition", find: "[", replacement: "" } }, find: "]", replacement: "" } } } }, ","] },
                        as: "item",
                        in: { $toDouble: "$$item" }
                      }
                    }
                  },
                  in: {
                    calories: { $arrayElemAt: ["$$nutritionArray", 0] }
                  }
                }
              },
              else: null
            }
          }
        }
      },
      {
        $match: {
          "nutritionParsed.calories": { $lte: maxCalories, $gt: 0 }
        }
      },
      { $sort: { "nutritionParsed.calories": 1, favoriteCount: -1 } },
      { $limit: limit }
    ]);

    // 캐시 저장 (2시간)
    await this.redisService.setex(cacheKey, 7200, JSON.stringify(recipes));
    
    return recipes;
  }
}