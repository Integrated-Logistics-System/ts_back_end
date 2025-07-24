# 벡터 검색 API 가이드

## 🎯 개요

스마트 레시피 챗봇의 벡터 검색 전용 REST API입니다. 의미적 유사도 기반 레시피 검색을 제공하며, 768차원 granite-embedding 벡터를 사용하여 고정확도 검색을 지원합니다.

## 🚀 주요 기능

- **의미적 검색**: 키워드 매칭을 넘어선 의미 기반 레시피 검색
- **하이브리드 검색**: 벡터 검색 + 텍스트 검색 결합 (가중치 조절 가능)
- **개인화 필터링**: 사용자 알레르기, 선호도 기반 맞춤형 검색
- **성능 최적화**: Redis 기반 캐싱으로 빠른 응답 속도
- **유사 레시피 추천**: 특정 레시피와 유사한 다른 레시피 찾기
- **맞춤형 추천**: 사용자 프로필 기반 개인화 레시피 추천

## 📊 데이터 현황

- **총 레시피 수**: 226,764개
- **임베딩 벡터**: 768차원 granite-embedding:278m
- **검색 성능**: 평균 50-200ms (캐시 적중시 < 10ms)
- **지원 언어**: 한국어 우선, 영어 지원

## 🔗 API 엔드포인트

### Base URL
```
http://localhost:8081/api/vector-search
```

### Swagger 문서
```
http://localhost:8081/api/docs
```

---

## 📋 API 목록

### 1. 고급 벡터 검색 (POST)

**POST** `/search`

가장 강력한 검색 기능으로, 모든 옵션을 세밀하게 조절할 수 있습니다.

#### Request Body
```json
{
  "query": "김치찌개 레시피",
  "k": 10,
  "vectorWeight": 0.7,
  "textWeight": 0.3,
  "useHybridSearch": true,
  "minScore": 0.2,
  "allergies": ["nuts", "dairy"],
  "preferences": ["quick", "healthy"]
}
```

#### Response
```json
{
  "results": [
    {
      "id": "recipe_12345",
      "name": "김치찌개",
      "description": "한국의 대표적인 찌개 요리",
      "minutes": 30,
      "difficulty": "easy",
      "ingredients": ["김치", "돼지고기", "두부"],
      "averageRating": 4.5,
      "_score": 0.95,
      "vectorSimilarity": 0.85,
      "combinedScore": 0.90,
      "searchMethod": "hybrid"
    }
  ],
  "total": 150,
  "maxScore": 0.95,
  "searchTime": 125,
  "searchMethod": "hybrid",
  "metadata": {
    "vectorWeight": 0.7,
    "textWeight": 0.3,
    "queryEmbeddingTime": 45,
    "elasticsearchTime": 80,
    "k": 10
  }
}
```

### 2. 간단한 벡터 검색 (GET)

**GET** `/search?q={query}&k={count}&hybrid={boolean}&allergies={list}`

빠른 검색을 위한 GET 방식 엔드포인트입니다.

#### Example
```bash
curl "http://localhost:8081/api/vector-search/search?q=된장찌개&k=5&hybrid=true&allergies=nuts,dairy"
```

### 3. 유사한 레시피 검색

**GET** `/similar/{recipeId}?k={count}&allergies={list}`

특정 레시피와 유사한 다른 레시피들을 찾습니다.

#### Example
```bash
curl "http://localhost:8081/api/vector-search/similar/recipe_12345?k=5"
```

#### Response
```json
{
  "baseRecipe": {
    "id": "recipe_12345",
    "name": "김치찌개",
    "description": "..."
  },
  "similarRecipes": {
    "results": [...],
    "total": 25,
    "searchTime": 95
  }
}
```

### 4. 개인화된 레시피 추천

**POST** `/recommendations`

사용자 프로필을 기반으로 맞춤형 레시피를 추천합니다.

#### Request Body
```json
{
  "preferences": ["healthy", "quick", "korean"],
  "allergies": ["nuts", "shellfish"],
  "favoriteIngredients": ["chicken", "vegetables"],
  "dietaryRestrictions": ["vegetarian"],
  "difficulty": "easy",
  "maxCookTime": 30,
  "k": 10
}
```

### 5. 서비스 통계

**GET** `/stats`

벡터 검색 서비스의 현재 상태와 통계를 조회합니다.

#### Response
```json
{
  "elasticsearch": {
    "status": "healthy",
    "connection": true,
    "docCount": 226764
  },
  "embedding": {
    "status": "healthy",
    "model": "nomic-embed-text",
    "dimensions": 384
  },
  "totalRecipes": 226764,
  "indexedRecipes": 215326,
  "lastUpdate": "2024-01-20T10:30:00Z"
}
```

---

## 🗄️ 캐시 관리 API

### 캐시 상태 조회
**GET** `/cache/status`

### 캐시 무효화
**POST** `/cache/invalidate`

### 인기 검색어 조회
**GET** `/popular-queries?limit=10`

### 캐시 워밍업">**POST** `/cache/warmup`
```json
{
  "queries": ["김치찌개", "된장찌개", "불고기", "비빔밥", "삼겹살구이"]
}
```

