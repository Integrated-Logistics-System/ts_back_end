# 🛠️ 백엔드 개발 환경 설정 가이드

## 환경 설정 파일

### 🔧 개발 환경 (.env.dev)
- 로컬 Ollama 서버 연결
- 로컬/원격 Elasticsearch, Redis 연결
- 개발 전용 CORS 설정
- 디버그 모드 활성화

### 🚀 프로덕션 환경
- Docker 환경변수 또는 .env.prod 사용

## 개발 서버 실행

### 기본 개발 서버
```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 시작 (자동으로 .env.dev 사용)
npm run dev
# 또는
npm run start:dev

# 서버 주소:
# - API: http://localhost:8081
# - WebSocket: http://localhost:8083
```

### 디버그 모드
```bash
# 디버거 모드로 시작
npm run debug
# 또는  
npm run start:debug

# VS Code에서 "Attach to Node.js" 설정으로 디버깅 가능
```

## 필수 서비스 준비

### 1. Ollama 설치 및 실행
```bash
# macOS (Homebrew)
brew install ollama

# 서버 시작
ollama serve

# 모델 다운로드 (다른 터미널에서)
ollama pull gemma3n:e4b

# 확인
curl http://localhost:11434/api/tags
```

### 2. 서비스 연결 확인
```bash
# Elasticsearch
curl http://192.168.0.112:9200/_cluster/health

# Redis
redis-cli -h 192.168.0.112 -p 6379 -a RecipeAI2024! ping

# MongoDB Atlas (자동 연결)
```

## 개발용 npm 스크립트

| 명령어 | 설명 | 환경파일 |
|--------|------|----------|
| `npm run dev` | 개발 서버 (watch 모드) | `.env.dev` |
| `npm run debug` | 디버그 모드 | `.env.dev` |
| `npm run start:dev` | 개발 서버 (공식) | `.env.dev` |
| `npm run start:prod` | 프로덕션 서버 | 시스템 환경변수 |

## API 테스트

### 헬스 체크
```bash
# API 서버 상태
curl http://localhost:8081/health

# AI 서비스 상태  
curl http://localhost:8081/ai/status

# WebSocket 연결 테스트 (브라우저에서)
# ws://localhost:8083
```

### 주요 엔드포인트
```bash
# 채팅 메시지 전송 (WebSocket)
# 브라우저 콘솔에서:
const socket = io('http://localhost:8083');
socket.emit('conversation_message', {
  message: '김치찌개 레시피 알려줘',
  userId: 'test-user'
});
```

## 환경별 설정 차이

### 개발 환경 (.env.dev)
- `NODE_ENV=development`
- `DEBUG_MODE=true`
- `LOG_LEVEL=debug`
- `CORS_ORIGIN=http://localhost:3000,http://localhost:81`

### 프로덕션 환경
- `NODE_ENV=production`
- `DEBUG_MODE=false`
- `LOG_LEVEL=info`
- CORS 제한적 설정

## 트러블슈팅

### 1. Ollama 연결 실패
```bash
# Ollama 서버 상태 확인
ps aux | grep ollama

# 서버 재시작
ollama serve

# 포트 확인
lsof -i :11434
```

### 2. 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :8081  # API 포트
lsof -i :8083  # WebSocket 포트

# 프로세스 종료
kill -9 <PID>
```

### 3. 데이터베이스 연결 문제
```bash
# MongoDB Atlas 연결 테스트
# (연결 문자열이 올바른지 확인)

# Elasticsearch 연결 테스트  
curl http://192.168.0.112:9200

# Redis 연결 테스트
redis-cli -h 192.168.0.112 -p 6379 -a RecipeAI2024! ping
```

### 4. 로그 확인
```bash
# 개발 서버 로그는 콘솔에 실시간 출력
# 레벨별 로그 필터링은 LOG_LEVEL 환경변수로 조정
```

## VS Code 디버깅 설정

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "stopOnEntry": false,
      "protocol": "inspector"
    }
  ]
}
```

## 유용한 명령어

```bash
# 코드 포맷팅
npm run format

# 린팅
npm run lint

# 빌드
npm run build

# 프로덕션 빌드 실행
npm run start:prod
```

## 개발 워크플로우

1. **환경 설정**: `.env.dev` → `.env` 자동 복사
2. **서비스 시작**: Ollama, Elasticsearch, Redis 실행
3. **개발 서버**: `npm run dev`
4. **프론트엔드**: 별도 터미널에서 프론트엔드 개발 서버 시작
5. **테스트**: API 및 WebSocket 연결 확인

이제 `npm run dev` 한 번만 실행하면 개발 환경이 자동으로 설정됩니다! 🚀