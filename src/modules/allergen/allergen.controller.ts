import { Controller, Post, Body, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { AllergenService } from './allergen.service';
import { 
  AllergenCheckResult, 
  UserAllergenProfile, 
  AllergenInfo 
} from '../../shared/interfaces';
import { 
  AllergenCheckRequestDto,
  AllergenSearchRequestDto,
  BatchIngredientsRequestDto,
  AllergenProfileValidationDto
} from '../../shared/dto';

@Controller('allergen')
export class AllergenController {
  constructor(private readonly allergenService: AllergenService) {}

  @Post('check')
  async checkAllergens(@Body() request: AllergenCheckRequestDto): Promise<AllergenCheckResult> {
    if (!request.ingredients || request.ingredients.length === 0) {
      throw new BadRequestException('재료 목록이 비어있습니다.');
    }

    if (!request.userProfile || !request.userProfile.allergies) {
      throw new BadRequestException('사용자 알레르기 프로필이 필요합니다.');
    }

    try {
      return await this.allergenService.checkRecipeAllergens(
        request.ingredients,
        request.userProfile
      );
    } catch (error) {
      throw new BadRequestException(`알레르기 체크 실패: ${error.message}`);
    }
  }

  @Get('ingredient/:name')
  async getIngredientAllergens(@Param('name') name: string): Promise<AllergenInfo | null> {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('재료명을 입력해주세요.');
    }

    try {
      return await this.allergenService.getIngredientAllergens(name);
    } catch (error) {
      throw new BadRequestException(`재료 알레르기 정보 조회 실패: ${error.message}`);
    }
  }

  @Post('ingredients/batch')
  async getMultipleIngredientAllergens(@Body() body: BatchIngredientsRequestDto): Promise<{ [ingredient: string]: AllergenInfo | null }> {
    if (!body.ingredients || body.ingredients.length === 0) {
      throw new BadRequestException('재료 목록이 비어있습니다.');
    }

    if (body.ingredients.length > 50) {
      throw new BadRequestException('한 번에 최대 50개 재료까지 조회 가능합니다.');
    }

    try {
      const allergenMap = await this.allergenService.getMultipleIngredientAllergens(body.ingredients);
      
      // Map을 객체로 변환
      const result: { [ingredient: string]: AllergenInfo | null } = {};
      for (const ingredient of body.ingredients) {
        result[ingredient] = allergenMap.get(ingredient) || null;
      }

      return result;
    } catch (error) {
      throw new BadRequestException(`재료 알레르기 정보 일괄 조회 실패: ${error.message}`);
    }
  }

  @Get('search/:type')
  async searchAllergenicIngredients(
    @Param('type') type: string,
    @Query('limit') limit?: string
  ): Promise<AllergenInfo[]> {
    const validAllergens = [
      'gluten', 'crustacean', 'egg', 'fish', 'peanut', 'soy', 'milk', 'nuts',
      'celery', 'mustard', 'sesame', 'sulfites', 'lupin', 'mollusks', 'peach',
      'tomato', 'pork', 'beef', 'chicken'
    ];

    if (!validAllergens.includes(type)) {
      throw new BadRequestException(`유효하지 않은 알레르기 타입입니다. 사용 가능한 타입: ${validAllergens.join(', ')}`);
    }

    const limitNum = limit ? parseInt(limit) : 20;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('limit은 1-100 사이의 숫자여야 합니다.');
    }

    try {
      return await this.allergenService.searchAllergenicIngredients(type, limitNum);
    } catch (error) {
      throw new BadRequestException(`알레르기 재료 검색 실패: ${error.message}`);
    }
  }

  @Get('stats')
  async getAllergenStats(): Promise<any> {
    try {
      return await this.allergenService.getAllergenStats();
    } catch (error) {
      throw new BadRequestException(`알레르기 통계 조회 실패: ${error.message}`);
    }
  }

  @Post('profile/validate')
  async validateUserProfile(@Body() profile: AllergenProfileValidationDto): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!profile.allergies || !Array.isArray(profile.allergies)) {
      errors.push('allergies 필드는 배열이어야 합니다.');
    }

    if (!profile.severity || typeof profile.severity !== 'object') {
      errors.push('severity 필드는 객체여야 합니다.');
    }

    const validAllergens = [
      'gluten', 'crustacean', 'egg', 'fish', 'peanut', 'soy', 'milk', 'nuts',
      'celery', 'mustard', 'sesame', 'sulfites', 'lupin', 'mollusks', 'peach',
      'tomato', 'pork', 'beef', 'chicken'
    ];

    const validSeverities = ['low', 'medium', 'high'];

    if (profile.allergies) {
      for (const allergen of profile.allergies) {
        if (!validAllergens.includes(allergen)) {
          errors.push(`유효하지 않은 알레르기 타입: ${allergen}`);
        }
      }
    }

    if (profile.severity) {
      for (const [allergen, severity] of Object.entries(profile.severity)) {
        if (!validAllergens.includes(allergen)) {
          errors.push(`severity에 유효하지 않은 알레르기 타입: ${allergen}`);
        }
        if (!validSeverities.includes(severity)) {
          errors.push(`유효하지 않은 심각도: ${severity} (${allergen})`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  @Get('types')
  async getAllergenTypes(): Promise<{ [key: string]: string }> {
    return {
      gluten: '글루텐함유곡물',
      crustacean: '갑각류',
      egg: '난류',
      fish: '어류',
      peanut: '땅콩',
      soy: '대두',
      milk: '우유',
      nuts: '견과류',
      celery: '셀러리',
      mustard: '겨자',
      sesame: '참깨',
      sulfites: '아황산류',
      lupin: '루핀',
      mollusks: '연체동물',
      peach: '복숭아',
      tomato: '토마토',
      pork: '돼지고기',
      beef: '쇠고기',
      chicken: '닭고기'
    };
  }
}
