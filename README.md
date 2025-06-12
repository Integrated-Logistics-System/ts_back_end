# 🍳 Smart Recipe RAG Assistant

RAG + LangGraph 기반 개인 맞춤형 레시피 추천 AI 시스템

## 🎯 핵심 기능

- **🤖 AI 기반 자연어 질의응답**: "닭고기와 파로 뭘 만들지?" 같은 자연스러운 질문
- **🛡️ 실시간 알레르기 안전성 체크**: 19개 알레르기 항목 실시간 검증
- **🔍 지능형 레시피 검색**: Elasticsearch + 벡터 검색
- **📊 267,782개 레시피 데이터**: 실제 사용 가능한 대용량 데이터
- **⚡ LangGraph 워크플로우**: 체계적인 AI 의사결정 과정

## 🏗️ 기술 아키텍처

### Backend
- **Framework**: NestJS + TypeScript
- **AI**: Ollama (gemma3:1b-it-qat) + LangChain + LangGraph
- **Database**: MongoDB + Elasticsearch + Redis
- **API**: RESTful + WebSocket

### 데이터
- **RAW_recipes.csv**: 267,782개 레시피
- **allergen_ultra_clean.csv**: 15,244개 재료별 알레르기 정보

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 설정
```bash
# .env 파일이 이미 설정되어 있습니다
# MongoDB: 192.168.0.111:27017
# Elasticsearch: 192.168.0.111:9200
# Redis: 192.168.0.111:6379
# Ollama: 192.168.0.111:11434
```

### 3. 데이터 초기화
```bash
npm run setup
```

### 4. 서버 실행
```bash
npm run start:dev
```

## 📚 API 엔드포인트

### 사용자 관리
- `POST /users` - 사용자 생성
- `GET /users/:userId` - 사용자 조회
- `PUT /users/:userId/allergies` - 알레르기 프로필 업데이트

### 레시피 검색
- `GET /recipes/search?q=파스타` - 텍스트 검색
- `POST /recipes/by-ingredients` - 재료 기반 검색
- `GET /recipes/popular` - 인기 레시피
- `GET /recipes/:id` - 레시피 상세

### AI 대화
- `POST /conversations/chat` - RAG 기반 질의응답
- `POST /rag/chat` - 고급 워크플로우 (LangGraph)
- `GET /conversations/:userId/history` - 대화 기록

### 알레르기 관리
- `POST /ingredients/check-allergies` - 알레르기 안전성 체크
- `GET /ingredients/allergies` - 사용 가능한 알레르기 목록
- `GET /ingredients/search` - 재료 검색

## 🔄 RAG 워크플로우

```
사용자 질의 → 재료 추출 → 알레르기 체크 → 레시피 검색 → 안전성 필터링 → AI 응답 생성
```

### LangGraph 단계
1. **재료 추출**: NER로 요리 재료 식별
2. **사용자 프로필**: 개인 알레르기 정보 조회
3. **안전성 검사**: 19개 알레르기 항목 교차 검증
4. **레시피 검색**: Elasticsearch 하이브리드 검색
5. **필터링**: 안전한 레시피만 선별
6. **응답 생성**: Ollama로 맞춤형 답변

## 🗄️ 데이터베이스 스키마

### MongoDB Collections

```javascript
// 사용자
users: {
  userId: string,
  name: string,
  allergies: string[],
  preferences: object,
  favoriteRecipes: string[]
}

// 레시피  
recipes: {
  id: number,
  name: string,
  ingredients: string[],
  steps: string[],
  allergyScore: number,
  tags: string[]
}

// 재료
ingredients: {
  ingredient_name: string,
  글루텐함유곡물: number,
  갑각류: number,
  // ... 19개 알레르기 필드
}
```

## 🎮 사용 예시

### 기본 질의
```bash
curl -X POST http://localhost:3001/conversations/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "message": "닭고기와 파가 있는데 뭘 만들 수 있을까?"
  }'
```

### 알레르기 체크
```bash
curl -X POST http://localhost:3001/ingredients/check-allergies \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": ["닭고기", "파", "우유"],
    "allergies": ["닭고기", "우유"]
  }'
```

## 🔧 개발 스크립트

```bash
# 개발 서버 실행
npm run start:dev

# 프로덕션 빌드
npm run build

# 데이터만 초기화
npm run init-data

# 테스트 실행
npm run test
```

## 📊 성능 지표

- **검색 응답시간**: < 200ms
- **알레르기 체크**: < 100ms  
- **AI 응답 생성**: < 3초
- **데이터 용량**: 267K+ 레시피, 15K+ 알레르기 정보

## 🛡️ 보안 및 안전성

- **로컬 LLM**: 개인정보 보호를 위한 온프레미스 AI
- **알레르기 검증**: 의료급 정확성을 위한 실시간 교차 체크
- **데이터 검증**: 15,244개 재료의 완전한 알레르기 정보

## 🔮 향후 계획

- [ ] 벡터 임베딩 검색 고도화
- [ ] 개인화 추천 알고리즘 개선
- [ ] 다국어 지원 (영어, 일본어)
- [ ] 이미지 기반 재료 인식
- [ ] 영양 정보 분석 기능

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

**Built with ❤️ for safer cooking experiences**