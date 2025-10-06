import { Router } from "express";
import type { KakaoTalkService } from "../services/kakaotalk.service";
import { logger } from "../utils/logger";

const router: Router = Router();

// KakaoTalk 서비스 인스턴스 (실제로는 전역에서 가져와야 함)
let kakaoTalkService: KakaoTalkService | null = null;

/**
 * KakaoTalk 서비스 인스턴스 설정 (index.ts에서 호출)
 */
export const setKakaoTalkService = (service: KakaoTalkService) => {
  kakaoTalkService = service;
};

/**
 * 서버 상태 확인 엔드포인트
 */
router.get("/", (req, res) => {
  try {
    const kakaoTalkStatus = kakaoTalkService
      ? {
          isReady: kakaoTalkService.isServiceReady(),
          isLoggedIn: kakaoTalkService.isServiceReady(),
        }
      : {
          isReady: false,
          isLoggedIn: false,
          error: "KakaoTalk 서비스가 초기화되지 않았습니다.",
        };

    const healthCheck = {
      uptime: process.uptime(),
      message: "서버가 정상적으로 작동 중입니다.",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      services: {
        kakaoTalk: kakaoTalkStatus,
      },
    };

    // KakaoTalk 서비스가 준비되지 않은 경우 503 상태 반환
    const statusCode = kakaoTalkStatus.isReady ? 200 : 503;

    logger.info("헬스 체크 요청", {
      ip: req.ip,
      kakaoTalkReady: kakaoTalkStatus.isReady,
    });

    res.status(statusCode).json(healthCheck);
  } catch (error) {
    logger.error("헬스 체크 실패:", error);
    res.status(503).json({
      message: "서버 상태를 확인할 수 없습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as healthRouter };
