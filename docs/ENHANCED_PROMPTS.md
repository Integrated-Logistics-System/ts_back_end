# 🍽️ AI Recipe Assistant - Enhanced Prompt Strategy

## 📋 현재 시스템 vs 개선된 프롬프트 전략

### 🔍 현재 시스템의 프롬프트들

#### 1. **번역 프롬프트** (한국어 → 영어)
```typescript
const translationPrompt = `
You are a professional translator. Translate the following cooking/recipe related text to English.
Only return the translated English text, nothing else.

Korean text to translate: "${text}"

English translation:`;
```

#### 2. **검색어 향상 프롬프트**
```typescript
const enhancePrompt = `
You are a recipe search expert. Given a user's cooking request, generate the best search keywords for finding recipes.
Return only the enhanced search keywords, nothing else.

User request: "${query}"

Enhanced search keywords:`;
```

#### 3. **레시피 설명 생성 프롬프트** (핵심!)
```typescript
const explanationPrompt = `
당신은 전문 요리사입니다. 사용자의 요청에 맞는 최적의 레시피를 추천하고 설명해주세요.

사용자 요청: "${originalQuery}"
검색된 레시피들:
${recipesContext}

다음 형식으로 ${languageInstruction}
1. 사용자 요청에 가장 적합한 레시피 추천 이유
2. 추천 레시피의 특징과 장점
3. 간단한 조리 팁 2-3개

응답:`;
```

---

## 🚀 개선된 프롬프트 전략

### **1. 통합 마스터 프롬프트 (JSON 출력)**

```typescript
const masterRecipePrompt = `
## 역할
당신은 세계적인 요리 전문가이자 영양사입니다. 사용자의 요리 요청을 분석하고 최적의 레시피를 추천하는 AI 어시스턴트입니다.

## 분석할 정보
**사용자 요청**: "${userQuery}"
**검색된 레시피들**:
${recipeContext}

## 출력 형식 (JSON)
다음 JSON 형식으로 정확히 응답해주세요:

{
  "analysis": {
    "userIntent": "사용자가 원하는 것 분석",
    "difficulty": "beginner|intermediate|advanced", 
    "mealType": "breakfast|lunch|dinner|snack|dessert",
    "cuisine": "Korean|Italian|Chinese|Japanese|etc",
    "timeConstraint": "사용자의 시간 제약 분석"
  },
  "recommendation": {
    "primaryChoice": {
      "recipeId": 1,
      "reason": "이 레시피를 1순위로 추천하는 구체적 이유",
      "highlights": ["주요 장점 1", "주요 장점 2", "주요 장점 3"]
    },
    "alternatives": [
      {
        "recipeId": 2, 
        "reason": "대안으로 추천하는 이유"
      }
    ]
  },
  "explanation": "사용자에게 보여줄 친근하고 상세한 설명 (200-300자)",
  "cookingTips": [
    "실용적인 조리 팁 1",
    "실용적인 조리 팁 2", 
    "실용적인 조리 팁 3"
  ],
  "nutritionInsights": [
    "영양학적 장점이나 주의사항"
  ],
  "variations": [
    "레시피 변형 아이디어 1",
    "레시피 변형 아이디어 2"
  ]
}

## 고려사항
- 사용자의 한국어 요청을 정확히 이해하고 문화적 맥락 고려
- 초보자도 따라할 수 있는 실용적인 조언 제공
- 재료 구입의 용이성과 비용 효율성 고려  
- 계절성과 지역 특산물 활용 권장
- 건강과 영양 균형 측면에서의 조언 포함
`;
```

### **2. 상황별 특화 프롬프트**

#### A. 빠른 요리 요청
```typescript
const quickCookingPrompt = `
당신은 바쁜 현대인을 위한 요리 전문가입니다. 
시간 제약이 있는 상황에서 최적의 레시피를 추천해주세요.

사용자 요청: "${query}"
제한 시간: ${timeLimit}분 이내
난이도: 초보자 수준

우선순위:
1. 조리 시간 최소화
2. 재료 준비의 간편성  
3. 영양 균형
4. 맛의 만족도

추천 형식:
- 주 레시피 1개 (시간 내 완성 가능)
- 시간 단축 팁 3개
- 미리 준비할 수 있는 것들
- 대체 재료 옵션
`;
```

