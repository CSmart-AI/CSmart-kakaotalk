# CSmart 카카오톡 관리 프로그램

카카오톡 메시지 자동화를 위한 서버 애플리케이션입니다.

## 주요 기능

- **카카오톡 챗봇 스킬**: 카카오톡 메시지 수신 시 알림 받기
- **사용자 정보 전송**: 챗봇에서 받은 사용자 정보를 외부 서버로 POST 요청
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
│   ├── kakaotalk.service.ts # 카카오톡 자동화 서비스
│   └── user-info.service.ts # 사용자 정보 전송 서비스
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

#### 환경 변수 설정

Docker 실행 전에 카카오톡 로그인 정보를 환경 변수로 설정해야 합니다:

```bash
# 환경 변수 설정 (터미널에서)
export KAKAO_LOGIN_ID="your_kakao_id"
export KAKAO_LOGIN_PASSWORD="your_kakao_password"

# 또는 .env 파일 생성
echo "KAKAO_LOGIN_ID=your_kakao_id" > .env
echo "KAKAO_LOGIN_PASSWORD=your_kakao_password" >> .env
```

#### Docker Compose 사용 (권장)

1. **서비스 시작**
   ```bash
   docker compose up -d
   ```

2. **서비스 상태 확인**
   ```bash
   docker compose ps
   ```

3. **로그 확인**
   ```bash
   docker compose logs -f csmart-kakaotalk
   ```

4. **헬스체크 확인**
   ```bash
   curl http://localhost:3000/api/health
   ```

5. **서비스 중지**
   ```bash
   docker compose down
   ```

#### 개별 Docker 명령어

1. **Docker 이미지 빌드**
   ```bash
   docker build -t csmart-kakaotalk .
   ```

2. **Docker 컨테이너 실행**
   ```bash
   docker run -d \
     --name csmart-kakaotalk-server \
     -p 3000:3000 \
     -e KAKAO_LOGIN_ID="your_kakao_id" \
     -e KAKAO_LOGIN_PASSWORD="your_kakao_password" \
     -v $(pwd)/logs:/app/logs \
     csmart-kakaotalk
   ```

#### 중요 사항

- **로그인 세션 유지**: Docker 시작 시 한 번만 카카오톡에 로그인하고, 이후 메시지 전송 시에는 로그인 없이 기존 세션을 재사용합니다.
- **헬스체크**: `/api/health` 엔드포인트에서 KakaoTalk 서비스의 로그인 상태를 확인할 수 있습니다.
- **로그 확인**: `./logs/` 디렉토리에서 애플리케이션 로그를 확인할 수 있습니다.

## API 엔드포인트

### 헬스체크
- `GET /api/health` - 서버 상태 확인

### 챗봇 스킬
- `POST /api/chatbot/skill` - 카카오톡 챗봇 스킬 요청 처리
- `GET /api/chatbot/test-connection` - 사용자 정보 서버 연결 테스트
- `POST /api/chatbot/notifications/setup` - 알림 설정

### 메시지 전송
- `POST /api/message/send` - 카카오톡 메시지 전송
- `GET /api/message/status/:messageId` - 메시지 전송 상태 확인
- `GET /api/message/history` - 메시지 전송 이력 조회

## 사용 예시

### 챗봇 스킬 요청 (카카오톡에서 자동 호출)

카카오톡 챗봇에서 사용자가 메시지를 보내면 다음과 같은 JSON이 서버로 전송됩니다:

```json
{
  "intent": {
    "id": "l4mw9l01x4kul611vtly1w9b",
    "name": "블록 이름"
  },
  "userRequest": {
    "timezone": "Asia/Seoul",
    "params": {
      "ignoreMe": "true"
    },
    "block": {
      "id": "l4mw9l01x4kul611vtly1w9b",
      "name": "블록 이름"
    },
    "utterance": "발화 내용",
    "lang": null,
    "user": {
      "id": "363512",
      "type": "accountId",
      "properties": {}
    }
  },
  "bot": {
    "id": "68cbb775539054197042f1ab",
    "name": "봇 이름"
  },
  "action": {
    "name": "kjjj3jtdi6",
    "clientExtra": null,
    "params": {},
    "id": "nhx57fsbrkdbh8yg5ccdyb88",
    "detailParams": {}
  }
}
```

서버는 이 정보를 받아서 사용자 정보를 외부 서버로 POST 요청합니다. 현재는 시뮬레이션 모드로 로그에만 출력됩니다.

