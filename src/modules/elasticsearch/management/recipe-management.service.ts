import { Injectable, Logger, Inject } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import {
  ElasticsearchRecipe,
  RecipeCreateInput,
  RecipeUpdateInput,
  BulkOperationResult,
} from '../types/elasticsearch.types';
import { RecipeValidator } from '../utils/recipe-validator.util';

@Injectable()
export class RecipeManagementService {
  private readonly logger = new Logger(RecipeManagementService.name);
  private readonly indexName = 'recipes';

  constructor(
    private readonly recipeValidator: RecipeValidator,
    @Inject('ELASTICSEARCH_CLIENT') private readonly client: Client,
  ) {}

  /**
   * 새 레시피 저장
   */
  async saveRecipe(input: RecipeCreateInput): Promise<ElasticsearchRecipe> {
    try {
      // 레시피 유효성 검증
      if (input.validate !== false) {
        await this.recipeValidator.validateRecipe(input.recipe);
      }

      // 기본값 설정
      const recipeWithDefaults = this.setDefaultValues(input.recipe);
      
      // Elasticsearch에 저장
      const savedRecipe = await this.executeCreate(recipeWithDefaults);
      
      this.logger.log(`Recipe saved successfully: ${savedRecipe.id}`);
      return savedRecipe;

    } catch (error) {
      this.logger.error('Failed to save recipe:', error);
      throw error;
    }
  }

  /**
   * 레시피 업데이트
   */
  async updateRecipe(input: RecipeUpdateInput): Promise<ElasticsearchRecipe> {
    try {
      // 업데이트 데이터 검증
      await this.recipeValidator.validateUpdateData(input.updates);

      // 업데이트 타임스탬프 추가
      const updatesWithTimestamp = {
        ...input.updates,
        updatedAt: new Date().toISOString(),
      };

      // Elasticsearch에서 업데이트
      const updatedRecipe = await this.executeUpdate(input.id, updatesWithTimestamp, input.upsert);
      
      this.logger.log(`Recipe updated successfully: ${input.id}`);
      return updatedRecipe;

    } catch (error) {
      this.logger.error(`Failed to update recipe ${input.id}:`, error);
      throw error;
    }
  }

  /**
   * 레시피 삭제
   */
  async deleteRecipe(id: string): Promise<boolean> {
    try {
      const result = await this.executeDelete(id);
      
      if (result) {
        this.logger.log(`Recipe deleted successfully: ${id}`);
      } else {
        this.logger.warn(`Recipe not found for deletion: ${id}`);
      }
      
      return result;

    } catch (error) {
      this.logger.error(`Failed to delete recipe ${id}:`, error);
      throw error;
    }
  }

  /**
   * 대량 레시피 저장
   */
  async bulkSaveRecipes(recipes: Partial<ElasticsearchRecipe>[]): Promise<BulkOperationResult> {
    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];
    let processed = 0;

