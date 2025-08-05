# 🍳 Smart Recipe Chatbot - TypeScript Backend

AI 기반 개인화 레시피 추천 및 실시간 채팅 시스템

## 🌟 주요 기능

- **🤖 AI 채팅**: Simple ReAct Agent + Ollama 기반 실시간 레시피 상담
- **🔍 지능형 검색**: Elasticsearch 기반 알레르기 고려 레시피 검색
- **👤 개인화**: 사용자 프로필 기반 맞춤 추천
- **⚡ 실시간**: WebSocket 스트리밍 AI 응답
- **🔐 보안**: JWT 인증 + Redis 세션 관리
- **📊 분석**: 레시피 조회/평점/북마크 통계

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │◄──►│  TypeScript     │◄──►│   AI Services   │
│   (React)       │    │   Backend       │    │   (Ollama)      │
└─────────────────┘    │   (NestJS)      │    └─────────────────┘
                       └─────────────────┘
                              │
                   ┌──────────┼──────────┐
                   ▼          ▼          ▼
           ┌──────────┐ ┌───────────┐ ┌─────────┐
           │ MongoDB  │ │Elasticsearch│ │ Redis   │
           │(메인 DB) │ │  (검색)     │ │(캐시)   │
           └──────────┘ └───────────┘ └─────────┘
```

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 프로젝트 클론
git clone <repository-url>
cd smart-recipe-chatbot/ts_backend

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 실제 서버 정보 입력
```

### 2. 환경 변수 (.env)

```bash
# ==================== 데이터베이스 설정 ====================
MONGODB_URI=mongodb://recipe_admin:RecipeAI2024!@192.168.0.112:27017/recipe_ai_db
ELASTICSEARCH_URL=http://192.168.0.112:9200
REDIS_URL=redis://:RecipeAI2024!@192.168.0.112:6379

# ==================== AI 서비스 설정 ====================
OLLAMA_URL=http://localhost:11434
OLLAMA_LLM_MODEL=gemma3n:e4b
OLLAMA_MAX_TOKENS=4000

# ==================== 서버 설정 ====================
PORT=8081
WEBSOCKET_PORT=8083
NODE_ENV=development

# ==================== 보안 설정 ====================
JWT_SECRET=your-ultra-secure-secret-key
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

### 3. 개발 서버 실행

```bash
# 개발 모드 (hot reload)
npm run start:dev

# 프로덕션 빌드 후 실행
npm run build
npm run start:prod

# 디버그 모드
npm run start:debug
```

## 📊 데이터 초기화

### Elasticsearch 인덱스 생성

```bash
# 레시피 데이터 인덱싱
npm run elasticsearch:index

# 수동 실행
npx ts-node scripts/elasticsearch-indexer.ts
```

### MongoDB 데이터 정리

```bash
# 데이터 정리 스크립트
npm run cleanup:data
npm run cleanup:recipes
```

## 🔧 개발 도구

### 코드 품질

```bash
# 린팅
npm run lint

# 포맷팅
npm run format

# 타입 체크
npx tsc --noEmit
```

### 테스트 (구현 예정)

```bash
# 단위 테스트
npm test

# E2E 테스트  
npm run test:e2e

