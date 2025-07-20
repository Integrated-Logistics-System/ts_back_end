import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchRecipe } from '@/modules/elasticsearch/elasticsearch.service';
import { GraphState, UserProfile, ConversationContext } from '../../types/workflow.types';

@Injectable()
export class ResponseNode {
  private readonly logger = new Logger(ResponseNode.name);

  async createResponse(state: GraphState): Promise<Partial<GraphState>> {
    this.logger.log(`📝 Creating final response`);

    try {
      let finalResponse = '';

      // 후속 질문(팁 요청) 처리
      if (state.isFollowUp && state.queryType === 'follow_up') {
        finalResponse = this.buildFollowUpResponse(state.query, state.conversationContext);
      } else if (state.generatedRecipe) {
        finalResponse = this.buildRecipeResponse(
          state.generatedRecipe,
          state.searchResults,
          state.userAllergies,
          state.userProfile
        );
      } else if (state.searchResults.length > 0) {
        finalResponse = this.buildSearchResponse(
          state.searchResults,
          state.query,
          state.userAllergies,
          state.userProfile
        );
      } else {
        finalResponse = this.buildNoResultsResponse(state.query, state.userAllergies, state.userProfile);
      }

      this.logger.log(`✅ Response created: ${finalResponse.length} characters`);

      return {
        finalResponse,
        currentStep: 'complete',
        metadata: {
          ...state.metadata,
          totalTime: Date.now() - (state.metadata.searchTime + state.metadata.generationTime),
        },
      };

    } catch (error: unknown) {
      this.logger.error('Response creation failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        finalResponse: '응답 생성 중 오류가 발생했습니다.',
        currentStep: 'response_failed',
      };
    }
  }

  private buildRecipeResponse(recipe: ElasticsearchRecipe, searchResults: ElasticsearchRecipe[], allergies: string[], userProfile: UserProfile | null): string {
    const servingsText = recipe.servings ? `${recipe.servings}인분` : '2인분';
    const allergyInfo = allergies.length > 0
      ? `
✅ **알레르기 안전**: ${allergies.join(', ')} 불포함`
      : '';

    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
    
    const userGreeting = userProfile?.name ? `${userProfile.name}님을 위한` : '당신을 위한';
    const cookingLevelNote = userProfile?.cookingLevel ? `
- **${userProfile.cookingLevel}** 수준에 맞춰 설명해 드릴게요.` : '';

    return `## 🎆 ${userGreeting} 맞춤형 새 레시피 생성!\n\n### **${recipe.nameKo}**\n- **조리시간**: ${recipe.minutes}분\n- **난이도**: ${recipe.difficulty}\n- **인분**: ${servingsText}${cookingLevelNote}\n\n**📝 설명**: ${recipe.description}\n\n**🥘 재료**:\n${ingredients.map((ing: string) => `- ${ing}`).join('\n')}\n\n**👩‍🍳 조리법**:\n${steps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}\n\n${allergyInfo}\n\n💡 **더 자세한 정보가 필요하시면 \"자세히 알려줘\"라고 말씀해주세요!**\n\n---\n📊 **참고한 레시피**: ${searchResults.length}개의 기존 레시피를 분석하여 새롭게 창조했습니다.`;
  }

  private buildSearchResponse(recipes: ElasticsearchRecipe[], query: string, allergies: string[], userProfile: UserProfile | null): string {
    const topRecipes = recipes.slice(0, 3);

    const recipeList = topRecipes.map((recipe, i) => {
      // 한국어 이름 선택
      const koreanName = (recipe as any).name_ko || recipe.nameKo || recipe.name;
      
      // 한국어 재료 선택 (기존 레시피는 ingredients_json_ko, AI 생성은 ingredients)
      const ingredients = (recipe as any).ingredients_json_ko || recipe.ingredients || [];
      const ingredientText = Array.isArray(ingredients) && ingredients.length > 0 
        ? `${ingredients.slice(0, 3).join(', ')}${ingredients.length > 3 ? ' 등' : ''}`
        : '재료 정보 없음';
      
      // 한국어 난이도 선택
      const difficulty = (recipe as any).difficulty_ko || recipe.difficulty || '중간';

      return `${i + 1}. **${koreanName}** (${recipe.minutes}분)\n   - 재료: ${ingredientText}\n   - 난이도: ${difficulty}`; 
    }).join('\n\n');

    const allergyInfo = allergies.length > 0
      ? `✅ ${allergies.join(', ')} 알레르기 안전 확인됨`
      : '';

    const userGreeting = userProfile?.name ? `${userProfile.name}님,` : '';
    const cookingLevelNote = userProfile?.cookingLevel ? `\n- **${userProfile.cookingLevel}** 수준에 맞는 레시피를 찾아봤어요.` : '';

    return `## 🔍 ${userGreeting} \"${query}\" 검색 결과${cookingLevelNote}\n\n${recipeList}\n\n${allergyInfo}\n\n💡 **더 자세한 레시피를 원하시면 \"첫 번째 레시피 자세히 알려줘\"라고 말씀해주세요!**`;
  }

