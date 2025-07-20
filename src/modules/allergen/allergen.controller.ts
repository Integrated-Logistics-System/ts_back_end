import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

interface AllergenWarning {
  allergen: string;
  ingredient: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

@ApiTags('Allergen')
@Controller('allergen')
export class AllergenController {

  @Get('types')
  @Public()
  @ApiOperation({ summary: 'Get allergen types' })
  @ApiResponse({ status: 200, description: 'Allergen types retrieved' })
  getAllergenTypes() {
    const allergenTypes = [
      { id: 1, name: '글루텐함유곡물' },
      { id: 2, name: '갑각류' },
      { id: 3, name: '계란' },
      { id: 4, name: '어류' },
      { id: 5, name: '땅콩' },
      { id: 6, name: '대두' },
      { id: 7, name: '우유' },
      { id: 8, name: '견과류' },
      { id: 9, name: '셀러리' },
      { id: 10, name: '겨자' },
      { id: 11, name: '참깨' },
      { id: 12, name: '아황산류' },
      { id: 13, name: '루핀' },
      { id: 14, name: '연체동물' },
      { id: 15, name: '복숭아' },
      { id: 16, name: '토마토' },
      { id: 17, name: '돼지고기' },
      { id: 18, name: '쇠고기' },
      { id: 19, name: '닭고기' },
    ];

    return {
      success: true,
      data: allergenTypes,
      count: allergenTypes.length,
    };
  }

  @Get('ingredient/:name')
  @Public()
  @ApiOperation({ summary: 'Get ingredient allergen info' })
  @ApiResponse({ status: 200, description: 'Ingredient info retrieved' })
  getIngredientInfo(@Param('name') name: string) {
    // 간단한 재료별 알레르기 정보 (예시)
    const commonAllergens: { [key: string]: string[] } = {
      '밀가루': ['글루텐함유곡물'],
      '달걀': ['계란'],
      '우유': ['우유'],
      '땅콩': ['땅콩'],
      '새우': ['갑각류'],
      '게': ['갑각류'],
      '연어': ['어류'],
      '고등어': ['어류'],
      '아몬드': ['견과류'],
      '호두': ['견과류'],
      '참깨': ['참깨'],
      '대두': ['대두'],
      '두부': ['대두'],
      '콩': ['대두'],
    };

    const allergens = commonAllergens[name] || [];

    return {
      success: true,
      data: {
        ingredient_name: name,
        allergens: allergens,
        risk_level: allergens.length > 0 ? 'medium' : 'low',
      },
    };
  }

  @Post('check')
  @Public()
  @ApiOperation({ summary: 'Check recipe for allergens' })
  @ApiResponse({ status: 200, description: 'Allergen check completed' })
  checkRecipeAllergens(@Body() body: { ingredients: string[]; userAllergies?: string[] }) {
    const { ingredients = [], userAllergies = [] } = body;
    
    const warnings: AllergenWarning[] = [];
    let safetyScore = 100;

    // 간단한 알레르기 체크 로직
    for (const ingredient of ingredients) {
      for (const allergy of userAllergies) {
        if (ingredient.toLowerCase().includes(allergy.toLowerCase()) ||
            allergy.toLowerCase().includes(ingredient.toLowerCase())) {
          warnings.push({
            allergen: allergy,
            ingredient: ingredient,
            severity: 'high',
            message: `${ingredient}에 ${allergy} 알레르기 성분이 포함될 수 있습니다.`
          });
          safetyScore -= 20;
        }
      }
    }

    return {
      success: true,
      data: {
        safe: warnings.length === 0,
        warnings: warnings,
        safetyScore: Math.max(0, safetyScore),
      },
    };
  }
}
