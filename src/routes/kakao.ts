import { Router } from "express";
import { z } from "zod";
import type { KakaoTalkService } from "../services/kakaotalk.service";
import { logger } from "../utils/logger";

const router: Router = Router();
let kakaoTalkService: KakaoTalkService;

/**
 * KakaoTalkService 인스턴스 설정 함수
 * @param service KakaoTalkService 인스턴스
 */
export const setKakaoTalkService = (service: KakaoTalkService): void => {
  kakaoTalkService = service;
};

// 카카오 로그인 검증 요청 스키마
const verifyLoginSchema = z.object({
  kakaoId: z.string().min(1, "카카오 계정 아이디는 필수입니다."),
  kakaoPassword: z.string().min(1, "카카오 계정 비밀번호는 필수입니다."),
});

/**
 * 카카오 계정 로그인 검증 엔드포인트 (임시 로그인)
 * POST 요청으로 카카오 계정 아이디와 비밀번호를 받아서 로그인 시도
 */
router.post("/verify-login", async (req, res) => {
  try {
    // 요청 데이터 검증
    const validatedData = verifyLoginSchema.parse(req.body);

    logger.info("카카오 로그인 검증 요청", {
      kakaoId: validatedData.kakaoId,
    });

    // Playwright를 통한 카카오톡 로그인 시도
    const loginSuccess = await kakaoTalkService.verifyKakaoLogin(
      validatedData.kakaoId,
      validatedData.kakaoPassword
    );

    if (loginSuccess) {
      logger.info("카카오 로그인 검증 성공", {
        kakaoId: validatedData.kakaoId,
      });

      res.status(200).json({
        success: true,
        message: "카카오 로그인 성공",
      });
    } else {
      logger.warn("카카오 로그인 검증 실패", {
        kakaoId: validatedData.kakaoId,
      });

      res.status(401).json({
        success: false,
        message: "카카오 로그인 실패",
      });
    }
  } catch (error) {
    logger.error("카카오 로그인 검증 중 오류 발생", error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "요청 데이터가 올바르지 않습니다.",
        errors: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "카카오 로그인 검증 중 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 카카오 계정 로그인 엔드포인트 (실제 로그인 - 세션 유지)
 * POST 요청으로 카카오 계정 아이디와 비밀번호를 받아서 로그인 후 세션 유지
 */
router.post("/login", async (req, res) => {
  try {
    // 요청 데이터 검증
    const validatedData = verifyLoginSchema.parse(req.body);

    logger.info("카카오 계정 로그인 요청", {
      kakaoId: validatedData.kakaoId,
    });

    // 기존 세션 종료 후 새로운 계정으로 로그인
    const loginSuccess = await kakaoTalkService.loginWithCredentials(
      validatedData.kakaoId,
      validatedData.kakaoPassword
    );

    if (loginSuccess) {
      logger.info("카카오 계정 로그인 성공", {
        kakaoId: validatedData.kakaoId,
      });

      res.status(200).json({
        success: true,
        message: "카카오 계정 로그인 성공",
      });
    } else {
      logger.warn("카카오 계정 로그인 실패", {
        kakaoId: validatedData.kakaoId,
      });

      res.status(401).json({
        success: false,
        message: "카카오 계정 로그인 실패",
      });
    }
  } catch (error) {
    logger.error("카카오 계정 로그인 중 오류 발생", error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "요청 데이터가 올바르지 않습니다.",
        errors: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "카카오 계정 로그인 중 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 카카오 계정 로그아웃 엔드포인트
 * POST 요청으로 현재 로그인된 세션 종료
 */
router.post("/logout", async (_req, res) => {
  try {
    logger.info("카카오 계정 로그아웃 요청");

    // 현재 브라우저 세션 종료
    await kakaoTalkService.logout();

    logger.info("카카오 계정 로그아웃 성공");

    res.status(200).json({
      success: true,
      message: "카카오 계정 로그아웃 성공",
    });
  } catch (error) {
    logger.error("카카오 계정 로그아웃 중 오류 발생", error);

    res.status(500).json({
      success: false,
      message: "카카오 계정 로그아웃 중 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as kakaoRouter };



