import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface TranslatedRecipe {
  id: string;
  originalName: string;
  koreanName: string;
  originalDescription: string;
  koreanDescription: string;
  ingredients: {
    original: string[];
    korean: string[];
  };
  steps: {
    original: string[];
    korean: string[];
  };
  difficulty: string;
  cookingTime: number;
  servings?: number;
  tags: {
    original: string[];
    korean: string[];
  };
}

@Injectable()
export class RecipeTranslationService {
  private readonly logger = new Logger(RecipeTranslationService.name);
  private readonly OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  private readonly OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3n:e4b';

  /**
   * 영어 레시피를 한국어로 번역
   */
  async translateRecipe(recipe: any): Promise<TranslatedRecipe> {
    try {
      // JSON 필드 파싱
      const ingredients = this.parseJsonField(recipe.ingredients_json);
      const steps = this.parseJsonField(recipe.steps_json);
      const tags = this.parseJsonField(recipe.tags_json);

      // 번역할 텍스트 구성
      const translationPrompt = this.buildTranslationPrompt(
        recipe.name,
        recipe.description,
        ingredients,
        steps,
        tags
      );

      // AI로 번역 실행
      const translationResult = await this.executeTranslation(translationPrompt);
      
      // 번역 결과 파싱
      const parsed = this.parseTranslationResult(translationResult);

      return {
        id: recipe.recipe_id,
        originalName: recipe.name,
        koreanName: parsed.name || recipe.name,
        originalDescription: recipe.description || '',
        koreanDescription: parsed.description || '',
        ingredients: {
          original: ingredients,
          korean: parsed.ingredients || ingredients
        },
        steps: {
          original: steps,
          korean: parsed.steps || steps
        },
        difficulty: recipe.difficulty || '중급',
        cookingTime: parseInt(recipe.minutes) || 30,
        servings: parseInt(recipe.n_ingredients) || 4,
        tags: {
          original: tags,
          korean: parsed.tags || tags
        }
      };

    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`레시피 번역 실패: ${recipe.recipe_id}`, errorStack);
      
      // 번역 실패 시 원본 데이터 반환
      return this.createFallbackRecipe(recipe);
    }
  }

  /**
   * 여러 레시피 일괄 번역
   */
  async translateMultipleRecipes(recipes: any[]): Promise<TranslatedRecipe[]> {
    const translatedRecipes: TranslatedRecipe[] = [];

    for (const recipe of recipes) {
      try {
        const translated = await this.translateRecipe(recipe);
        translatedRecipes.push(translated);
        
        // API 부하 방지
        await this.sleep(100);
      } catch (error) {
        this.logger.warn(`레시피 번역 건너뜀: ${recipe.recipe_id}`);
        translatedRecipes.push(this.createFallbackRecipe(recipe));
      }
    }

    return translatedRecipes;
  }

  /**
   * 번역 프롬프트 생성
   */
  private buildTranslationPrompt(
    name: string,
    description: string,
    ingredients: string[],
    steps: string[],
    tags: string[]
  ): string {
    return `다음 영어 레시피를 한국어로 자연스럽게 번역해주세요. JSON 형식으로 응답해주세요.

원본:
- 이름: ${name}
- 설명: ${description}
- 재료: ${ingredients.join(', ')}
- 조리 단계: ${steps.join(' | ')}
- 태그: ${tags.join(', ')}

요청사항:
1. 요리명은 한국인이 이해하기 쉽게 의역
2. 재료명은 한국 마트에서 구할 수 있는 이름으로 번역
3. 조리 단계는 한국 요리 방식에 맞게 자연스럽게 번역
4. 영어 전문 용어는 괄호 안에 병기

응답 형식:
{
  "name": "한국어 요리명",
  "description": "한국어 설명", 
  "ingredients": ["한국어 재료1", "한국어 재료2"],
  "steps": ["한국어 단계1", "한국어 단계2"],
  "tags": ["한국어 태그1", "한국어 태그2"]
}

JSON:`;
  }

  /**
   * AI 번역 실행
   */
  private async executeTranslation(prompt: string): Promise<string> {
    const response = await axios.post(`${this.OLLAMA_URL}/api/generate`, {
      model: this.OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3, // 일관성을 위해 낮은 온도
        max_tokens: 1500
      }
    }, {
      timeout: 45000
    });

    return response.data.response.trim();
  }

  /**
   * 번역 결과 파싱
   */
  private parseTranslationResult(result: string): any {
    try {
      // JSON 부분만 추출
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // JSON이 없으면 텍스트 파싱 시도
      return this.parseTextResult(result);
    } catch (error) {
      this.logger.warn('번역 결과 파싱 실패, 빈 객체 반환');
      return {};
    }
  }

  /**
   * 텍스트 형태 결과 파싱
   */
  private parseTextResult(text: string): any {
    const result: any = {};
    
    // 이름 추출
    const nameMatch = text.match(/(?:이름|요리명):\s*([^\n]+)/i);
    if (nameMatch && nameMatch[1]) result.name = nameMatch[1].trim();
    
    // 설명 추출  
    const descMatch = text.match(/(?:설명|description):\s*([^\n]+)/i);
    if (descMatch && descMatch[1]) result.description = descMatch[1].trim();
    
    return result;
  }

  /**
   * JSON 필드 안전 파싱
   */
  private parseJsonField(jsonString: string): string[] {
    try {
      if (!jsonString) return [];
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * 번역 실패 시 대체 레시피 생성
   */
  private createFallbackRecipe(recipe: any): TranslatedRecipe {
    const ingredients = this.parseJsonField(recipe.ingredients_json);
    const steps = this.parseJsonField(recipe.steps_json);
    const tags = this.parseJsonField(recipe.tags_json);

    return {
      id: recipe.recipe_id,
      originalName: recipe.name,
      koreanName: `${recipe.name} (번역 실패)`,
      originalDescription: recipe.description || '',
      koreanDescription: recipe.description || '설명이 없습니다.',
      ingredients: {
        original: ingredients,
        korean: ingredients // 원본 그대로
      },
      steps: {
        original: steps,
        korean: steps // 원본 그대로
      },
      difficulty: recipe.difficulty || '중급',
      cookingTime: parseInt(recipe.minutes) || 30,
      servings: parseInt(recipe.n_ingredients) || 4,
      tags: {
        original: tags,
        korean: tags // 원본 그대로
      }
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}