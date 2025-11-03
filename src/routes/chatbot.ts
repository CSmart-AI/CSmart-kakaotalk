import { Router } from "express";
import { z } from "zod";
import { UserInfoService } from "../services/user-info.service";
import { logger } from "../utils/logger";

const router: Router = Router();

// 사용자 정보 전송 서비스 인스턴스
const userInfoService = new UserInfoService();

// 카카오톡 챗봇 스킬 요청 스키마
const chatbotSkillSchema = z.object({
  intent: z.object({
    id: z.string(),
    name: z.string(),
  }),
  userRequest: z.object({
    timezone: z.string().optional(),
    params: z.record(z.any()).optional(),
    block: z.object({
      id: z.string(),
      name: z.string(),
    }),
    utterance: z.string(),
    lang: z.string().nullable().optional(),
    user: z.object({
      id: z.string(),
      type: z.string(),
      properties: z.record(z.any()).optional(),
    }),
  }),
  bot: z.object({
    id: z.string(),
    name: z.string(),
  }),
  action: z.object({
    name: z.string(),
    clientExtra: z.any().nullable().optional(),
    params: z.record(z.any()).optional(),
    id: z.string(),
    detailParams: z.record(z.any()).optional(),
  }),
});

/**
 * 카카오톡 챗봇 스킬 엔드포인트
 * 카카오톡에서 메시지가 왔을 때 알림을 받는 기능
 * 
 * 중요: 카카오톡은 3~5초 내에 응답을 받아야 하므로,
 * 내부 API 호출은 비동기로 처리하고 카카오 응답은 즉시 반환합니다.
 */
router.post("/skill", async (req, res) => {
  try {
    // 요청 데이터 검증
    const validatedData = chatbotSkillSchema.parse(req.body);

    logger.info("카카오톡 챗봇 스킬 요청 받음", {
      userId: validatedData.userRequest.user.id,
      utterance: validatedData.userRequest.utterance || "";,
      actionName: validatedData.action.name,
      intentName: validatedData.intent.name,
      botName: validatedData.bot.name,
    });

    // 카카오톡 챗봇 응답 생성 (사용자에게 보이지 않는 빈 응답)
    // outputs 배열을 비우면 사용자에게 메시지가 표시되지 않음
    const kakaoResponse = {
      version: "2.0",
      template: {
        outputs: [], // 빈 배열 = 사용자에게 메시지 표시 안 함
      },
    };

    // 응답 본문 로깅 (디버깅용)
    const responseJson = JSON.stringify(kakaoResponse);
    logger.info("📤 카카오톡 응답 준비 (빈 응답 - 사용자에게 표시 안 함)", {
      userId: validatedData.userRequest.user.id,
      responseJson: responseJson,
    });

    // ★ 반드시 제시간(<=3~5초) 안에, 올바른 포맷으로 200 반환
    // 헤더 설정
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    
    // 응답 전송 (명시적으로 전송)
    res.status(200).send(responseJson);
    
    // 응답 완료 후 로깅 (응답 스트림에 영향 없도록)
    logger.info("✅ 카카오톡 응답 반환 완료", {
      userId: validatedData.userRequest.user.id,
      utterance: utterance,
      responseLength: responseJson.length,
      statusCode: 200,
    });

    // ★ 내부 API 호출은 비동기로 처리 (응답 전송 후, await 없이)
    // 사용자 정보를 외부 서버로 전송 (비동기, 응답을 기다리지 않음)
    setImmediate(async () => {
      try {
        const userInfo = UserInfoService.convertFromChatbotData(validatedData);
        const sendSuccess = await userInfoService.sendUserInfo(userInfo);

        if (sendSuccess) {
          logger.info("사용자 정보 전송 완료 (비동기)", {
            userId: userInfo.userId,
            userName: userInfo.userName,
          });
        } else {
          logger.warn("사용자 정보 전송 실패 (비동기)", {
            userId: userInfo.userId,
          });
        }
      } catch (userInfoError) {
        logger.error("사용자 정보 전송 중 오류 발생 (비동기)", {
          userId: validatedData.userRequest.user.id,
          error: userInfoError instanceof Error ? userInfoError.message : "Unknown error",
        });
      }
    });
  } catch (error) {
    logger.error("챗봇 스킬 처리 중 오류 발생:", error);

    // 에러 발생 시에도 카카오에 유효한 응답을 반환 (빈 응답)
    const errorResponse = {
      version: "2.0",
      template: {
        outputs: [], // 에러 시에도 사용자에게 표시 안 함
      },
    };

    const errorResponseJson = JSON.stringify(errorResponse);
    
    if (error instanceof z.ZodError) {
      logger.warn("요청 데이터 검증 실패", {
        errors: error.errors,
      });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(200).send(errorResponseJson);
      return;
    }

    // 기타 에러도 카카오에 유효한 응답 반환
    logger.error("챗봇 스킬 처리 중 예상치 못한 오류", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(errorResponseJson);
  }
});

/**
 * 사용자 정보 서버 연결 테스트 엔드포인트
 */
router.get("/test-connection", async (_req, res) => {
  try {
    const isConnected = await userInfoService.testConnection();

    if (isConnected) {
      res.json({
        success: true,
        message: "사용자 정보 서버 연결 성공",
        serverUrl: process.env.BACKEND_SERVER_URL || "http://localhost:8080/api/kakao/messages",
      });
    } else {
      res.status(503).json({
        success: false,
        message: "사용자 정보 서버 연결 실패",
        serverUrl: process.env.BACKEND_SERVER_URL || "http://localhost:8080/api/kakao/messages",
      });
    }
  } catch (error) {
    logger.error("서버 연결 테스트 중 오류 발생:", error);
    res.status(500).json({
      success: false,
      error: "서버 연결 테스트 중 오류가 발생했습니다.",
    });
  }
});

export { router as chatbotRouter };
