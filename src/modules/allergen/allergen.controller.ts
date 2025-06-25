import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AllergenService, AllergenCheckResult, AllergenSummary } from './allergen.service';

@Controller('allergen')
export class AllergenController {
  constructor(private readonly allergenService: AllergenService) {}

  /**
   * 특정 재료의 알레르기 정보 조회
   */
  @Get('ingredient/:name')
  async getIngredientAllergen(@Param('name') name: string) {
    try {
      const result = await this.allergenService.checkIngredientAllergen(name);
      
      if (!result) {
        return {
          success: false,
          message: `'${name}' 재료의 알레르기 정보를 찾을 수 없습니다.`,
          data: null
        };
      }

      return {
        success: true,
        message: `'${name}' 재료의 알레르기 정보입니다.`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: '알레르기 정보 조회 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }

  /**
   * 여러 재료들의 알레르기 체크
   */
  @Post('check')
  async checkIngredients(@Body() body: { ingredients: string[] }) {
    try {
      const { ingredients } = body;
      
      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return {
          success: false,
          message: '재료 목록이 필요합니다.',
          data: null
        };
      }

      const result = await this.allergenService.checkMultipleIngredients(ingredients);
      
      return {
        success: true,
        message: `${ingredients.length}개 재료의 알레르기 정보입니다.`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: '알레르기 정보 조회 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }

  /**
   * 레시피와 사용자 알레르기 비교
   */
  @Post('check-recipe')
  async checkRecipe(@Body() body: { 
    recipeIngredients: string[];
    userAllergies: string[];
  }) {
    try {
      const { recipeIngredients, userAllergies } = body;
      
      if (!recipeIngredients || !Array.isArray(recipeIngredients)) {
        return {
          success: false,
          message: '레시피 재료 목록이 필요합니다.',
          data: null
        };
      }

      if (!userAllergies || !Array.isArray(userAllergies)) {
        return {
          success: false,
          message: '사용자 알레르기 목록이 필요합니다.',
          data: null
        };
      }

      const result = await this.allergenService.checkRecipeAgainstAllergies(
        recipeIngredients, 
        userAllergies
      );
      
      return {
        success: true,
        message: result.isSafe ? '안전한 레시피입니다!' : '알레르기 주의가 필요합니다.',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: '레시피 알레르기 검사 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }

  /**
   * 지원하는 알레르기 타입 목록
   */
  @Get('types')
  async getAllergenTypes() {
    try {
      const types = this.allergenService.getAllergenTypes();
      
      return {
        success: true,
        message: '지원하는 알레르기 타입 목록입니다.',
        data: types
      };
    } catch (error) {
      return {
        success: false,
        message: '알레르기 타입 조회 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }

  /**
   * 알레르기 통계 정보
   */
  @Get('stats')
  async getStats() {
    try {
      const stats = await this.allergenService.getAllergenStats();
      
      return {
        success: true,
        message: '알레르기 통계 정보입니다.',
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        message: '통계 조회 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }

  /**
   * 건강 체크
   */
  @Get('health')
  async healthCheck() {
    return {
      success: true,
      message: 'Allergen service is running',
      timestamp: new Date().toISOString()
    };
  }
}