#### B. 건강 중심 요청
```typescript
const healthFocusedPrompt = `
당신은 영양 전문가이자 헬스케어 요리사입니다.
건강을 고려한 맞춤형 레시피를 추천해주세요.

사용자 상황:
- 요청: "${query}"
- 건강 목표: ${healthGoal} (다이어트/근육증가/면역력강화/etc)
- 제한사항: ${restrictions} (알레르기/당뇨/고혈압/etc)

분석 요소:
1. 영양성분 균형 (탄수화물:단백질:지방 비율)
2. 칼로리 밀도
3. 미량 영양소 (비타민, 미네랄)
4. 섬유질과 수분 함량
5. 가공식품 의존도

추천 구성:
- 주 레시피 (영양 분석 포함)
- 영양학적 이점 설명
- 건강 효과 극대화 팁
- 주의사항 및 섭취 권장량
`;
```

### **3. 체인 프롬프트 전략**

```typescript
// 1단계: 의도 파악
const intentAnalysisPrompt = `
사용자 요청 "${query}"를 분석하여 다음을 파악하세요:
1. 주된 의도 (배고픔 해결/건강 관리/특별한 날/etc)
2. 긴급도 (즉시/여유있음/시간제약)
3. 난이도 선호 (간단함/도전적/상관없음)
4. 숨겨진 니즈 (영양/경제성/시간절약/etc)
`;

// 2단계: 레시피 매칭  
const recipeMatchingPrompt = `
의도 분석 결과: ${intentAnalysis}
검색된 레시피들: ${recipes}

각 레시피를 의도와 매칭하여 점수를 매기고 이유를 설명하세요.
`;

// 3단계: 설명 생성
const explanationPrompt = `
선택된 레시피들을 바탕으로 사용자에게 친근하고 이해하기 쉬운 설명을 작성하세요.
개인적인 경험담이나 재미있는 팁을 포함하여 매력적으로 구성하세요.
`;
```

## 📊 프롬프트 품질 개선 전략

### **A. 구조적 개선**
1. **명확한 역할 정의**: "당신은 X입니다"
2. **구체적인 지시사항**: "다음 형식으로 정확히"
3. **예시 제공**: 좋은 응답과 나쁜 응답 예시
4. **제약사항 명시**: 길이, 형식, 톤 등

### **B. 맥락 정보 강화**
```typescript
const enhancedContextPrompt = `
## 현재 상황
- 날짜: ${currentDate}
- 계절: ${season}
- 시간: ${timeOfDay}
- 날씨: ${weather}

## 사용자 프로필
- 요리 경험: ${cookingLevel}
- 식단 제한: ${dietaryRestrictions}
- 이전 선택: ${previousChoices}
- 선호 패턴: ${preferences}

## 문화적 맥락
- 지역: 한국
- 전통 식문화 고려
- 현대적 라이프스타일 반영
`;
```

### **C. 검증 및 개선 루프**
```typescript
const validationPrompt = `
생성된 응답을 다음 기준으로 검토:

1. ✅ 사용자 요청과 일치하는가?
2. ✅ 실행 가능한 조언인가?
3. ✅ 안전한 내용인가?
4. ✅ 문화적으로 적절한가?
5. ✅ 초보자가 이해할 수 있는가?

개선이 필요한 부분이 있다면 수정하세요.
`;
```

## 🎯 실제 적용 예시

### 사용자 요청: "간단한 아침식사"

#### 현재 시스템:
```
간단한 아침식사 → "simple breakfast" → Elasticsearch 검색 → 결과 설명
```

#### 개선된 시스템:
```typescript
1. 의도 파석: "바쁜 아침, 영양 중요, 시간 제약"
2. 컨텍스트: "평일 아침 7시, 혼자 식사, 초보자"
3. 매칭: 시간/영양/난이도 고려한 레시피 선별
4. 설명: 개인화된 친근한 톤으로 추천 이유 설명
5. 팁: 전날 미리 준비, 시간 단축 노하우 등
```

이렇게 개선하면 훨씬 더 정확하고 유용한 레시피 추천이 가능합니다! 🚀
