# 🍽️ AI Recipe Assistant - Backend

개인 알레르기 프로필 기반 안전한 레시피 추천 AI 시스템

## 📋 개요

이 프로젝트는 사용자의 알레르기 정보를 고려하여 안전한 레시피를 추천하는 AI 기반 백엔드 시스템입니다. LangGraph 워크플로우와 다국어 지원을 통해 지능형 레시피 검색 서비스를 제공합니다.

## 🚀 주요 기능

### ✅ 핵심 기능
- **개인 알레르기 프로필**: 19가지 알레르기 성분 기반 안전성 검증
- **AI 워크플로우**: LangGraph 기반 8단계 지능형 검색 처리
- **다국어 지원**: 한국어/영어 자동 감지 및 실시간 번역
- **카드 형식 응답**: 프론트엔드 친화적 구조화된 레시피 데이터
- **실시간 캐싱**: Redis 기반 고속 응답 시스템

### 🛡️ 알레르기 안전성
- 15,244개 재료의 완벽한 알레르기 정보 데이터베이스
- 실시간 안전성 점수 계산 (0-100점)
- 사용자별 맞춤 필터링

### 🤖 AI 기능
- **Ollama LLM**: 로컬 AI 모델 (Qwen2.5:0.5b)
- **자연어 처리**: 검색어 의도 분석 및 재료 추출
- **지능형 번역**: 컨텍스트 기반 음식 용어 번역
- **개인화 응답**: 사용자 상황에 맞는 자연스러운 조리 조언

## 🏗️ 시스템 아키텍처

### 기술 스택
```
Backend: NestJS + TypeScript
AI: Ollama (Qwen2.5) + LangChain
Database: Elasticsearch + MongoDB + Redis
Infrastructure: Docker Compose
```

### 데이터베이스 구조
```
📊 Elasticsearch (9200): 레시피 검색 + 벡터 인덱스
🍃 MongoDB (27017): 사용자 데이터 + 알레르기 정보  
⚡ Redis (6379): 캐싱 + 세션 관리
🤖 Ollama (11434): 로컬 LLM 서버
```

## 🚀 설치 및 실행

### 1. 환경 요구사항
```bash
- Docker & Docker Compose
- Node.js 18+
- 최소 16GB RAM (AI 모델용)
- 50GB+ 디스크 공간
```

### 2. 프로젝트 클론
```bash
git clone <repository-url>
cd smart-recipe-chatbot/backend
```

### 3. 환경 설정
```bash
# .env 파일 확인
cp .env.example .env

# 환경변수 설정
MONGODB_URI=mongodb://recipe_admin:RecipeDB_2024_Secure%239x7!@192.168.0.111:27017/recipe_ai_db
ELASTICSEARCH_URL=http://192.168.0.111:9200
REDIS_URL=redis://:RecipeAI2024!@192.168.0.111:6379
OLLAMA_URL=http://localhost:11434
PORT=3000
```

### 4. 의존성 설치
```bash
npm install
```

### 5. Docker 서비스 시작
```bash
# Docker Compose로 인프라 시작
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
```

### 6. 애플리케이션 실행
```bash
# 개발 모드
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod
```

## 🔧 API 엔드포인트

### 주요 검색 API

#### 1. 통합 검색 (AI 워크플로우)
```http
GET /recipes/search?query=파스타&limit=10&excludeAllergens=글루텐함유곡물

응답:
{
  "recipes": [
    {
      "id": 123,
      "name": "크림 파스타",
      "originalName": "Cream Pasta",
      "description": "부드러운 크림 소스 파스타",
      "ingredients": ["파스타", "크림", "버터"],
      "minutes": 25,
      "difficulty": "쉬움",
      "nutrition": { "calories": 450, "fat": 18 },
      "isTranslated": true,
      "isSafeForUser": true
    }
  ],
  "total": 45,
  "ai_response": "크림 베이스의 부드러운 파스타 요리를 추천드립니다...",
  "workflow_steps": ["✅ input_analyzed", "✅ translated", "✅ search_completed"],
  "query_info": {
    "original": "파스타",
    "translated": "pasta", 
    "language": "ko"
  }
}
```

#### 2. 재료 기반 검색
```http
POST /recipes/by-ingredients
{
  "ingredients": ["chicken", "rice"],
  "excludeAllergens": ["글루텐함유곡물"],
  "limit": 10
}
```

#### 3. 카테고리별 조회
```http
GET /recipes/popular?limit=10          # 인기 레시피
GET /recipes/healthy?limit=10          # 건강한 레시피  
GET /recipes/low-calorie?maxCalories=300  # 저칼로리
```

### 시스템 API
```http
GET /health                            # 헬스체크
GET /version                           # 버전 정보
POST /recipes/update-allergy-scores    # 알레르기 점수 업데이트
```

## 🧪 테스트

### API 테스트 실행
```bash
# 전체 API 테스트
chmod +x test-recipe-api.sh
./test-recipe-api.sh

# 개별 테스트
curl "http://localhost:3000/recipes/search?query=파스타&limit=3"
```

