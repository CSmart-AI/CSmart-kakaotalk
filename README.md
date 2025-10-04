# CSmart 카카오톡 관리 프로그램

카카오톡 메시지 자동화를 위한 서버 애플리케이션입니다.

## 주요 기능

- **카카오톡 챗봇 스킬**: 카카오톡 메시지 수신 시 알림 받기
- **메시지 자동 전송**: POST 요청으로 메시지 내용을 받아 Playwright를 통해 카카오톡 전송
- **Docker 지원**: 컨테이너화된 배포 환경

## 기술 스택

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Package Manager**: pnpm
- **Linter**: Biome
- **Automation**: Playwright
- **Container**: Docker

## 프로젝트 구조

```
src/
├── index.ts                 # 서버 진입점
├── routes/                  # API 라우터
│   ├── chatbot.ts          # 챗봇 스킬 엔드포인트
│   ├── message.ts          # 메시지 전송 엔드포인트
│   └── health.ts           # 헬스체크 엔드포인트
├── services/               # 비즈니스 로직
│   └── kakaotalk.service.ts # 카카오톡 서비스
└── utils/                  # 유틸리티
    └── logger.ts           # 로깅 설정
```

## 설치 및 실행

### 개발 환경

1. **의존성 설치**
   ```bash
   pnpm install
   ```

2. **개발 서버 실행**
   ```bash
   pnpm dev
   ```

3. **빌드**
   ```bash
   pnpm build
   ```

4. **프로덕션 실행**
   ```bash
   pnpm start
   ```

### Docker 환경

1. **Docker 이미지 빌드**
   ```bash
   pnpm docker:build
   ```

2. **Docker 컨테이너 실행**
   ```bash
   pnpm docker:run
   ```

3. **Docker Compose 사용**
   ```bash
   docker-compose up -d
   ```

## API 엔드포인트

### 헬스체크
- `GET /api/health` - 서버 상태 확인

### 메시지 전송
- `POST /api/message/send` - 카카오톡 메시지 전송
- `GET /api/message/status/:messageId` - 메시지 전송 상태 확인
- `GET /api/message/history` - 메시지 전송 이력 조회

## 사용 예시

### 메시지 전송 요청

```bash
curl -X POST http://localhost:3000/api/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "친구이름",
    "message": "안녕하세요! 자동으로 전송된 메시지입니다.",
    "messageType": "text"
  }'
```

## 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `NODE_ENV` | 실행 환경 | `development` |
| `PORT` | 서버 포트 | `3000` |

## 개발 가이드

### 코드 스타일
- Biome을 사용한 코드 포맷팅 및 린팅
- TypeScript strict 모드 사용
- 함수별 한국어 주석 작성

### 로깅
- Winston을 사용한 구조화된 로깅
- 개발/프로덕션 환경별 로그 레벨 설정

### 에러 처리
- Zod를 사용한 요청 데이터 검증
- 전역 에러 핸들러를 통한 일관된 에러 응답

## 라이선스

MIT
