import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ingredient, IngredientDocument } from './schemas/ingredient.schema';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class IngredientService {
  constructor(
    @InjectModel(Ingredient.name) private ingredientModel: Model<IngredientDocument>,
    private readonly redisService: RedisService,
  ) {}

  async checkAllergies(ingredientNames: string[], userAllergies: string[]): Promise<{
    safeIngredients: string[];
    unsafeIngredients: Array<{ name: string; allergens: string[] }>;
    safetyScore: number;
  }> {
    const safeIngredients = [];
    const unsafeIngredients = [];

    for (const ingredientName of ingredientNames) {
      const cacheKey = `ingredient:${ingredientName}`;
      let ingredient = await this.redisService.get(cacheKey);
      
      if (!ingredient) {
        const dbIngredient = await this.ingredientModel.findOne({
          ingredient_name: { $regex: new RegExp(ingredientName, 'i') }
        }).exec();
        
        if (dbIngredient) {
          ingredient = JSON.stringify(dbIngredient);
          await this.redisService.setex(cacheKey, 3600, ingredient);
        }
      }

      if (ingredient) {
        const parsed = JSON.parse(ingredient);
        const allergens = [];
        
        for (const allergy of userAllergies) {
          if (parsed[allergy] && parsed[allergy] > 0) {
            allergens.push(allergy);
          }
        }

        if (allergens.length > 0) {
          unsafeIngredients.push({ name: ingredientName, allergens });
        } else {
          safeIngredients.push(ingredientName);
        }
      } else {
        // 알 수 없는 재료는 안전한 것으로 가정
        safeIngredients.push(ingredientName);
      }
    }

    const safetyScore = Math.round((safeIngredients.length / ingredientNames.length) * 100);

    return {
      safeIngredients,
      unsafeIngredients,
      safetyScore
    };
  }

  async getAllAvailableAllergens(): Promise<string[]> {
    return [
      '글루텐함유곡물', '갑각류', '난류', '어류', '땅콩', '대두', '우유', '견과류',
      '셀러리', '겨자', '참깨', '아황산류', '루핀', '연체동물', '복숭아', '토마토',
      '돼지고기', '쇠고기', '닭고기'
    ];
  }

  async searchIngredients(query: string, limit: number = 20): Promise<Ingredient[]> {
    return this.ingredientModel
      .find({
        ingredient_name: { $regex: new RegExp(query, 'i') }
      })
      .limit(limit)
      .exec();
  }
}