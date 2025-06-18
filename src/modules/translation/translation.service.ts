import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from '../../shared/ollama/ollama.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  /**
   * 검색어를 영어로 번역
   */
  async translateQueryToEnglish(query: string): Promise<string> {
    if (this.isEnglish(query)) {
      return query;
    }

    try {
      const prompt = `Translate this Korean cooking/food search query to English. Only return the translated text, nothing else.

Korean: ${query}
English:`;

      const translation = await this.ollamaService.generateResponse(prompt);
      return translation.trim();
    } catch (error) {
      this.logger.warn(`검색어 번역 실패: ${error.message}`);
      return query; // 실패시 원본 반환
    }
  }

  /**
   * 레시피 이름을 한글로 번역
   */
  async translateRecipeName(name: string): Promise<string> {
    if (this.isKorean(name)) {
      return name;
    }

    try {
      const prompt = `Translate this recipe name to Korean. Keep it natural and appetizing. Only return the Korean translation, nothing else.

English: ${name}
Korean:`;

      const translation = await this.ollamaService.generateResponse(prompt);
      return translation.trim();
    } catch (error) {
      this.logger.warn(`레시피명 번역 실패: ${error.message}`);
      return name; // 실패시 원본 반환
    }
  }

  /**
   * 레시피 설명을 한글로 번역
   */
  async translateDescription(description: string): Promise<string> {
    if (!description || this.isKorean(description)) {
      return description;
    }

    try {
      const prompt = `Translate this recipe description to Korean. Make it natural and appealing. Only return the Korean translation, nothing else.

English: ${description}
Korean:`;

      const translation = await this.ollamaService.generateResponse(prompt);
      return translation.trim();
    } catch (error) {
      this.logger.warn(`설명 번역 실패: ${error.message}`);
      return description; // 실패시 원본 반환
    }
  }

  /**
   * 재료 목록을 한글로 번역
   */
  async translateIngredients(ingredients: string[]): Promise<string[]> {
    if (!ingredients || ingredients.length === 0) {
      return ingredients;
    }

    try {
      const ingredientsText = ingredients.join(', ');
      
      const prompt = `Translate these recipe ingredients to Korean. Keep measurements and quantities. Return as comma-separated list. Only return the Korean translations, nothing else.

English: ${ingredientsText}
Korean:`;

      const translation = await this.ollamaService.generateResponse(prompt);
      return translation.trim().split(',').map(item => item.trim());
    } catch (error) {
      this.logger.warn(`재료 번역 실패: ${error.message}`);
      return ingredients; // 실패시 원본 반환
    }
  }

  /**
   * 조리 단계를 한글로 번역
   */
  async translateSteps(steps: string[]): Promise<string[]> {
    if (!steps || steps.length === 0) {
      return steps;
    }

    try {
      const translatedSteps: string[] = [];
      
      // 단계별로 번역 (너무 긴 프롬프트 방지)
      for (const step of steps) {
        if (this.isKorean(step)) {
          translatedSteps.push(step);
          continue;
        }

        const prompt = `Translate this cooking step to Korean. Make it clear and easy to follow. Only return the Korean translation, nothing else.

English: ${step}
Korean:`;

        const translation = await this.ollamaService.generateResponse(prompt);
        translatedSteps.push(translation.trim());
      }

      return translatedSteps;
    } catch (error) {
      this.logger.warn(`조리법 번역 실패: ${error.message}`);
      return steps; // 실패시 원본 반환
    }
  }

  /**
   * 태그를 한글로 번역
   */
  async translateTags(tags: string[]): Promise<string[]> {
    if (!tags || tags.length === 0) {
      return tags;
    }

    try {
      const tagsText = tags.join(', ');
      
      const prompt = `Translate these recipe tags to Korean. Keep them short and relevant. Return as comma-separated list. Only return the Korean translations, nothing else.

English: ${tagsText}
Korean:`;

      const translation = await this.ollamaService.generateResponse(prompt);
      return translation.trim().split(',').map(item => item.trim());
    } catch (error) {
      this.logger.warn(`태그 번역 실패: ${error.message}`);
      return tags; // 실패시 원본 반환
    }
  }

  /**
   * 레시피 전체를 번역하고 Elasticsearch에 저장
   */
  async translateAndSaveRecipe(recipe: any): Promise<any> {
    try {
      this.logger.log(`🌐 레시피 번역 시작: ${recipe.name}`);

      // 이미 번역되어 있는지 확인
      if (recipe.name_ko || this.isKorean(recipe.name)) {
        this.logger.log(`✅ 이미 번역됨: ${recipe.name}`);
        return recipe;
      }

      // 병렬 번역 수행
      const [name_ko, description_ko, ingredients_ko, steps_ko, tags_ko] = await Promise.all([
        this.translateRecipeName(recipe.name),
        recipe.description ? this.translateDescription(recipe.description) : null,
        recipe.ingredients ? this.translateIngredients(recipe.ingredients) : null,
        recipe.steps ? this.translateSteps(recipe.steps) : null,
        recipe.tags ? this.translateTags(recipe.tags) : null,
      ]);

      // 번역된 데이터로 업데이트
      const translatedRecipe = {
        ...recipe,
        name_ko,
        description_ko,
        ingredients_ko,
        steps_ko,
        tags_ko,
        translated_at: new Date().toISOString(),
      };

      // Elasticsearch에 업데이트
      await this.updateRecipeInElasticsearch(recipe.id, translatedRecipe);

      this.logger.log(`✅ 번역 완료: ${recipe.name} → ${name_ko}`);
      return translatedRecipe;

    } catch (error) {
      this.logger.error(`❌ 레시피 번역 실패 [${recipe.name}]: ${error.message}`);
      return recipe; // 실패시 원본 반환
    }
  }

  /**
   * 여러 레시피를 배치로 번역
   */
  async translateRecipesBatch(recipes: any[]): Promise<any[]> {
    this.logger.log(`🌐 배치 번역 시작: ${recipes.length}개 레시피`);

    const batchSize = 3; // 동시 번역 수 제한
    const translatedRecipes: any[] = [];

    for (let i = 0; i < recipes.length; i += batchSize) {
      const batch = recipes.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(recipe => this.translateAndSaveRecipe(recipe))
      );
      
      translatedRecipes.push(...batchResults);
    }

    this.logger.log(`✅ 배치 번역 완료: ${translatedRecipes.length}개 레시피`);
    return translatedRecipes;
  }

  /**
   * 검색 결과를 한글로 제공 (번역이 필요한 경우 번역 수행)
   */
  async getKoreanSearchResults(recipes: any[]): Promise<any[]> {
    if (!recipes || recipes.length === 0) {
      return recipes;
    }

    // 번역이 필요한 레시피들 식별
    const needsTranslation = recipes.filter(recipe => 
      !recipe.name_ko && !this.isKorean(recipe.name)
    );

    if (needsTranslation.length > 0) {
      this.logger.log(`🌐 ${needsTranslation.length}개 레시피 번역 필요`);
      
      // 백그라운드에서 번역 수행
      this.translateRecipesBatch(needsTranslation);
    }

    // 현재 사용 가능한 번역 데이터로 응답 구성
    return recipes.map(recipe => ({
      ...recipe,
      name: recipe.name_ko || recipe.name,
      description: recipe.description_ko || recipe.description,
      ingredients: recipe.ingredients_ko || recipe.ingredients,
      steps: recipe.steps_ko || recipe.steps,
      tags: recipe.tags_ko || recipe.tags,
    }));
  }

  /**
   * Elasticsearch 레시피 업데이트
   */
  private async updateRecipeInElasticsearch(recipeId: string | number, data: any): Promise<void> {
    try {
      await this.elasticsearchService.updateDocument('recipes', recipeId, data);
    } catch (error) {
      this.logger.error(`Elasticsearch 업데이트 실패 [${recipeId}]: ${error.message}`);
    }
  }

  /**
   * 텍스트가 영어인지 판단
   */
  private isEnglish(text: string): boolean {
    if (!text) return false;
    const englishPattern = /^[a-zA-Z0-9\s\-_.,!?()&]+$/;
    return englishPattern.test(text.trim());
  }

  /**
   * 텍스트가 한글인지 판단
   */
  private isKorean(text: string): boolean {
    if (!text) return false;
    const koreanPattern = /[가-힣]/;
    return koreanPattern.test(text);
  }
}