    try {
      // 레시피들을 유효성 검증
      const validatedRecipes: ElasticsearchRecipe[] = [];
      
      for (const recipe of recipes) {
        try {
          await this.recipeValidator.validateRecipe(recipe);
          validatedRecipes.push(this.setDefaultValues(recipe));
          processed++;
        } catch (error) {
          errors.push({
            id: recipe.id || 'unknown',
            error: error instanceof Error ? error.message : 'Validation failed'
          });
        }
      }

      // 대량 저장 실행
      if (validatedRecipes.length > 0) {
        await this.executeBulkCreate(validatedRecipes);
      }

      const result: BulkOperationResult = {
        success: errors.length === 0,
        processed,
        errors,
      };

      this.logger.log(`Bulk save completed: ${processed} processed, ${errors.length} errors in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      this.logger.error('Bulk save operation failed:', error);
      throw error;
    }
  }

  /**
   * 대량 레시피 업데이트
   */
  async bulkUpdateRecipes(updates: RecipeUpdateInput[]): Promise<BulkOperationResult> {
    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];
    let processed = 0;

    try {
      const validatedUpdates: RecipeUpdateInput[] = [];
      
      for (const update of updates) {
        try {
          await this.recipeValidator.validateUpdateData(update.updates);
          validatedUpdates.push({
            ...update,
            updates: {
              ...update.updates,
              updatedAt: new Date().toISOString(),
            }
          });
          processed++;
        } catch (error) {
          errors.push({
            id: update.id,
            error: error instanceof Error ? error.message : 'Validation failed'
          });
        }
      }

      // 대량 업데이트 실행
      if (validatedUpdates.length > 0) {
        await this.executeBulkUpdate(validatedUpdates);
      }

      const result: BulkOperationResult = {
        success: errors.length === 0,
        processed,
        errors,
      };

      this.logger.log(`Bulk update completed: ${processed} processed, ${errors.length} errors in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      this.logger.error('Bulk update operation failed:', error);
      throw error;
    }
  }

  /**
   * 대량 레시피 삭제
   */
  async bulkDeleteRecipes(ids: string[]): Promise<BulkOperationResult> {
    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];
    let processed = 0;

