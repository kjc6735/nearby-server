# syntax=docker/dockerfile:1

# ── build: 의존성 설치 + Prisma 클라이언트 생성 + Nest 빌드 ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# postinstall의 prisma generate가 prisma.config.ts를 읽고, 그 안에서
# DATABASE_URL을 참조한다. 생성 단계에서는 실제 접속을 하지 않으므로 더미면 된다.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

# ── runtime: 운영 의존성과 빌드 결과만 담은 실행 이미지 ──
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# prisma CLI는 devDependency라 postinstall(prisma generate)이 돌 수 없다.
# 클라이언트는 builder에서 이미 만들어 dist에 컴파일돼 있으므로 스크립트를 끈다.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/main"]