# 커버리지
npm run test:cov
```

## 📡 API 엔드포인트

### 🔐 인증 (Auth)

```
POST   /api/auth/register     # 회원가입
POST   /api/auth/login        # 로그인
POST   /api/auth/logout       # 로그아웃
GET    /api/auth/profile      # 프로필 조회
GET    /api/auth/health       # 헬스 체크
```

### 👤 사용자 (User)

```
GET    /api/user/profile      # 프로필 조회
PUT    /api/user/profile      # 프로필 수정
PUT    /api/user/allergies    # 알레르기 정보 수정
GET    /api/user/preferences  # 선호도 조회
PUT    /api/user/preferences  # 선호도 수정
```

### 🍽️ 레시피 (Recipe)

```
GET    /api/recipe/search          # 레시피 검색
GET    /api/recipe/:id             # 레시피 상세
GET    /api/recipe/popular         # 인기 레시피
GET    /api/recipe/personalized    # 개인화 추천
GET    /api/recipe/similar/:id     # 유사 레시피
POST   /api/recipe/:id/like        # 좋아요
POST   /api/recipe/:id/rate        # 평점
POST   /api/recipe/:id/bookmark    # 북마크
POST   /api/recipe/:id/cook        # 요리 완료 기록
```

### 🤖 AI 서비스 (AI)

```
POST   /api/chat                  # Simple ReAct Agent 채팅
POST   /api/chat/search           # 레시피 검색
GET    /api/chat/status           # Agent 상태
POST   /api/chat/suggestions      # 검색 제안
POST   /api/chat/keywords         # 키워드 추출
GET    /api/api/ai/status         # AI 서비스 상태
POST   /api/api/ai/generate       # AI 응답 생성
```

## 🌐 WebSocket 이벤트

### 연결 관리

```javascript
// 연결
socket.emit('join-chat');

// 상태 확인
socket.emit('ping');
socket.on('pong', (data) => console.log(data));
```

### Simple ReAct Agent 채팅

```javascript
// 일반 대화 메시지
socket.emit('conversation_message', { 
  message: '김치찌개 레시피 알려줘',
  sessionId: 'unique-session-id'
});

// 응답 수신
socket.on('conversation_response', (response) => {
  console.log('AI 응답:', response.content);
  console.log('추천 레시피:', response.recipeData);
  console.log('후속 제안:', response.suggestedFollowups);
});

// 스트리밍 채팅
socket.emit('conversation_stream', {
  message: '30분 안에 만들 수 있는 파스타',
  sessionId: 'stream-session-id'
});

// 스트리밍 응답 수신
socket.on('conversation_chunk', (chunk) => {
  if (chunk.type === 'token') {
    console.log('청크:', chunk.content);
  } else if (chunk.isComplete) {
    console.log('완료:', chunk.metadata);
  }
});

// 채팅 히스토리 조회
socket.emit('get_chat_history');
socket.on('chat_history', (data) => {
  console.log('히스토리:', data.messages);
});
```

## 🐳 Docker 배포

### 개발 환경

```bash
# 이미지 빌드
docker build -t smart-recipe-backend .

# 컨테이너 실행
docker run -p 8081:8081 -p 8083:8083 \
  --env-file .env \
  smart-recipe-backend
```

### Docker Compose (권장)

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "8081:8081"
      - "8083:8083"
    environment:
      - NODE_ENV=production
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
```

## 📁 프로젝트 구조

```
ts_backend/
├── src/
│   ├── modules/
│   │   ├── auth/           # JWT 인증 및 권한
│   │   ├── user/           # 사용자 관리
│   │   ├── recipe/         # 레시피 CRUD
│   │   ├── ai/             # Ollama AI 서비스 통합
│   │   ├── agent/          # Simple ReAct Agent 구현
│   │   ├── rag/            # RAG 검색 시스템
│   │   ├── websocket/      # 실시간 통신 (자동 환영 메시지)
│   │   ├── chat/           # 채팅 히스토리 관리
│   │   ├── cache/          # Redis 캐시
│   │   ├── database/       # MongoDB 연결
│   │   └── elasticsearch/  # ES 검색 서비스
│   ├── shared/            # 공통 DTO/인터페이스
│   │   ├── dto/           # 데이터 전송 객체
│   │   ├── interfaces/    # TypeScript 인터페이스
│   │   └── guards/        # 인증 가드
│   └── test/              # 테스트 파일 (예정)
├── scripts/               # 관리 스크립트
├── dist/                  # 빌드 결과물
├── logs/                  # 로그 파일
└── node_modules/
```

## 🔍 주요 모듈 설명

