# 🍳 Smart Recipe Chatbot Backend

AI 기반 스마트 레시피 추천 챗봇의 NestJS 백엔드 서버

## 🛠 기술 스택

- **Framework**: NestJS + TypeScript
- **Database**: MongoDB 
- **Search Engine**: Elasticsearch
- **Cache**: Redis
- **AI/ML**: LangChain + LangGraph

## 🎯 주요 기능

- 레시피 CRUD API
- AI 기반 레시피 추천
- 실시간 채팅 (WebSocket)
- Elasticsearch 검색 엔진
- 사용자 선호도 관리

## 🚀 시작하기

### 설치 및 실행
```bash
npm install
npm run start:dev
```

### 환경 변수 (.env)
```env
DATABASE_URL=mongodb://localhost:27017/recipe-chatbot
ELASTICSEARCH_URL=http://localhost:9200
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_openai_api_key
PORT=3001
```

## 📡 API 엔드포인트

- `GET /recipes` - 레시피 조회
- `POST /recipes/search` - 재료 기반 검색
- `POST /recipes/recommend` - AI 추천
- `WebSocket /chat` - 실시간 채팅

## 📚 API 문서

Swagger: http://localhost:3001/api

## 🧪 테스트

```bash
npm run test
npm run test:e2e
```

## 📦 배포

```bash
docker build -t recipe-chatbot-backend .
docker run -p 3001:3001 recipe-chatbot-backend
```
