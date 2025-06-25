# AI Recipe Assistant Backend

RAG + LangChain 기반 레시피 추천 시스템 백엔드

## 🚀 빠른 시작

```bash
# 환경 변수 설정
cp .env.example .env

# 의존성 설치
npm install

# 개발 서버 실행
npm run start:dev
```

## 📊 데이터 초기화

```bash
# 알레르기 데이터 로딩
node load-allergens.js

# 레시피 데이터 로딩
node load-recipes.js
```

## 🛠 기술 스택

- **Framework**: NestJS + TypeScript
- **AI**: LangChain + Ollama
- **Database**: MongoDB + Elasticsearch + Redis
- **Auth**: JWT + bcrypt

## 📝 API 엔드포인트

- `GET /api/docs` - Swagger 문서
- `POST /api/auth/login` - 로그인
- `POST /api/recipe/search` - 레시피 검색
- `POST /api/allergen/check` - 알레르기 체크

## 🏗 아키텍처

```
Backend (NestJS) ↔ AI/DB Services
     ↓                    ↓
LangChain + Ollama    Redis + ES + MongoDB
```

## 🔧 환경 설정

```bash
# 필수 서비스
MONGODB_URI=mongodb://recipe_admin:RecipeAI2024!@192.168.0.111:27017/recipe_ai_db
ELASTICSEARCH_URL=http://192.168.0.111:9200
REDIS_URL=redis://:RecipeAI2024!@192.168.0.111:6379
OLLAMA_URL=http://localhost:11434
```

## 📈 성능

- 레시피 검색: < 100ms
- 알레르기 체크: < 50ms
- AI 응답: < 2s