### 테스트 케이스
- ✅ 한국어/영어 검색
- ✅ 재료 기반 검색  
- ✅ 알레르기 필터링
- ✅ AI 워크플로우
- ✅ 번역 기능
- ✅ 캐싱 시스템

## 📊 LangGraph 워크플로우

### 8단계 처리 과정
```
1. 🔍 입력 분석    → 언어 감지 (한국어/영어)
2. 🌐 번역        → 한국어 → 영어 변환
3. 💾 캐시 확인    → Redis에서 기존 결과 조회
4. 🔍 검색 실행    → Elasticsearch 레시피 검색
5. ⚙️  결과 처리    → 영양정보 파싱, 난이도 계산
6. 🌐 결과 번역    → 영어 → 한국어 변환
7. 🤖 AI 응답     → 자연스러운 추천 메시지 생성
8. 💾 캐시 저장    → 30분간 결과 캐시
```

### 성능 최적화
- **캐시 히트율**: 85%+ (30분 TTL)
- **응답 시간**: < 500ms (캐시 히트시 < 100ms)
- **번역 정확도**: 90%+ (음식 용어 특화)

## 🔒 보안 및 개인정보 보호

### 데이터 보안
- ✅ **로컬 LLM**: 개인정보 외부 전송 없음
- ✅ **암호화된 저장**: MongoDB 사용자 데이터 암호화
- ✅ **API 검증**: Class-validator 기반 입력 검증
- ✅ **Rate Limiting**: 100req/min 제한

### 알레르기 데이터 보호
- 사용자별 개별 스키마
- 실시간 안전성 검증
- 오프라인 우선 처리

## 📈 모니터링 및 로그

### 헬스체크 정보
```json
{
  "status": "healthy",
  "services": {
    "ollama": {"status": "healthy"},
    "elasticsearch": {"status": "healthy"},
    "redis": {"status": "healthy"}
  },
  "uptime": 3600,
  "memory": {"used": 256, "total": 512}
}
```

### 로그 수준
- **ERROR**: 시스템 오류, AI 모델 실패
- **WARN**: 번역 실패, 캐시 미스
- **INFO**: 요청 처리, 워크플로우 단계
- **DEBUG**: 상세 AI 응답, 검색 쿼리

## 🔧 설정 및 최적화

### 환경별 설정
```typescript
// development
OLLAMA_MODEL=qwen2.5:0.5b          # 빠른 응답
CACHE_TTL=1800                     # 30분 캐시

// production  
OLLAMA_MODEL=llama3.2:1b          # 더 정확한 응답
CACHE_TTL=3600                    # 1시간 캐시
RATE_LIMIT=50                     # 엄격한 제한
```

### 성능 튜닝
```bash
# Elasticsearch 힙 메모리
ES_JAVA_OPTS="-Xms2g -Xmx2g"

# Redis 메모리 제한  
maxmemory 1gb
maxmemory-policy allkeys-lru

# MongoDB 인덱스 최적화
db.recipes.createIndex({"name": "text", "ingredients": 1})
```

## 🚀 배포

### Docker Compose 배포
```bash
# 프로덕션 환경
docker-compose -f docker-compose.prod.yml up -d

# 확장 배포 (클러스터)
docker-compose scale elasticsearch=3 redis=2
```

### 환경별 배포 전략
- **개발**: 로컬 Docker
- **스테이징**: AWS ECS + RDS
- **프로덕션**: Kubernetes + 외부 DB

## 📚 개발자 가이드

### 프론트엔드 연동
```typescript
// API 클라이언트 사용법
import { useRecipeSearch } from './utils/api-client';

const { search, loading, results } = useRecipeSearch();
await search({ query: '파스타', excludeAllergens: ['글루텐함유곡물'] });
```

### 새로운 워크플로우 노드 추가
```typescript
// 새 노드 구현
private async customProcessingNode(state: SearchWorkflowState): Promise<SearchWorkflowState> {
  // 커스텀 처리 로직
  return { ...state, step: 'custom_completed' };
}
```

## 🐛 트러블슈팅

### 일반적인 문제

#### 1. Ollama 연결 실패
```bash
# Ollama 서비스 확인
curl http://localhost:11434/api/tags

# 모델 다운로드
ollama pull qwen2.5:0.5b
```

#### 2. Elasticsearch 인덱스 오류
```bash
# 인덱스 재생성
curl -X DELETE http://localhost:9200/recipes
curl -X PUT http://localhost:9200/recipes -d @index-mapping.json
```

#### 3. 메모리 부족
```bash
# Docker 메모리 증가
docker-compose down
docker system prune -f
docker-compose up -d
```

## 📞 지원

### 문의 사항
- **기술 문의**: GitHub Issues
- **버그 리포트**: [이슈 템플릿]
- **기능 요청**: [피처 요청 템플릿]

### 기여 방법
1. Fork 저장소
2. 피처 브랜치 생성
3. 테스트 작성 및 실행
4. Pull Request 제출

---

**🎉 AI Recipe Assistant로 안전하고 맛있는 요리의 세계를 탐험해보세요!**
