import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { chatbotRouter } from "./routes/chatbot";
import { healthRouter, setKakaoTalkService } from "./routes/health";
import { messageRouter, setKakaoTalkService as setMessageKakaoTalkService } from "./routes/message";
import { KakaoTalkService } from "./services/kakaotalk.service";
import { logger } from "./utils/logger";

// 환경 변수 로드
dotenv.config();

const app: express.Application = express();
const PORT = process.env.PORT || 3000;

// KakaoTalk 서비스 인스턴스 생성
const kakaoTalkService = new KakaoTalkService();

// 헬스체크 라우터에 KakaoTalk 서비스 설정
setKakaoTalkService(kakaoTalkService);

// 메시지 라우터에 KakaoTalk 서비스 설정
setMessageKakaoTalkService(kakaoTalkService);

// 미들웨어 설정
// helmet()은 카카오톡 스킬 서버 응답에 문제를 일으킬 수 있으므로 완화
app.use(
  helmet({
    contentSecurityPolicy: false, // 카카오톡 스킬 서버 호환성
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// 로깅 미들웨어
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// 라우터 설정
app.use("/api/chatbot", chatbotRouter);
app.use("/api/message", messageRouter);
app.use("/api/health", healthRouter);

// 루트 엔드포인트
app.get("/", (_req, res) => {
  res.json({
    message: "CSmart 카카오톡 관리 서버",
    version: "1.0.0",
    status: "running",
  });
});

// 404 핸들러
app.use("*", (_req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "요청하신 엔드포인트를 찾을 수 없습니다.",
  });
});

// 에러 핸들러
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("서버 에러 발생:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "서버 내부 오류가 발생했습니다.",
  });
});

// 서버 시작 및 KakaoTalk 서비스 초기화
const startServer = async () => {
  try {
    // KakaoTalk 서비스 초기화
    logger.info("KakaoTalk 서비스 초기화 시작...");
    const initResult = await kakaoTalkService.initialize();

    if (!initResult.success) {
      logger.error("KakaoTalk 서비스 초기화 실패:", initResult.error);
      logger.warn("서버는 시작되지만 KakaoTalk 기능이 제한될 수 있습니다.");
    } else {
      logger.info("KakaoTalk 서비스 초기화 완료");
    }

    // 서버 시작
    app.listen(PORT, () => {
      logger.info(`서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`🚀 서버가 http://localhost:${PORT}에서 실행 중입니다.`);

      if (initResult.success) {
        console.log("✅ KakaoTalk 서비스가 준비되었습니다.");
      } else {
        console.log("⚠️  KakaoTalk 서비스 초기화에 실패했습니다.");
      }
    });

    // Graceful shutdown 처리
    process.on("SIGINT", async () => {
      logger.info("서버 종료 신호를 받았습니다. 정리 작업을 시작합니다...");
      await kakaoTalkService.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("서버 종료 신호를 받았습니다. 정리 작업을 시작합니다...");
      await kakaoTalkService.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error("서버 시작 중 오류 발생:", error);
    process.exit(1);
  }
};

// 서버 시작
startServer();

export default app;