---

## 🎛️ 검색 옵션 상세

### vectorWeight & textWeight
- **vectorWeight**: 벡터 유사도 가중치 (0.0~1.0, 기본값: 0.6)
- **textWeight**: 텍스트 검색 가중치 (0.0~1.0, 기본값: 0.4)
- 합계가 1.0일 필요는 없지만, 균형잡힌 검색을 위해 권장

### useHybridSearch
- **true**: 벡터 + 텍스트 검색 결합 (권장)
- **false**: 벡터 검색만 사용

### minScore
- 최소 유사도 임계값 (0.0~1.0)
- 낮은 품질의 결과 필터링

### k (결과 수)
- 반환할 최대 레시피 수
- 일반 검색: 1~50 (기본값: 10)
- 추천: 1~30 (기본값: 10)

### allergies
지원하는 알레르기 유형:
- `nuts` (견과류)
- `dairy` (유제품)
- `eggs` (달걀)
- `shellfish` (갑각류)
- `soy` (콩)
- `wheat` (밀)
- `fish` (생선)

### preferences
지원하는 선호도:
- `quick` (빠른 요리)
- `healthy` (건강한)
- `spicy` (매운맛)
- `mild` (순한맛)
- `korean` (한식)
- `western` (양식)
- `vegetarian` (채식)

---

## 🧪 테스트 방법

### 1. 기본 검색 테스트
```bash
curl -X POST "http://localhost:8081/api/vector-search/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "김치찌개 레시피",
    "k": 5,
    "useHybridSearch": true
  }'
```

### 2. 개인화 검색 테스트
```bash
curl -X POST "http://localhost:8081/api/vector-search/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "건강한 닭고기 요리",
    "k": 10,
    "allergies": ["nuts"],
    "preferences": ["healthy", "quick"]
  }'
```

### 3. 통계 확인
```bash
curl "http://localhost:8081/api/vector-search/stats"
```

### 4. 자동화된 테스트
```bash
# 프로젝트 루트에서
node -r ts-node/register test-vector-search-api.ts
```

---

## 🚨 에러 처리

### 일반적인 에러 응답
```json
{
  "message": "Vector search failed",
  "error": "Elasticsearch connection timeout",
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### 상태 코드
- `200`: 성공
- `400`: 잘못된 요청 (쿼리 누락, 잘못된 파라미터)
- `404`: 리소스 없음 (레시피 ID 존재하지 않음)
- `500`: 서버 오류 (Elasticsearch 연결 실패, 임베딩 생성 실패)

---

## ⚡ 성능 최적화

### 1. 캐싱 활용
- 동일한 검색 쿼리는 5분간 캐싱
- 캐시 적중시 10ms 미만 응답

### 2. 하이브리드 검색 권장
- 벡터 검색 + 텍스트 검색 결합
- 더 정확하고 robust한 결과

### 3. 적절한 k 값 설정
- UI 페이지네이션에 맞는 k 값 사용
- 너무 큰 k 값은 성능 저하 유발

### 4. 알레르기 필터 사전 적용
- 사용자 프로필의 알레르기 정보 활용
- 불필요한 결과 사전 제거

---

## 🔧 개발자 참고사항

### 의존성
- Elasticsearch 7.0+
- Redis (캐싱용)
- Ollama (임베딩 생성용, nomic-embed-text 모델)

### 환경 변수
```bash
ELASTICSEARCH_URL=http://localhost:9200
REDIS_URL=redis://localhost:6379
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=nomic-embed-text
```

### 로그 모니터링
```bash
# 벡터 검색 로그 확인
tail -f logs/vector-search.log | grep "Vector search"

# 캐시 적중률 확인
tail -f logs/vector-search.log | grep "Cache hit"
```

---

## 🎉 사용 예시

### React 프론트엔드 연동
```javascript
const searchRecipes = async (query, options = {}) => {
  const response = await fetch('/api/vector-search/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      k: 10,
      useHybridSearch: true,
      ...options
    })
  });
  
  return response.json();
};

// 사용법
const results = await searchRecipes('김치찌개', {
  allergies: ['nuts'],
  preferences: ['quick']
});
```

### WebSocket과의 연동
벡터 검색 결과를 WebSocket을 통해 실시간으로 스트리밍할 수 있습니다.

```javascript
socket.emit('vector_search', {
  query: '김치찌개 레시피',
  options: { k: 5, useHybridSearch: true }
});

socket.on('vector_search_result', (data) => {
  console.log('실시간 검색 결과:', data.results);
});
```

---

## 📈 향후 개선사항

1. **다국어 지원**: 영어, 중국어, 일본어 레시피 검색
2. **이미지 검색**: 음식 이미지 기반 유사 레시피 검색
3. **협업 필터링**: 사용자 행동 기반 추천 개선
4. **A/B 테스트**: 검색 알고리즘 성능 비교
5. **GraphQL 지원**: 더 유연한 데이터 요청

---

📧 **문의사항**: 벡터 검색 API 관련 문의는 개발팀에 연락바랍니다.