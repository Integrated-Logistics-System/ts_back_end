import { Injectable, BadRequestException } from '@nestjs/common';
import { ElasticsearchRecipe } from '../types/elasticsearch.types';

@Injectable()
export class RecipeValidator {
  private readonly requiredFields = [
    'name',
    'nameKo',
    'ingredients',
    'ingredientsKo',
    'steps',
    'stepsKo',
  ];

  private readonly allowedDifficulties = ['easy', 'medium', 'hard'];
  private readonly maxStringLength = 10000;
  private readonly maxArrayLength = 100;

  /**
   * 레시피 전체 유효성 검증
   */
  async validateRecipe(recipe: Partial<ElasticsearchRecipe>): Promise<void> {
    if (!recipe) {
      throw new BadRequestException('Recipe data is required');
    }

    this.validateRequiredFields(recipe);
    this.validateStringFields(recipe);
    this.validateArrayFields(recipe);
    this.validateNumberFields(recipe);
    this.validateEnumFields(recipe);
    this.validateBusinessRules(recipe);
  }

  /**
   * 업데이트 데이터 유효성 검증
   */
  async validateUpdateData(updates: Partial<ElasticsearchRecipe>): Promise<void> {
    if (!updates || Object.keys(updates).length === 0) {
      throw new BadRequestException('Update data is required');
    }

    // 업데이트에서는 필수 필드 검증 생략
    this.validateStringFields(updates);
    this.validateArrayFields(updates);
    this.validateNumberFields(updates);
    this.validateEnumFields(updates);
    
    // ID는 업데이트할 수 없음
    if (updates.id) {
      throw new BadRequestException('Recipe ID cannot be updated');
    }
  }

  /**
   * 재료 유효성 검증
   */
  validateIngredients(ingredients: string[]): void {
    if (!Array.isArray(ingredients)) {
      throw new BadRequestException('Ingredients must be an array');
    }

    if (ingredients.length === 0) {
      throw new BadRequestException('At least one ingredient is required');
    }

    if (ingredients.length > this.maxArrayLength) {
      throw new BadRequestException(`Too many ingredients (max: ${this.maxArrayLength})`);
    }

    ingredients.forEach((ingredient, index) => {
      if (!ingredient || typeof ingredient !== 'string') {
        throw new BadRequestException(`Invalid ingredient at index ${index}`);
      }

      if (ingredient.trim().length === 0) {
        throw new BadRequestException(`Empty ingredient at index ${index}`);
      }

      if (ingredient.length > 200) {
        throw new BadRequestException(`Ingredient too long at index ${index} (max: 200 characters)`);
      }
    });
  }

  /**
   * 조리 단계 유효성 검증
   */
  validateSteps(steps: string[]): void {
    if (!Array.isArray(steps)) {
      throw new BadRequestException('Steps must be an array');
    }

    if (steps.length === 0) {
      throw new BadRequestException('At least one step is required');
    }

    if (steps.length > this.maxArrayLength) {
      throw new BadRequestException(`Too many steps (max: ${this.maxArrayLength})`);
    }

    steps.forEach((step, index) => {
      if (!step || typeof step !== 'string') {
        throw new BadRequestException(`Invalid step at index ${index}`);
      }

      if (step.trim().length === 0) {
        throw new BadRequestException(`Empty step at index ${index}`);
      }

      if (step.length > 1000) {
        throw new BadRequestException(`Step too long at index ${index} (max: 1000 characters)`);
      }
    });
  }

  /**
   * 태그 유효성 검증
   */
  validateTags(tags: string[]): void {
    if (!Array.isArray(tags)) {
      throw new BadRequestException('Tags must be an array');
    }

    if (tags.length > 20) {
      throw new BadRequestException('Too many tags (max: 20)');
    }

    tags.forEach((tag, index) => {
      if (!tag || typeof tag !== 'string') {
        throw new BadRequestException(`Invalid tag at index ${index}`);
      }

      if (tag.trim().length === 0) {
        throw new BadRequestException(`Empty tag at index ${index}`);
      }

      if (tag.length > 50) {
        throw new BadRequestException(`Tag too long at index ${index} (max: 50 characters)`);
      }

      // 태그에 특수문자 제한
      if (!/^[a-zA-Z0-9가-힣\s\-_]+$/.test(tag)) {
        throw new BadRequestException(`Invalid characters in tag at index ${index}`);
      }
    });
  }

  /**
   * 영양 정보 유효성 검증
   */
  validateNutritionInfo(nutrition: any): void {
    if (!nutrition || typeof nutrition !== 'object') {
      return; // 영양 정보는 선택사항
    }

    const allowedFields = [
      'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'
    ];

    for (const [key, value] of Object.entries(nutrition)) {
      if (!allowedFields.includes(key)) {
        throw new BadRequestException(`Invalid nutrition field: ${key}`);
      }

      if (typeof value !== 'number' || value < 0) {
        throw new BadRequestException(`Invalid nutrition value for ${key}: must be a non-negative number`);
      }

      if (value > 10000) {
        throw new BadRequestException(`Nutrition value too high for ${key} (max: 10000)`);
      }
    }
  }

  // ==================== Private Validation Methods ====================

  private validateRequiredFields(recipe: Partial<ElasticsearchRecipe>): void {
    for (const field of this.requiredFields) {
      if (!recipe[field as keyof ElasticsearchRecipe]) {
        throw new BadRequestException(`Required field missing: ${field}`);
      }
    }
  }

