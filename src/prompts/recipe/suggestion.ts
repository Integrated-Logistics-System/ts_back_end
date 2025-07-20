// src/prompts/recipe/suggestion.ts - 레시피 제안 및 대안 프롬프트

import { PromptTemplate } from '../types';

export const recipeSuggestionPrompt: PromptTemplate = {
  name: 'recipe_suggestion',
  description: '유사한 레시피 제안 및 대안 제시',
  variables: ['originalTitle', 'similarRecipes', 'allergyNote'],
  defaultValues: {
    allergyNote: ''
  },
  tags: ['recipe', 'suggestion', 'alternative'],
  template: `😔 죄송합니다. "{{originalTitle}}"에 대한 정확한 상세 정보를 찾을 수 없습니다.

🔍 **하지만 비슷한 레시피들을 찾았습니다:**

{{similarRecipes}}

💡 **이 중에 관심 있는 레시피가 있으시면 "○○ 자세히 알려줘"라고 말씀해주세요!**

🍳 **또는 새로운 레시피를 요청해주시면 맞춤형 레시피를 생성해드리겠습니다.**{{allergyNote}}`
};

export const noResultsPrompt: PromptTemplate = {
  name: 'no_results_response',
  description: '검색 결과가 없을 때의 응답',
  variables: ['query', 'allergyNote'],
  defaultValues: {
    allergyNote: ''
  },
  tags: ['recipe', 'no-results', 'fallback'],
  template: `😔 죄송합니다. "{{query}}"{{allergyNote}}에 맞는 레시피를 찾을 수 없습니다.

💡 **다시 시도해보세요**:
- 다른 재료명으로 검색
- 더 구체적인 요리명 사용
- 간단한 키워드로 검색

🍳 **새로운 레시피를 원하시면 언제든 요청해주세요!**`
};