### 1. AI 모듈 (`/modules/ai/`)
- **다중 프로바이더 지원**: Ollama (Primary), OpenAI, Anthropic
- **폴백 시스템**: AI 서비스 실패 시 기본 응답
- **스트리밍**: 실시간 토큰 단위 응답

### 2. Simple ReAct Agent 모듈 (`/modules/agent/`)
- **단순한 ReAct 패턴**: 복잡한 LangGraph 대신 간단한 구현
- **3단계 처리**: 키워드 추출 → RAG 검색 → AI 응답 생성
- **자동 환영 메시지**: 사용자 프로필 기반 맞춤 인사

### 3. RAG 시스템 (`/modules/rag/`)
- **Elasticsearch 기반**: 한국어 레시피 검색 최적화
- **키워드 추출**: 자연어에서 요리 관련 키워드 식별
- **검색 제안**: 사용자 의도 기반 후속 검색어 생성

### 4. 레시피 모듈 (`/modules/recipe/`)
- **하이브리드 검색**: ES + MongoDB 결합
- **메타데이터 관리**: 조회수, 평점, 북마크
- **개인화**: 사용자별 추천 알고리즘

### 5. 인증 모듈 (`/modules/auth/`)
- **JWT 토큰**: 무상태 인증
- **Redis 세션**: 빠른 사용자 검증
- **권한 관리**: Role-based access control

## 📊 성능 최적화

### 캐싱 전략
- **Redis 세션**: 7일 TTL
- **메모리 캐시**: 폴백 시스템
- **ES 캐시**: 검색 결과 캐싱
- **AI 응답 캐시**: 동일 질문 빠른 응답

### 데이터베이스 최적화
- **MongoDB 인덱스**: 사용자, 레시피 최적화
- **ES 매핑**: 한국어 분석기 적용
- **커넥션 풀**: 동시 접속 처리

### 실시간 성능
- **WebSocket 스트리밍**: Chunk 단위 전송
- **비동기 처리**: Promise 기반 논블로킹
- **메모리 관리**: 자동 정리 시스템

## 🛡️ 보안 및 모니터링

### 보안 조치
- **JWT 토큰**: 안전한 인증
- **bcrypt**: 비밀번호 해싱 (salt 12)
- **CORS**: 적절한 도메인 제한
- **입력 검증**: class-validator 사용

### 개선 예정
- **Rate Limiting**: DoS 공격 방지
- **Helmet**: 보안 헤더 설정
- **데이터 Sanitization**: SQL/NoSQL 인젝션 방지

### 모니터링
- **NestJS Logger**: 구조화된 로깅
- **Health Check**: `/api/auth/health`
- **Error Tracking**: 예외 로그 수집

## 🐛 트러블슈팅

### 일반적인 문제

#### 1. AI 서비스 연결 실패
```bash
# Ollama 서비스 확인
curl http://localhost:11434/api/tags

# 모델 다운로드 및 확인
ollama pull gemma3n:e4b
ollama list
```

#### 2. Elasticsearch 연결 오류
```bash
# ES 서버 상태 확인
curl http://192.168.0.112:9200

# 인덱스 재생성
npm run elasticsearch:index
```

#### 3. Redis 캐시 문제
```bash
# Redis 연결 테스트
redis-cli -h 192.168.0.112 -a RecipeAI2024! ping

# 캐시 초기화
redis-cli -h 192.168.0.112 -a RecipeAI2024! flushall
```

#### 4. WebSocket 연결 문제
```bash
# 포트 확인
netstat -tulpn | grep 8083

# 방화벽 설정
sudo ufw allow 8083
```

### 로그 확인

```bash
# 애플리케이션 로그
tail -f logs/app.log

# Docker 로그
docker logs smart-recipe-backend

# 실시간 모니터링
npm run start:debug
```

## 📈 성능 벤치마크

