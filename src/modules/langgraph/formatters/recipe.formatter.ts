import { Injectable } from '@nestjs/common';
import { ElasticsearchRecipe } from '@/modules/elasticsearch/elasticsearch.service';

@Injectable()
export class RecipeFormatter {
  
  /**
   * 새로 생성된 레시피를 마크다운 형식으로 포맷팅
   */
  formatGeneratedRecipe(recipe: ElasticsearchRecipe, searchResults: ElasticsearchRecipe[], allergies: string[]): string {
    const servingsText = recipe.servings ? `${recipe.servings}인분` : '2인분';
    const allergyInfo = allergies.length > 0
      ? `\n✅ **알레르기 안전**: ${allergies.join(', ')} 불포함`
      : '';

    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
    
    return `## 🎆 맞춤형 새 레시피 생성!\n\n### **${recipe.nameKo}**\n- **조리시간**: ${recipe.minutes}분\n- **난이도**: ${recipe.difficulty}\n- **인분**: ${servingsText}\n\n**📝 설명**: ${recipe.description}\n\n**🥘 재료**:\n${ingredients.map((ing: string) => `- ${ing}`).join('\n')}\n\n**👩‍🍳 조리법**:\n${steps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}\n\n${allergyInfo}\n\n💡 **더 자세한 정보가 필요하시면 "자세히 알려줘"라고 말씀해주세요!**\n\n---\n📊 **참고한 레시피**: ${searchResults.length}개의 기존 레시피를 분석하여 새롭게 창조했습니다.`;
  }

  /**
   * 검색된 레시피들을 리스트 형식으로 포맷팅
   */
  formatSearchResults(recipes: ElasticsearchRecipe[], query: string, allergies: string[]): string {
    const topRecipes = recipes.slice(0, 3);

    const recipeList = topRecipes.map((recipe, i) =>
      `${i + 1}. **${recipe.nameKo || recipe.name}** (${recipe.minutes}분)\n   - 재료: ${recipe.ingredients?.slice(0, 3).join(', ')}${recipe.ingredients?.length > 3 ? ' 등' : ''}\n   - 난이도: ${recipe.difficulty}`
    ).join('\n\n');

    const allergyInfo = allergies.length > 0
      ? `✅ ${allergies.join(', ')} 알레르기 안전 확인됨`
      : '';

    return `## 🔍 "${query}" 검색 결과\n\n${recipeList}\n\n${allergyInfo}\n\n💡 **더 자세한 레시피를 원하시면 "첫 번째 레시피 자세히 알려줘"라고 말씀해주세요!**`;
  }

  /**
   * 검색 결과가 없을 때의 메시지 포맷팅
   */
  formatNoResults(query: string, allergies: string[]): string {
    const allergyNote = allergies.length > 0
      ? `\n\n⚠️ ${allergies.join(', ')} 알레르기를 고려하여 검색했습니다.`
      : '';

    return `## 🔍 "${query}" 검색 결과\n\n죄송합니다. 조건에 맞는 레시피를 찾지 못했습니다.${allergyNote}\n\n💡 **다른 검색어로 시도해보세요:**\n- 더 간단한 요리명 (예: "김치찌개", "볶음밥")\n- 재료명 (예: "닭가슴살", "두부")\n- 요리 종류 (예: "한식", "양식")`;
  }

  /**
   * 레시피 상세 정보 포맷팅
   */
  formatRecipeDetails(recipe: ElasticsearchRecipe): string {
    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
    const tags = Array.isArray(recipe.tags) ? recipe.tags : [];

    return `## 📝 ${recipe.nameKo || recipe.name}\n\n**📖 설명**: ${recipe.description}\n\n**⏰ 조리시간**: ${recipe.minutes}분\n**👥 인분**: ${recipe.servings || 2}인분\n**⭐ 난이도**: ${recipe.difficulty}\n\n**🥘 재료 (${ingredients.length}개)**:\n${ingredients.map((ing: string, i: number) => `${i + 1}. ${ing}`).join('\n')}\n\n**👩‍🍳 조리법 (${steps.length}단계)**:\n${steps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}\n\n**🏷️ 태그**: ${tags.join(', ') || '없음'}`;
  }

  /**
   * 레시피 요약 정보 포맷팅
   */
  formatRecipeSummary(recipe: ElasticsearchRecipe): string {
    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const mainIngredients = ingredients.slice(0, 3);
    
    return `**${recipe.nameKo || recipe.name}** (${recipe.minutes}분, ${recipe.difficulty})\n재료: ${mainIngredients.join(', ')}${ingredients.length > 3 ? ' 등' : ''}`;
  }

  /**
   * 알레르기 정보 포맷팅
   */
  formatAllergyInfo(allergies: string[], isSafe: boolean): string {
    if (allergies.length === 0) return '';
    
    const status = isSafe ? '✅ 안전' : '⚠️ 위험';
    return `\n**🛡️ 알레르기 정보**: ${allergies.join(', ')} - ${status}`;
  }

  /**
   * 영양 정보 포맷팅 (확장 가능)
   */
  formatNutritionInfo(recipe: ElasticsearchRecipe): string {
    // 현재는 기본 정보만 표시, 향후 영양 정보 추가 가능
    return `\n**📊 기본 정보**:\n- 조리시간: ${recipe.minutes}분\n- 난이도: ${recipe.difficulty}\n- 인분: ${recipe.servings || 2}인분`;
  }

  /**
   * 유사 레시피 추천 포맷팅
   */
  formatSimilarRecipes(recipes: ElasticsearchRecipe[]): string {
    if (recipes.length === 0) return '';

    const similarList = recipes.slice(0, 3).map((recipe, i) =>
      `${i + 1}. ${recipe.nameKo || recipe.name} (${recipe.minutes}분)`
    ).join('\n');

    return `\n\n**🔗 유사한 레시피**:\n${similarList}`;
  }
}