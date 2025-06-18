# 🍽️ AI Recipe Assistant - 프론트엔드 통합 가이드

## 📋 개요

AI Recipe Assistant는 사용자의 알레르기 정보를 고려하여 안전한 레시피를 추천하는 AI 기반 서비스입니다. 검색 결과를 사용자 입력 언어에 맞춰 자동 번역하고 카드 형식으로 표시합니다.

## 🚀 주요 기능

- ✅ **다국어 지원**: 한국어/영어 자동 감지 및 번역
- ✅ **AI 워크플로우**: LangGraph 기반 지능형 검색 처리
- ✅ **알레르기 안전성**: 개인 알레르기 프로필 기반 필터링
- ✅ **카드 형식 UI**: 모던한 카드 레이아웃으로 레시피 표시
- ✅ **실시간 번역**: 검색어 및 결과의 실시간 언어 변환

## 📁 파일 구조

```
backend/src/modules/recipe/
├── components/           # React 컴포넌트 (프론트엔드 참고용)
│   ├── RecipeCard.tsx           # 레시피 카드 컴포넌트
│   ├── SearchResults.tsx        # 검색 결과 표시 컴포넌트
│   └── RecipeSearchApp.tsx      # 메인 앱 컴포넌트
├── interfaces/          # TypeScript 인터페이스
│   ├── recipe-response.interface.ts    # 백엔드 응답 타입
│   └── frontend-types.interface.ts     # 프론트엔드 컴포넌트 props
├── utils/
│   └── api-client.ts            # API 클라이언트 및 React Hooks
├── dto/
│   └── recipe.dto.ts            # 요청/응답 DTO
└── ... (기타 백엔드 파일들)
```

## 🔧 API 엔드포인트

### 주요 검색 API

```typescript
// 1. 통합 검색 (AI 워크플로우 포함)
GET /recipes/search?query=파스타&limit=10

// 응답 형식
{
  "recipes": [
    {
      "id": 123,
      "name": "크림 파스타",           // 번역된 이름
      "originalName": "Cream Pasta",   // 원본 이름
      "description": "부드러운 크림 소스 파스타",
      "ingredients": ["파스타", "크림", "버터"],
      "minutes": 25,
      "n_ingredients": 8,
      "n_steps": 6,
      "difficulty": "쉬움",
      "nutrition": {
        "calories": 450,
        "fat": 18,
        "protein": 12,
        "carbs": 58
      },
      "isTranslated": true,
      "isSafeForUser": true
    }
  ],
  "total": 45,
  "ai_response": "파스타 요리 중에서 크림 베이스의 부드러운 요리들을 추천드립니다...",
  "workflow_steps": [
    "✅ input_analyzed",
    "✅ translated", 
    "✅ search_completed",
    "✅ results_translated"
  ],
  "query_info": {
    "original": "파스타",
    "translated": "pasta",
    "final": "pasta",
    "language": "ko"
  }
}
```

### 기타 유용한 API

```typescript
// 2. 재료 기반 검색
POST /recipes/by-ingredients
{
  "ingredients": ["chicken", "rice"],
  "excludeAllergens": ["글루텐함유곡물"],
  "limit": 10
}

// 3. 카테고리별 조회
GET /recipes/popular?limit=10        // 인기 레시피
GET /recipes/healthy?limit=10        // 건강한 레시피
GET /recipes/low-calorie?maxCalories=300&limit=10  // 저칼로리

// 4. 개인 맞춤 추천
GET /recipes/recommendations/user123?allergies=글루텐함유곡물,우유

// 5. 레시피 상세 조회
GET /recipes/123
```

## 📦 프론트엔드 사용 방법

### 1. API 클라이언트 사용

