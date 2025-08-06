# 🚀 NestJS TypeScript Backend Dockerfile
ARG IMAGE_TAG=latest
FROM node:20-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치 (캐시 최적화)
# nest build를 위해 devDependencies를 포함한 모든 의존성을 설치합니다.
RUN npm install

# 소스 코드 복사
COPY . .

# TypeScript 빌드
RUN npm run build

# 최종 이미지 크기를 줄이기 위해 devDependencies를 삭제합니다.
RUN npm prune --production

# 🏃 Production 스테이지
FROM node:20-alpine AS production

# curl 설치 (헬스체크용)
RUN apk add --no-cache curl

# 보안을 위한 비특권 사용자
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app

# 빌드된 애플리케이션 복사
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# 포트 노출
EXPOSE 8081 8083

# 비특권 사용자로 실행
USER nestjs

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8081/api/auth/health || exit 1

# 애플리케이션 시작
CMD ["node", "dist/main"]