### 현재 성능 지표
- **레시피 검색**: < 500ms (ES 인덱스 223,945개 레시피)
- **Simple Agent 처리**: 3-10s (Ollama gemma3n:e4b 로컬)
- **사용자 인증**: < 50ms (Redis 세션)
- **WebSocket 지연**: < 10ms (로컬 네트워크)
- **자동 환영 메시지**: 1s 지연 후 전송

### 최적화 목표
- **동시 사용자**: 1,000명 지원
- **응답 시간**: 95% 요청 < 500ms
- **가용성**: 99.9% 업타임
- **확장성**: 수평 확장 준비

## 🔄 향후 개발 계획

### 단기 (1-2주)
- [ ] 테스트 코드 작성 (Unit + E2E)
- [ ] Rate Limiting 구현
- [ ] Docker Compose 환경
- [ ] nginx 리버스 프록시

### 중기 (1-2개월)
- [ ] CI/CD 파이프라인 (GitHub Actions)
- [ ] 모니터링 시스템 (Prometheus + Grafana)
- [ ] 로그 집계 (ELK Stack)
- [ ] 백업/복구 자동화

### 장기 (3-6개월)
- [ ] 마이크로서비스 분할
- [ ] 쿠버네티스 배포
- [ ] 멀티 리전 지원
- [ ] AI 모델 자체 호스팅

## 🤝 기여 가이드

### 개발 환경 설정
1. Fork 후 로컬 클론
2. 브랜치 생성 (`feature/새기능`)
3. 코딩 스탠다드 준수
4. 테스트 코드 작성
5. PR 제출

### 코딩 규칙
- **TypeScript**: 엄격한 타입 정의
- **ESLint**: 린팅 규칙 준수
- **Prettier**: 코드 포맷팅
- **Conventional Commits**: 커밋 메시지 규칙

## 📞 지원 및 연락처

### 기술 지원
- **이슈 리포팅**: GitHub Issues
- **버그 제보**: 재현 가능한 상세 설명
- **기능 요청**: Use case와 함께 제안

### 개발팀
- **백엔드 개발**: TypeScript/NestJS 전문
- **AI 통합**: LangChain/LangGraph 경험
- **DevOps**: Docker/Kubernetes 운영

## 📄 라이센스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

---

### 🎯 **Quick Links**

- **📚 API 문서**: http://localhost:8081/api/docs
- **🔍 검색 테스트**: http://192.168.0.112:9200/recipes/_search
- **📊 Redis 모니터**: redis-cli -h 192.168.0.112 -a RecipeAI2024!
- **🤖 Ollama 상태**: http://localhost:11434/api/tags

### ⚡ **빠른 명령어**

```bash
# 전체 재시작
npm run start:dev

# 데이터 재인덱싱  
npm run elasticsearch:index

# 로그 실시간 확인
tail -f logs/app.log

# Ollama 모델 확인
ollama list
ollama pull gemma3n:e4b

# Simple Agent 테스트
curl -X POST http://localhost:8081/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "김치찌개 레시피 추천해줘"}'

# Docker 빌드 & 실행
docker build -t recipe-backend . && docker run -p 8081:8081 -p 8083:8083 recipe-backend
```

### 🎯 **Simple ReAct Agent 특징**

- **✅ 간단한 구조**: 복잡한 LangGraph 대신 3단계 ReAct 패턴
- **🦙 Ollama 통합**: 로컬 gemma3n:e4b 모델 사용
- **🔍 RAG 검색**: Elasticsearch 기반 레시피 검색
- **👋 자동 환영**: 사용자 프로필 기반 맞춤 인사
- **⚡ 빠른 응답**: 평균 3-10초 처리 시간

> **💡 Tip**: 개발 중 문제가 발생하면 먼저 Health Check 엔드포인트(`/api/auth/health`)를 확인하고, 각 서비스(MongoDB, ES, Redis, Ollama)의 연결 상태를 점검하세요. Simple Agent는 AI 서비스 실패 시 RAG 검색 결과를 기본 응답으로 사용합니다.