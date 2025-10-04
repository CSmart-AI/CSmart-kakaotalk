import { Router } from "express";
import { logger } from "../utils/logger";

const router: Router = Router();

/**
 * 서버 상태 확인 엔드포인트
 */
router.get("/", (req, res) => {
  try {
    const healthCheck = {
      uptime: process.uptime(),
      message: "서버가 정상적으로 작동 중입니다.",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    };

    logger.info("헬스 체크 요청", { ip: req.ip });
    res.status(200).json(healthCheck);
  } catch (error) {
    logger.error("헬스 체크 실패:", error);
    res.status(503).json({
      message: "서버 상태를 확인할 수 없습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as healthRouter };
