import { Injectable } from '@nestjs/common';
import { ElasticsearchRecipe } from '@/modules/elasticsearch/elasticsearch.service';

@Injectable()
export class ResponseFormatter {

  /**
   * AI 레시피 생성을 위한 프롬프트 생성
   */
  buildGenerationPrompt(query: string, baseRecipes: ElasticsearchRecipe[], allergies: string[]): string {
    const allergyWarning = allergies.length > 0
      ? `⚠️ 금지 재료: ${allergies.join(', ')}`
      : '';

    // 3개 레시피만 사용하고 재료 수 제한
    const recipeContext = baseRecipes.slice(0, 3).map((recipe, i) => {
      const ingredients = recipe.ingredients?.slice(0, 5) || [];  // 재료 5개만
      return `${i + 1}. ${recipe.name} (${recipe.minutes || 30}분)\n재료: ${ingredients.join(', ')}`;
    }).join('\n\n');

    return `"${query}" 레시피를 JSON으로 생성해주세요.\n${allergyWarning}\n\n참고:\n${recipeContext}\n\n반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):\n{\n  "name": "Kimchi Jjigae",\n  "nameKo": "김치찌개",\n  "description": "간단한 설명",\n  "ingredients": ["재료1", "재료2"],\n  "steps": ["멸치 다시마 육수 만들기", "돼지고기 볶아서 김치와 함께 끓이기"],\n  "minutes": 30,\n  "difficulty": "쉬움",\n  "servings": 2,\n  "tags": ["한식"]\n}\n\n주의: steps 배열에는 번호(1., 2., 3.) 없이 순수한 조리 단계만 작성하세요.`;
  }

  /**
   * 처음부터 레시피 생성을 위한 프롬프트 생성
   */
  buildScratchPrompt(query: string, allergies: string[]): string {
    const allergyWarning = allergies.length > 0 
      ? `⚠️ 금지 재료: ${allergies.join(', ')}` 
      : '';

    return `"${query}" 레시피를 JSON으로 생성해주세요.\n${allergyWarning}\n\n반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):\n{\n  "name": "Recipe Name",\n  "nameKo": "레시피명",\n  "description": "간단한 설명",\n  "ingredients": ["재료1", "재료2"],\n  "steps": ["재료 손질하기", "볶아서 끓이기"],\n  "minutes": 30,\n  "difficulty": "쉬움",\n  "servings": 2,\n  "tags": ["태그1"]\n}\n\n주의: steps 배열에는 번호(1., 2., 3.) 없이 순수한 조리 단계만 작성하세요.`;
  }

  /**
   * AI 응답에서 레시피 JSON 파싱
   */
  parseRecipeResponse(response: string): ElasticsearchRecipe | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const jsonString = jsonMatch[0]
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(jsonString);

      if (this.isValidRecipe(parsed)) {
        return this.normalizeRecipe(parsed);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 파싱된 레시피를 표준 형식으로 정규화
   */
  private normalizeRecipe(parsed: any): ElasticsearchRecipe {
    return {
      id: `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: parsed.name || 'Generated Recipe',
      nameKo: parsed.nameKo || parsed.name || '생성된 레시피',
      nameEn: parsed.name || 'Generated Recipe',
      description: parsed.description || '맛있는 레시피입니다.',
      descriptionKo: parsed.description || '맛있는 레시피입니다.',
      descriptionEn: parsed.description || 'Delicious recipe.',
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      ingredientsKo: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      ingredientsEn: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      stepsKo: Array.isArray(parsed.steps) ? parsed.steps : [],
      stepsEn: Array.isArray(parsed.steps) ? parsed.steps : [],
      minutes: parsed.minutes || 30,
      difficulty: parsed.difficulty || '보통',
      servings: parsed.servings || 2,
      nIngredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.length : 0,
      nSteps: Array.isArray(parsed.steps) ? parsed.steps.length : 0,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      tagsKo: Array.isArray(parsed.tags) ? parsed.tags : [],
      tagsEn: Array.isArray(parsed.tags) ? parsed.tags : [],
      isAiGenerated: true,
      source: 'LangGraph_Workflow_v0.4',
      generationTimestamp: new Date().toISOString(),
      safetyScore: 100,
      isSafeForAllergies: true,
      allergenInfo: undefined,
      allergyRisk: 'high',
    };
  }

  /**
   * 레시피 유효성 검증
   */
  private isValidRecipe(parsed: unknown): parsed is ElasticsearchRecipe {
    if (!parsed || typeof parsed !== 'object') return false;

    const recipe = parsed as Record<string, unknown>;

    const hasRequiredFields = [
      'name', 'nameKo', 'description', 'ingredients', 'steps'
    ].every(field => field in recipe);

    if (!hasRequiredFields) return false;

    const hasArrayFields = ['ingredients', 'steps'].every(field => 
      Array.isArray(recipe[field])
    );

    return hasArrayFields;
  }

  /**
   * 에러 메시지 포맷팅
   */
  formatError(error: Error, context?: string): string {
    const contextInfo = context ? `[${context}] ` : '';
    return `${contextInfo}오류가 발생했습니다: ${error.message}`;
  }

  /**
   * 성공 메시지 포맷팅
   */
  formatSuccess(message: string, data?: any): string {
    const dataInfo = data ? `\n데이터: ${JSON.stringify(data, null, 2)}` : '';
    return `✅ ${message}${dataInfo}`;
  }

  /**
   * 진행 상태 메시지 포맷팅
   */
  formatProgress(step: string, current: number, total: number): string {
    const percentage = Math.round((current / total) * 100);
    return `⏳ ${step} (${current}/${total}, ${percentage}%)`;
  }

  /**
   * 시간 포맷팅
   */
  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`;
    } else {
      return `${seconds}초`;
    }
  }

  /**
   * 메타데이터 포맷팅
   */
  formatMetadata(metadata: any): string {
    if (!metadata) return '';

    const lines = [];
    
    if (metadata.searchTime) {
      lines.push(`검색 시간: ${this.formatDuration(metadata.searchTime)}`);
    }
    
    if (metadata.generationTime) {
      lines.push(`생성 시간: ${this.formatDuration(metadata.generationTime)}`);
    }
    
    if (metadata.totalTime) {
      lines.push(`총 시간: ${this.formatDuration(metadata.totalTime)}`);
    }

    if (metadata.recipeId) {
      lines.push(`레시피 ID: ${metadata.recipeId}`);
    }

    return lines.length > 0 ? `\n📊 처리 정보:\n${lines.join('\n')}` : '';
  }

  /**
   * 텍스트 청크 분할
   */
  chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * HTML 태그 제거
   */
  stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  /**
   * 마크다운 링크 제거
   */
  stripMarkdownLinks(text: string): string {
    return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  /**
   * 텍스트 길이 제한
   */
  truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}