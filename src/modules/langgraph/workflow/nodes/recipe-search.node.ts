import { Injectable } from '@nestjs/common';
import { BaseNode } from './base.node';
import { GraphState } from '../workflow.builder';
import { ElasticsearchService, VectorSearchResponse } from '../../../elasticsearch/elasticsearch.service';

/**
 * Recipe Search Node
 * Handles recipe search queries with personalization using vector search
 */
@Injectable()
export class RecipeSearchNode extends BaseNode {
  constructor(private readonly elasticsearchService: ElasticsearchService) {
    super();
  }

  /**
   * Execute recipe search logic with vector search
   */
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`🔍 Recipe Search: "${state.query}"`);

    try {
      // Enhance query with user context
      const enhancedQuery = this.enhanceQueryWithUserContext(
        state.query, 
        state.userStatus
      );

      // Perform vector search with user preferences and allergies
      const searchResults = await this.elasticsearchService.vectorSearch({
        query: enhancedQuery,
        k: 5, // Return top 5 recipes
        preferences: this.extractUserPreferences(state.userStatus),
        allergies: this.extractUserAllergies(state.userStatus),
        useHybridSearch: true, // Use both vector and text search
        vectorWeight: 0.7,
        textWeight: 0.3,
        minScore: 0.3
      });

      // Generate response based on actual search results
      const response = this.formatSearchResultsResponse(
        searchResults, 
        enhancedQuery, 
        state.userStatus
      );

      this.logger.log(`✅ Vector search completed: ${searchResults.results.length} recipes found`);

      return { response };
      
    } catch (error) {
      this.logger.error('Vector search failed, falling back to simple response:', error);
      
      // Fallback to simple response if vector search fails
      const enhancedQuery = this.enhanceQueryWithUserContext(state.query, state.userStatus);
      const response = this.generateRecipeSearchResponse(enhancedQuery, state.userStatus);
      
      return { response };
    }
  }

  /**
   * Format vector search results into user-friendly response
   */
  private formatSearchResultsResponse(
    searchResults: VectorSearchResponse, 
    query: string, 
    userStatus?: string
  ): string {
    if (searchResults.results.length === 0) {
      return this.generateNoResultsResponse(query, userStatus);
    }

    let response = `"${query}"에 대한 **${searchResults.results.length}개의 맞춤 레시피**를 찾았습니다! 🍳\n\n`;

    // Add personalization context
    if (userStatus) {
      response += `🎯 **개인화 정보**: ${userStatus}\n\n`;
    }

    // Add search metadata
    response += `📊 **검색 정보**: ${searchResults.searchMethod} 검색 (${searchResults.searchTime}ms)\n\n`;

    // Format each recipe result
    searchResults.results.forEach((recipe, index) => {
      response += `**${index + 1}. ${recipe.name}** (⭐ ${recipe.averageRating?.toFixed(1) || 'N/A'})\n`;
      response += `   📖 ${recipe.description}\n`;
      response += `   ⏱️ ${recipe.minutes}분 | 🥄 ${recipe.servings || 'N/A'}인분 | 📊 ${recipe.difficulty}\n`;
      
      // Show similarity score
      if (recipe.combinedScore) {
        const similarity = ((recipe.combinedScore - 1) * 100).toFixed(1);
        response += `   🎯 유사도: ${similarity}%\n`;
      }
      
      // Show key ingredients (first 3)
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        const keyIngredients = recipe.ingredients.slice(0, 3).join(', ');
        response += `   🥘 주요 재료: ${keyIngredients}${recipe.ingredients.length > 3 ? ' 외...' : ''}\n`;
      }
      
      response += '\n';
    });

    // Add follow-up suggestions
    response += `💡 **더 자세한 정보**가 필요하시면 레시피 번호를 말씀해주세요!\n`;
    response += `🔍 **다른 검색**을 원하시면 새로운 키워드로 물어보세요.`;

    return response;
  }

  /**
   * Generate response when no results found
   */
  private generateNoResultsResponse(query: string, userStatus?: string): string {
    let response = `"${query}"에 대한 레시피를 찾지 못했습니다. 😅\n\n`;
    
    if (userStatus) {
      response += `🎯 개인화 정보: ${userStatus}\n\n`;
    }
    
    response += `💡 **다른 방법으로 시도해보세요**:\n`;
    response += `• 더 일반적인 키워드 사용 (예: "닭고기 요리" → "닭")\n`;
    response += `• 재료명으로 검색 (예: "감자", "양파", "돼지고기")\n`;
    response += `• 요리 종류로 검색 (예: "찌개", "볶음", "구이")\n\n`;
    response += `🔍 다시 검색해보시거나, 다른 요리에 대해 물어보세요!`;
    
    return response;
  }

  /**
   * Generate recipe search response (fallback method)
   */
  private generateRecipeSearchResponse(query: string, userStatus?: string): string {
    this.logger.log(`🍳 Generating recipe response for query="${query}" with userStatus="${userStatus || 'none'}"`);
    
    let response = `"${query}"에 대한 레시피를 찾고 있습니다.\n\n`;
    
    if (userStatus) {
      response += `🎯 개인화 정보: ${userStatus}\n`;
      response += `이 정보를 바탕으로 맞춤형 레시피를 추천해드리겠습니다.\n\n`;
    }
    
    response += `💡 더 정확한 추천을 위해 다음 정보를 추가로 알려주세요:
- 요리 시간 (예: 30분 이하)
- 선호하는 재료나 피하고 싶은 재료
- 요리 난이도 (초급/중급/고급)`;

    return response;
  }

  /**
   * Extract user preferences from user status
   * TODO: Implement sophisticated preference extraction
   */
  private extractUserPreferences(userStatus?: string): string[] {
    if (!userStatus) return [];
    
    const preferences: string[] = [];
    
    if (userStatus.includes('빠른')) {
      preferences.push('quick');
    }
    if (userStatus.includes('건강한')) {
      preferences.push('healthy');
    }
    if (userStatus.includes('매운맛 못')) {
      preferences.push('mild');
    }
    
    return preferences;
  }

  /**
   * Extract user allergies from user status
   * TODO: Implement sophisticated allergy extraction
   */
  private extractUserAllergies(userStatus?: string): string[] {
    if (!userStatus) return [];
    
    const allergies: string[] = [];
    
    if (userStatus.includes('견과류 알레르기')) {
      allergies.push('nuts');
    }
    if (userStatus.includes('유제품 못')) {
      allergies.push('dairy');
    }
    
    return allergies;
  }

  /**
   * Error response for recipe search failures
   */
  protected getErrorResponse(error: any, state: GraphState): string {
    return '죄송합니다. 레시피 검색 중 오류가 발생했습니다. 다시 시도해주세요.';
  }
}