# Debian 기반 이미지 사용
FROM node:20-bookworm

# 작업 디렉토리 설정
WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

# package.json과 pnpm-lock.yaml 복사
COPY package.json pnpm-lock.yaml* ./

# 의존성 설치
RUN pnpm install --frozen-lockfile

# Playwright 브라우저 및 시스템 의존성 설치
RUN pnpm exec playwright install --with-deps chromium

# 소스 코드 복사
COPY . .

# TypeScript 빌드
RUN pnpm build

# 로그 디렉토리 생성
RUN mkdir -p logs

# 포트 노출
EXPOSE 3000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 애플리케이션 실행
CMD ["pnpm", "start"]