  private validateStringFields(recipe: Partial<ElasticsearchRecipe>): void {
    const stringFields = [
      'name', 'nameKo', 'nameEn',
      'description', 'descriptionKo', 'descriptionEn',
      'difficulty', 'source'
    ];

    for (const field of stringFields) {
      const value = recipe[field as keyof ElasticsearchRecipe] as string;
      
      if (value !== undefined) {
        if (typeof value !== 'string') {
          throw new BadRequestException(`${field} must be a string`);
        }

        if (value.length > this.maxStringLength) {
          throw new BadRequestException(`${field} too long (max: ${this.maxStringLength} characters)`);
        }

        // 필수 필드에 대한 추가 검증
        if (this.requiredFields.includes(field) && value.trim().length === 0) {
          throw new BadRequestException(`${field} cannot be empty`);
        }
      }
    }
  }

  private validateArrayFields(recipe: Partial<ElasticsearchRecipe>): void {
    if (recipe.ingredients) {
      this.validateIngredients(recipe.ingredients);
    }
    if (recipe.ingredientsKo) {
      this.validateIngredients(recipe.ingredientsKo);
    }
    if (recipe.ingredientsEn) {
      this.validateIngredients(recipe.ingredientsEn);
    }

    if (recipe.steps) {
      this.validateSteps(recipe.steps);
    }
    if (recipe.stepsKo) {
      this.validateSteps(recipe.stepsKo);
    }
    if (recipe.stepsEn) {
      this.validateSteps(recipe.stepsEn);
    }

    if (recipe.tags) {
      this.validateTags(recipe.tags);
    }
    if (recipe.tagsKo) {
      this.validateTags(recipe.tagsKo);
    }
    if (recipe.tagsEn) {
      this.validateTags(recipe.tagsEn);
    }
  }

  private validateNumberFields(recipe: Partial<ElasticsearchRecipe>): void {
    const numberFields = [
      'minutes', 'nSteps', 'nIngredients', 'servings',
      'viewCount', 'likeCount', 'bookmarkCount', 'ratingCount',
      'averageRating', 'cookCount'
    ];

    for (const field of numberFields) {
      const value = recipe[field as keyof ElasticsearchRecipe] as number;
      
      if (value !== undefined) {
        if (typeof value !== 'number' || isNaN(value)) {
          throw new BadRequestException(`${field} must be a valid number`);
        }

        if (value < 0) {
          throw new BadRequestException(`${field} cannot be negative`);
        }

        // 특정 필드에 대한 범위 검증
        if (field === 'minutes' && value > 1440) { // 24시간
          throw new BadRequestException('Cooking time cannot exceed 24 hours');
        }

        if (field === 'servings' && (value < 1 || value > 100)) {
          throw new BadRequestException('Servings must be between 1 and 100');
        }

        if (field === 'averageRating' && (value < 0 || value > 5)) {
          throw new BadRequestException('Average rating must be between 0 and 5');
        }
      }
    }
  }

  private validateEnumFields(recipe: Partial<ElasticsearchRecipe>): void {
    if (recipe.difficulty && !this.allowedDifficulties.includes(recipe.difficulty)) {
      throw new BadRequestException(`Invalid difficulty: ${recipe.difficulty}. Allowed: ${this.allowedDifficulties.join(', ')}`);
    }
  }

  private validateBusinessRules(recipe: Partial<ElasticsearchRecipe>): void {
    // 재료 수와 nIngredients 일치 확인
    if (recipe.ingredients && recipe.nIngredients !== undefined) {
      if (recipe.ingredients.length !== recipe.nIngredients) {
        throw new BadRequestException('nIngredients must match the actual number of ingredients');
      }
    }

    // 단계 수와 nSteps 일치 확인
    if (recipe.steps && recipe.nSteps !== undefined) {
      if (recipe.steps.length !== recipe.nSteps) {
        throw new BadRequestException('nSteps must match the actual number of steps');
      }
    }

    // 평점 관련 비즈니스 로직
    if (recipe.averageRating !== undefined && recipe.ratingCount !== undefined) {
      if (recipe.averageRating > 0 && recipe.ratingCount === 0) {
        throw new BadRequestException('Cannot have average rating without rating count');
      }
      if (recipe.averageRating === 0 && recipe.ratingCount > 0) {
        throw new BadRequestException('Cannot have rating count without average rating');
      }
    }

    // 날짜 유효성 검증
    if (recipe.createdAt) {
      const createdDate = new Date(recipe.createdAt);
      if (isNaN(createdDate.getTime())) {
        throw new BadRequestException('Invalid createdAt date format');
      }
      if (createdDate > new Date()) {
        throw new BadRequestException('createdAt cannot be in the future');
      }
    }

    if (recipe.updatedAt) {
      const updatedDate = new Date(recipe.updatedAt);
      if (isNaN(updatedDate.getTime())) {
        throw new BadRequestException('Invalid updatedAt date format');
      }
    }

    // 다국어 일관성 검증
    this.validateMultiLanguageConsistency(recipe);
  }

  private validateMultiLanguageConsistency(recipe: Partial<ElasticsearchRecipe>): void {
    // 한국어 필드가 있으면 영어 필드도 권장
    const koFields = ['nameKo', 'descriptionKo', 'ingredientsKo', 'stepsKo', 'tagsKo'];
    const enFields = ['nameEn', 'descriptionEn', 'ingredientsEn', 'stepsEn', 'tagsEn'];
    
    // 배열 필드 길이 일관성 확인
    if (recipe.ingredients && recipe.ingredientsKo) {
      if (recipe.ingredients.length !== recipe.ingredientsKo.length) {
        console.warn('Warning: ingredients and ingredientsKo arrays have different lengths');
      }
    }

    if (recipe.steps && recipe.stepsKo) {
      if (recipe.steps.length !== recipe.stepsKo.length) {
        console.warn('Warning: steps and stepsKo arrays have different lengths');
      }
    }
  }
}