```typescript
import { useRecipeSearch, useUserAllergies, useFavorites } from './utils/api-client';

function RecipeSearchPage() {
  const { search, loading, error, results } = useRecipeSearch();
  const { allergies } = useUserAllergies();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const handleSearch = async (query: string) => {
    await search({
      query,
      excludeAllergens: allergies,
      limit: 12
    });
  };

  return (
    <div>
      {/* 검색 입력 */}
      <SearchInput onSearch={handleSearch} />
      
      {/* 검색 결과 */}
      <SearchResults
        results={results}
        loading={loading}
        error={error}
        userAllergies={allergies}
        favoriteRecipes={favorites}
        onRecipeClick={(id) => console.log('Recipe clicked:', id)}
        onFavorite={toggleFavorite}
      />
    </div>
  );
}
```

### 2. 레시피 카드 컴포넌트

```typescript
import RecipeCard from './components/RecipeCard';

function RecipeList({ recipes, userAllergies = [] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          language="ko"
          userAllergies={userAllergies}
          onClick={(id) => navigateToRecipe(id)}
          onFavorite={(id) => handleFavorite(id)}
          isFavorite={favoriteRecipes.includes(recipe.id)}
        />
      ))}
    </div>
  );
}
```

### 3. AI 응답 표시

```typescript
import { AIResponse } from './components/SearchResults';

function SearchPage({ searchResults }) {
  return (
    <div>
      {/* AI 응답 및 워크플로우 정보 */}
      <AIResponse 
        response={searchResults.ai_response}
        queryInfo={searchResults.query_info}
        workflowSteps={searchResults.workflow_steps}
        showDetails={false}
      />
      
      {/* 레시피 목록 */}
      <RecipeList recipes={searchResults.recipes} />
    </div>
  );
}
```

## 🎨 스타일링 가이드

### Tailwind CSS 클래스

```css
/* 레시피 카드 */
.recipe-card {
  @apply bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200;
}

/* 영양소 배지 */
.nutrition-badge {
  @apply bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs;
}

/* 알레르기 경고 */
.allergy-warning {
  @apply bg-red-100 border border-red-300 text-red-800 px-2 py-1 rounded text-xs font-semibold;
}

/* 난이도 배지 */
.difficulty-easy {
  @apply bg-green-100 text-green-800 px-2 py-1 rounded text-xs;
}
.difficulty-medium {
  @apply bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs;
}
.difficulty-hard {
  @apply bg-red-100 text-red-800 px-2 py-1 rounded text-xs;
}
```

## 🔒 보안 및 사용자 데이터

### 로컬 스토리지 데이터

```typescript
// 사용자 알레르기 정보
localStorage.getItem('user-allergies')  // ["글루텐함유곡물", "우유"]

// 즐겨찾기 레시피
localStorage.getItem('recipe-favorites')  // [123, 456, 789]
```

### 프라이버시 보호

- ✅ **로컬 LLM 사용**: 개인정보가 외부로 전송되지 않음
- ✅ **클라이언트 저장소**: 알레르기 정보는 브라우저 로컬에만 저장
- ✅ **암호화되지 않은 저장**: 민감한 정보는 localStorage에 평문 저장

## 🧪 테스트 방법

### 1. 백엔드 API 테스트

```bash
# 프로젝트 루트에서 실행
cd /Users/choeseonghyeon/smart-recipe-chatbot/backend
chmod +x test-recipe-api.sh
./test-recipe-api.sh
```

### 2. 개별 API 테스트 예시

```bash
# 한국어 검색 테스트
curl -s "http://localhost:3000/recipes/search?query=파스타&limit=3" | jq '.'

# 영어 검색 테스트
curl -s "http://localhost:3000/recipes/search?query=chicken&limit=3" | jq '.'

# 재료 기반 검색 테스트
curl -s -X POST "http://localhost:3000/recipes/by-ingredients" \
  -H "Content-Type: application/json" \
  -d '{"ingredients": ["chicken", "rice"], "limit": 3}' | jq '.'
```

## 🚀 배포 및 환경 설정

### 환경 변수

```env
# .env.local (프론트엔드)
REACT_APP_API_BASE_URL=http://localhost:3000

# .env (백엔드)
MONGODB_PASSWORD=RecipeAI2024!
REDIS_PASSWORD=RecipeAI2024!
ELASTICSEARCH_URL=http://localhost:9200
OLLAMA_URL=http://localhost:11434
```