### 사용자 정보 서버 연결 테스트

```bash
curl -X GET http://localhost:3000/api/chatbot/test-connection
```

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

| 변수명 | 설명 | 기본값 | 필수 |
|--------|------|--------|------|
| `NODE_ENV` | 실행 환경 | `development` | ❌ |
| `PORT` | 서버 포트 | `3000` | ❌ |
| `LOG_LEVEL` | 로그 레벨 | `info` | ❌ |
| `KAKAO_LOGIN_ID` | 카카오톡 로그인 ID | - | ✅ |
| `KAKAO_LOGIN_PASSWORD` | 카카오톡 로그인 비밀번호 | - | ✅ |
| `BACKEND_SERVER_URL` | 사용자 정보 전송 서버 URL | `http://localhost:8080/api/users` | ❌ |
| `USER_INFO_SERVER_TIMEOUT` | 서버 연결 타임아웃 (ms) | `5000` | ❌ |

### 환경 변수 설정 예시

```bash
# .env 파일
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
KAKAO_LOGIN_ID=your_kakao_id
KAKAO_LOGIN_PASSWORD=your_kakao_password
BACKEND_SERVER_URL=http://your-server.com/api/users
USER_INFO_SERVER_TIMEOUT=5000
```

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

/api/message/chat-list
{
    "success": true,
    "message": "카카오톡에서 채팅 목록을 성공적으로 가져와서 저장했습니다.",
    "data": {
        "id": "chatlist_1759641484321",
        "savedAt": "2025-10-05T05:18:04.321Z",
        "totalCount": 2,
        "chatList": {
            "items": [
                {
                    "talk_user": {
                        "status_message": "",
                        "active": true,
                        "profile_image_url": "",
                        "chat_id": "4952763873902355",
                        "user_type": 0,
                        "nickname": "임경빈",
                        "original_profile_image_url": "",
                        "id": "4952763873902355_tuser",
                        "full_profile_image_url": ""
                    },
                    "last_seen_log_id": "3679609246841311233",
                    "created_at": 1759574173000,
                    "last_message": "테",
                    "is_replied": false,
                    "is_read": true,
                    "unread_count": 0,
                    "need_manager_confirm": false,
                    "is_deleted": false,
                    "updated_at": 1759580804000,
                    "id": "4952763873902355",
                    "assignee_id": 0,
                    "last_log_id": "3679609246841311233",
                    "is_done": false,
                    "user_last_seen_log_id": "3679609246841311233",
                    "version": 1759580804172,
                    "last_log_send_at": 1759580804140,
                    "is_blocked": false,
                    "is_starred": false,
                    "is_user_left": false,
                    "profile_id": "_TcdTn",
                    "encoded_profile_id": "_TcdTn",
                    "ai_flag": false,
                    "name": "임경빈",
                    "chat_label_ids": [],
                    "is_friend": true
                },
                {
                    "talk_user": {
                        "active": true,
                        "profile_image_url": "",
                        "chat_id": "4947898629963361",
                        "user_type": 0,
                        "nickname": "이성재",
                        "original_profile_image_url": "",
                        "id": "4947898629963361_tuser",
                        "full_profile_image_url": ""
                    },
                    "last_seen_log_id": "3663531541889001093",
                    "created_at": 1754822949000,
                    "last_message": "http://pf.kakao.com/_tzzAn\r\n\r\n\r\n\r\n안녕하세요, 관리는 제 개별 카카오톡 채널을 통해 진행될 예정입니다. 채널 추가 후 메세지 한번 남겨주시기 바랍니다.",
                    "is_replied": true,
                    "is_read": true,
                    "unread_count": 0,
                    "need_manager_confirm": false,
                    "is_deleted": false,
                    "updated_at": 1757664192000,
                    "id": "4947898629963361",
                    "assignee_id": 0,
                    "last_log_id": "3663531541889001093",
                    "is_done": false,
                    "user_last_seen_log_id": "3663531541889001093",
                    "version": 1757671152143,
                    "last_log_send_at": 1757664192355,
                    "is_blocked": false,
                    "is_starred": false,
                    "is_user_left": false,
                    "profile_id": "_TcdTn",
                    "encoded_profile_id": "_TcdTn",
                    "ai_flag": false,
                    "name": "이성재",
                    "chat_label_ids": [],
                    "is_friend": false,
                    "add_msg_layer_status": "close",
                    "check_add_friend_message": true
                }
            ],
            "has_next": false
        }
    }
}