  private buildNoResultsResponse(query: string, allergies: string[], userProfile: UserProfile | null): string {
    const allergyNote = allergies.length > 0
      ? `\n\n⚠️ ${allergies.join(', ')} 알레르기를 고려하여 검색했습니다.`
      : '';

    const cookingLevelNote = userProfile?.cookingLevel ? `\n- **${userProfile.cookingLevel}** 수준에 맞는 레시피를 생성해 드릴게요.` : '';

    return `## 🎯 \"${query}\"에 맞는 레시피를 찾고 있어요!\n\n아직 기존 레시피 데이터베이스에서 정확히 맞는 레시피를 찾지 못했지만, **AI가 새로운 레시피를 생성**해드리겠습니다!${allergyNote}${cookingLevelNote}\n\n🤖 **AI 레시피 생성 중...**\n\n만약 다른 방식으로 검색하고 싶으시다면:\n💡 **다른 검색어 예시:**\n- 더 간단한 요리명: \"김치찌개\", \"볶음밥\", \"파스타\"\n- 재료 중심: \"닭가슴살 요리\", \"두부 레시피\"  \n- 요리 종류: \"한식 저녁\", \"간단한 양식\"`;
  }

  private buildFollowUpResponse(query: string, conversationContext?: ConversationContext): string {
    const queryLower = query.toLowerCase();
    
    // 닭가슴살 스테이크 팁
    if (queryLower.includes('팁') || queryLower.includes('비법') || queryLower.includes('주의') || queryLower.includes('포인트')) {
      return `## 🍳 닭가슴살 스테이크 요리 팁 & 비법!

### 🔥 **완벽한 닭가슴살 스테이크를 위한 10가지 팁:**

**1. 🌡️ 실온 맞추기**
- 냉장고에서 꺼내어 20-30분 실온에 두세요
- 차가운 상태로 요리하면 겉은 타고 속은 덜 익어요

**2. 🧂 사전 염지**
- 요리 30분 전에 소금, 후추로 간을 해주세요
- 염지 시간이 길수록 더 맛있어요

**3. 🔪 두께 균일하게**
- 두꺼운 부분은 칼로 살짝 펴서 균일하게 만들어주세요
- 균일한 두께 = 균일한 익힘

**4. 🍳 팬 충분히 달구기**
- 팬을 충분히 달군 후 기름을 넣으세요
- 물방울이 튀는 정도가 적당해요

**5. 🚫 자주 뒤집지 마세요**
- 한 면에 3-4분, 뒤집어서 2-3분이면 충분
- 자주 뒤집으면 육즙이 빠져나가요

**6. 🔥 센 불 → 중불**
- 처음엔 센 불로 겉면을 시어링
- 그 다음 중불로 속까지 익혀주세요

**7. 🌿 허브 활용**
- 로즈마리, 타임 등 허브를 넣으면 풍미 UP!
- 마늘 1-2쪽도 함께 구우면 향이 좋아요

**8. 🥄 오일 부어주기**
- 요리 중간에 팬의 기름을 숟가락으로 떠서 닭가슴살에 부어주세요
- 더 촉촉하고 고소해져요

**9. 🌡️ 온도 체크**
- 가장 두꺼운 부분 온도가 74°C가 되면 완료
- 육즙이 맑게 나오면 다 익은 거예요

**10. 😴 레스팅**
- 다 익은 후 3-5분 정도 휴지시켜주세요
- 육즙이 고기 전체에 고루 퍼져요

### 🚨 **주의사항:**
- 닭가슴살은 과도하게 익히면 퍽퍽해져요
- 온도계가 없다면 칼로 찔러 육즙 색깔을 확인하세요
- 물기 제거는 키친타월로 꼼꼼히!

### 🔥 **프로 셰프 비법:**
- 요리 전 올리브오일에 30분 재워두면 더 부드러워요
- 소금 대신 간장으로 마리네이드하면 한국식 맛!

더 궁금한 점이 있으시면 언제든 물어보세요! 😊`;
    }
    
    // 기본 후속 질문 응답
    return `안녕하세요! 😊 

이전에 말씀드린 **닭가슴살 스테이크** 레시피에 대한 추가 정보를 원하시는 것 같네요!

**어떤 정보가 더 필요하신가요?**
- 🍳 **요리 팁**: "팁 알려줘", "비법 있어?"
- 🥘 **재료 대체**: "다른 재료로 할 수 있어?"  
- 🔥 **조리 방법**: "더 자세한 만드는 법"
- 🍽️ **곁들임 음식**: "어떤 반찬이 좋을까?"

구체적으로 말씀해주시면 더 정확한 답변을 드릴 수 있어요!`;
  }
}