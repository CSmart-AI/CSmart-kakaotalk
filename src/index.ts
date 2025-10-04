import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { chatbotRouter } from "./routes/chatbot";
import { healthRouter } from "./routes/health";
import { messageRouter } from "./routes/message";
import { logger } from "./utils/logger";

// 환경 변수 로드
dotenv.config();

const app: express.Application = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(helmet());
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

// 서버 시작
app.listen(PORT, () => {
  logger.info(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`🚀 서버가 http://localhost:${PORT}에서 실행 중입니다.`);
});

export default app;