### Docker 서비스 시작

```bash
# 백엔드 디렉토리에서
cd /Users/choeseonghyeon/smart-recipe-chatbot/backend
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
```

## 📊 워크플로우 이해

### LangGraph 검색 단계

1. **입력 분석**: 언어 감지 (한국어/영어/기타)
2. **번역**: 한국어 입력시 영어로 번역
3. **캐시 확인**: Redis에서 기존 결과 확인
4. **검색 실행**: Elasticsearch에서 레시피 검색
5. **결과 처리**: 영양정보 파싱, 난이도 계산
6. **결과 번역**: 한국어 입력시 결과를 한국어로 번역
7. **AI 응답**: Ollama로 자연스러운 응답 생성
8. **캐시 저장**: 향후 빠른 응답을 위해 캐시

### 번역 품질 향상

```typescript
// 번역 프롬프트 예시 (backend/src/shared/ollama/ollama.service.ts)
const systemPrompt = `
You are an English-Korean food translation specialist.
Translate English recipe names and descriptions to natural Korean.
Make it sound appetizing and natural in Korean.
Only return the Korean translation, nothing else.

Examples:
pasta -> 파스타
chicken curry -> 치킨 카레
beef stew -> 소고기 스튜
`;
```

## 🔧 트러블슈팅

### 일반적인 문제 해결

```typescript
// 1. API 연결 실패
const checkApiHealth = async () => {
  try {
    const response = await fetch('http://localhost:3000/health');
    console.log('API 상태:', response.ok ? '정상' : '오류');
  } catch (error) {
    console.error('API 서버가 실행되지 않았습니다:', error);
  }
};

// 2. 번역 실패시 폴백
const safeTranslation = (original: string, translated?: string) => {
  return translated && translated !== original ? translated : original;
};

// 3. 로딩 상태 관리
const [retryCount, setRetryCount] = useState(0);
const maxRetries = 3;

const searchWithRetry = async (query: string) => {
  try {
    await search({ query });
    setRetryCount(0);
  } catch (error) {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setTimeout(() => searchWithRetry(query), 1000 * retryCount);
    }
  }
};
```

### 성능 최적화

```typescript
// 1. 검색 디바운싱
import { useCallback, useEffect, useState } from 'react';
import { debounce } from 'lodash';

const useDebounceSearch = (searchFn: Function, delay: number = 500) => {
  const debouncedSearch = useCallback(
    debounce((query: string) => searchFn(query), delay),
    [searchFn, delay]
  );

  return debouncedSearch;
};

// 2. 결과 캐싱
const useSearchCache = () => {
  const [cache, setCache] = useState(new Map());
  
  const getCachedResult = (query: string) => cache.get(query);
  
  const setCachedResult = (query: string, result: any) => {
    setCache(prev => new Map(prev).set(query, result));
  };
  
  return { getCachedResult, setCachedResult };
};
```

## 📈 확장 가능성

### 추가 기능 아이디어

1. **음성 검색**: Web Speech API 연동
2. **이미지 인식**: 음식 사진으로 레시피 찾기
3. **영양소 추적**: 일일 칼로리 계산
4. **쇼핑 리스트**: 재료 목록 자동 생성
5. **요리 타이머**: 단계별 알림 기능

### 다국어 확장

```typescript
// 언어별 번역 함수 확장
const translateRecipe = async (text: string, targetLang: 'ko' | 'en' | 'ja' | 'zh') => {
  const prompts = {
    ko: 'Translate to natural Korean for Korean food culture',
    en: 'Translate to natural English',
    ja: 'Translate to natural Japanese',
    zh: 'Translate to simplified Chinese'
  };
  
  return await ollamaService.translateText(text, prompts[targetLang]);
};
```

## 📞 지원 및 문의

- **GitHub**: [프로젝트 저장소 링크]
- **문서**: [기술 문서 링크]
- **데모**: [라이브 데모 링크]

---

**이 가이드를 통해 AI Recipe Assistant의 카드 형식 레시피 표시 기능을 완전히 활용하실 수 있습니다!** 🎉