    try {
      for (const id of ids) {
        try {
          const deleted = await this.executeDelete(id);
          if (deleted) {
            processed++;
          } else {
            errors.push({ id, error: 'Recipe not found' });
          }
        } catch (error) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : 'Delete failed'
          });
        }
      }

      const result: BulkOperationResult = {
        success: errors.length === 0,
        processed,
        errors,
      };

      this.logger.log(`Bulk delete completed: ${processed} processed, ${errors.length} errors in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      this.logger.error('Bulk delete operation failed:', error);
      throw error;
    }
  }

  /**
   * 레시피 복제
   */
  async duplicateRecipe(
    originalId: string, 
    modifications: Partial<ElasticsearchRecipe> = {}
  ): Promise<ElasticsearchRecipe> {
    try {
      // 원본 레시피 조회
      const originalRecipe = await this.getRecipeById(originalId);
      if (!originalRecipe) {
        throw new Error(`Original recipe not found: ${originalId}`);
      }

      // 복제본 생성
      const duplicatedRecipe: Partial<ElasticsearchRecipe> = {
        ...originalRecipe,
        ...modifications,
        id: this.generateNewId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewCount: 0,
        likeCount: 0,
        bookmarkCount: 0,
        ratingCount: 0,
        averageRating: 0,
      };

      // 복제본 저장
      return await this.saveRecipe({ recipe: duplicatedRecipe });

    } catch (error) {
      this.logger.error(`Failed to duplicate recipe ${originalId}:`, error);
      throw error;
    }
  }

  // ==================== Private Helper Methods ====================

  private setDefaultValues(recipe: Partial<ElasticsearchRecipe>): ElasticsearchRecipe {
    const now = new Date().toISOString();
    
    return {
      id: recipe.id || this.generateNewId(),
      name: recipe.name || '',
      nameKo: recipe.nameKo || recipe.name || '',
      nameEn: recipe.nameEn || '',
      description: recipe.description || '',
      descriptionKo: recipe.descriptionKo || recipe.description || '',
      descriptionEn: recipe.descriptionEn || '',
      ingredients: recipe.ingredients || [],
      ingredientsKo: recipe.ingredientsKo || recipe.ingredients || [],
      ingredientsEn: recipe.ingredientsEn || [],
      steps: recipe.steps || [],
      stepsKo: recipe.stepsKo || recipe.steps || [],
      stepsEn: recipe.stepsEn || [],
      difficulty: recipe.difficulty || 'medium',
      tags: recipe.tags || [],
      tagsKo: recipe.tagsKo || recipe.tags || [],
      tagsEn: recipe.tagsEn || [],
      minutes: recipe.minutes || 30,
      nSteps: recipe.nSteps || recipe.steps?.length || 0,
      nIngredients: recipe.nIngredients || recipe.ingredients?.length || 0,
      servings: recipe.servings || 2,
      viewCount: recipe.viewCount || 0,
      likeCount: recipe.likeCount || 0,
      bookmarkCount: recipe.bookmarkCount || 0,
      averageRating: recipe.averageRating || 0,
      ratingCount: recipe.ratingCount || 0,
      createdAt: recipe.createdAt || now,
      updatedAt: now,
      isAiGenerated: recipe.isAiGenerated || false,
      ...recipe, // 나머지 필드들 유지
    } as ElasticsearchRecipe;
  }

  private generateNewId(): string {
    return `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Elasticsearch 실행 메서드들 (실제 구현 필요)
  private async executeCreate(recipe: ElasticsearchRecipe): Promise<ElasticsearchRecipe> {
    try {
      const response = await this.client.index({
        index: this.indexName,
        id: recipe.id,
        document: recipe,
      });
      
      this.logger.log(`Recipe created: ${recipe.id}`);
      return { ...recipe, id: response._id };
    } catch (error) {
      this.logger.error('Failed to create recipe:', error);
      throw new Error(`Failed to create recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeUpdate(
    id: string, 
    updates: Partial<ElasticsearchRecipe>, 
    upsert?: boolean
  ): Promise<ElasticsearchRecipe> {
    try {
      const response = await this.client.update({
        index: this.indexName,
        id: id,
        doc: updates,
        doc_as_upsert: upsert || false,
      });
      
      this.logger.log(`Recipe updated: ${id}`);
      
      // Get updated recipe
      const updatedRecipe = await this.getRecipeById(id);
      if (!updatedRecipe) {
        throw new Error(`Failed to retrieve updated recipe: ${id}`);
      }
      return updatedRecipe;
    } catch (error) {
      this.logger.error('Failed to update recipe:', error);
      throw new Error(`Failed to update recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeDelete(id: string): Promise<boolean> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: id,
      });
      
      this.logger.log(`Recipe deleted: ${id}`);
      return true;
    } catch (error) {
      if ((error as any).statusCode === 404) {
        return false;
      }
      this.logger.error('Failed to delete recipe:', error);
      throw new Error(`Failed to delete recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeBulkCreate(recipes: ElasticsearchRecipe[]): Promise<void> {
    try {
      const body = recipes.flatMap(recipe => [
        { index: { _index: this.indexName, _id: recipe.id } },
        recipe
      ]);
      
      const response = await this.client.bulk({ body });
      
      if (response.errors) {
        this.logger.warn('Some bulk operations failed:', response.items);
      }
      
      this.logger.log(`Bulk created ${recipes.length} recipes`);
    } catch (error) {
      this.logger.error('Failed to bulk create recipes:', error);
      throw new Error(`Failed to bulk create recipes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeBulkUpdate(updates: RecipeUpdateInput[]): Promise<void> {
    try {
      const body = updates.flatMap(update => [
        { update: { _index: this.indexName, _id: update.id } },
        { doc: update.updates }
      ]);
      
      const response = await this.client.bulk({ body });
      
      if (response.errors) {
        this.logger.warn('Some bulk operations failed:', response.items);
      }
      
      this.logger.log(`Bulk updated ${updates.length} recipes`);
    } catch (error) {
      this.logger.error('Failed to bulk update recipes:', error);
      throw new Error(`Failed to bulk update recipes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getRecipeById(id: string): Promise<ElasticsearchRecipe | null> {
    try {
      const response = await this.client.get({
        index: this.indexName,
        id: id,
      });
      
      return response._source as ElasticsearchRecipe;
    } catch (error) {
      if ((error as any).statusCode === 404) {
        return null;
      }
      this.logger.error('Failed to get recipe by id:', error);
      throw new Error(`Failed to get recipe by id: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}