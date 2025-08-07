# Ollama Service - Standalone Deployment

Recipe AI 백엔드를 위한 독립적인 Ollama LLM 서비스입니다.

## 🚀 빠른 시작

### 1. 서비스 시작
```bash
cd ollama
docker-compose up -d
```

### 2. 모델 설치
```bash
# 기본 모델 설치
docker-compose exec ollama ollama pull gemma3n:e2b

# 추가 모델 설치 (선택사항)
docker-compose exec ollama ollama pull llama3.2
docker-compose exec ollama ollama pull codellama
```

### 3. 상태 확인
```bash
# 서비스 상태
docker-compose ps

# 설치된 모델 목록
docker-compose exec ollama ollama list

# 로그 확인
docker-compose logs -f ollama
```

## 🔧 관리 명령어

### 모델 관리
```bash
# 모든 모델 목록
docker-compose exec ollama ollama list

# 모델 삭제
docker-compose exec ollama ollama rm gemma3n:e2b

# 모델 정보 확인
docker-compose exec ollama ollama show gemma3n:e2b
```

### 서비스 관리
```bash
# 서비스 중지
docker-compose down

# 서비스 재시작
docker-compose restart

# 볼륨까지 삭제 (모델 데이터도 삭제됨)
docker-compose down -v
```

## 🌐 접속 정보

- **로컬 접속**: http://localhost:11434
- **네트워크 접속**: http://192.168.0.112:11434
- **API 테스트**: http://localhost:11434/api/tags

## 📁 폴더 구조

```
ollama/
├── docker-compose.yml    # Docker Compose 설정
├── .env                 # 환경 변수
├── models/              # 로컬 모델 파일 (선택사항)
└── README.md           # 이 파일
```

## ⚙️ 설정 변경

### 포트 변경
`.env` 파일에서 `OLLAMA_PORT` 수정 후 재시작

### GPU 사용 (NVIDIA GPU 있을 경우)
1. `docker-compose.yml`에서 GPU 관련 주석 해제
2. NVIDIA Container Toolkit 설치 필요

### 메모리 제한
`docker-compose.yml`의 `resources` 섹션에서 조정

## 🔍 문제 해결

### 연결 실패 시
```bash
# 서비스 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs ollama

# 헬스체크 확인
docker-compose exec ollama curl http://localhost:11434/api/tags
```

### 모델 로딩 실패 시
```bash
# 모델 다시 설치
docker-compose exec ollama ollama pull gemma3n:e2b

# 컨테이너 재시작
docker-compose restart ollama
```

## 📊 성능 모니터링

```bash
# 리소스 사용량 확인
docker stats ollama-service

# 실시간 로그
docker-compose logs -f --tail=100 ollama
```