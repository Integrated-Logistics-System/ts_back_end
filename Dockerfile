# Multi-stage build for NestJS backend
FROM node:24-alpine AS base

# Install system deps
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# ------------------------------
# Dependencies stage
# ------------------------------
FROM base AS deps

COPY package*.json ./
# Legacy peer deps 옵션으로 설치
RUN npm install

# ------------------------------
# Build stage
# ------------------------------
FROM base AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ------------------------------
# Production stage
# ------------------------------
FROM base AS runner

WORKDIR /app

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy only necessary files
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

USER nestjs

EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8081/api/recipes/all || exit 1

CMD ["npm", "run", "start:prod"]
