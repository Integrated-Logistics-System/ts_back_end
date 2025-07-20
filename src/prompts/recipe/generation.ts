// src/prompts/recipe/generation.ts - 새로운 레시피 생성 프롬프트

import { PromptTemplate } from '../types';

export const recipeGenerationPrompt: PromptTemplate = {
  name: 'recipe_generation',
  description: '기존 레시피를 참고하여 새로운 레시피 생성',
  variables: ['query', 'recipeContext', 'allergyWarning', 'preferenceText'],
  defaultValues: {
    allergyWarning: '',
    preferenceText: ''
  },
  tags: ['recipe', 'generation', 'creative'],
  template: `당신은 창의적이고 전문적인 AI 셰프입니다. 사용자의 요청에 맞는 새로운 레시피를 창조해주세요.

{{recipeContext}}

📋 레시피 생성 지침:
1. 위 참고 레시피들에서 영감을 받되, 완전히 새로운 레시피를 창조
2. 사용자 요청 "{{query}}"에 정확히 맞는 레시피
3. {{allergyWarning}}
4. {{preferenceText}}
5. 실제로 만들 수 있는 현실적인 레시피
6. 재료는 쉽게 구할 수 있는 것들로 구성
7. 조리 시간과 난이도를 적절히 설정

⚠️ 중요: 응답은 반드시 아래 JSON 형식으로만 작성해주세요:

{
  "name": "영어 레시피명",
  "nameKo": "한국어 레시피명",
  "description": "레시피에 대한 간단한 설명 (2-3문장)",
  "ingredients": [
    "재료1 (분량)",
    "재료2 (분량)",
    "재료3 (분량)"
  ],
  "steps": [
    "1단계: 구체적인 조리 방법",
    "2단계: 구체적인 조리 방법",
    "3단계: 구체적인 조리 방법"
  ],
  "minutes": 30,
  "difficulty": "쉬움|보통|어려움",
  "tags": ["태그1", "태그2", "태그3"],
  "servings": 2
}

반드시 위 JSON 형식으로만 응답하고, 다른 설명은 추가하지 마세요:`
};

export const recipeFromScratchPrompt: PromptTemplate = {
  name: 'recipe_from_scratch',
  description: '참고 레시피 없이 처음부터 레시피 생성',
  variables: ['query', 'allergyWarning'],
  defaultValues: {
    allergyWarning: ''
  },
  tags: ['recipe', 'generation', 'scratch'],
  template: `창의적인 AI 셰프로서 "{{query}}"에 맞는 완전히 새로운 레시피를 만들어주세요.

{{allergyWarning}}

JSON 형식으로만 응답:
{
  "name": "영어명",
  "nameKo": "한국어명",
  "description": "설명",
  "ingredients": ["재료1", "재료2"],
  "steps": ["1단계", "2단계"],
  "minutes": 30,
  "difficulty": "쉬움",
  "servings": 2,
  "tags": ["태그1"]
}`
};