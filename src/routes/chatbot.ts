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
 */
router.post("/skill", async (req, res) => {
  try {
    // 요청 데이터 검증
    const validatedData = chatbotSkillSchema.parse(req.body);

    logger.info("카카오톡 챗봇 스킬 요청 받음", {
      userId: validatedData.userRequest.user.id,
      utterance: validatedData.userRequest.utterance,
      actionName: validatedData.action.name,
      intentName: validatedData.intent.name,
      botName: validatedData.bot.name,
    });

    // 사용자 정보를 외부 서버로 전송
    try {
      const userInfo = UserInfoService.convertFromChatbotData(validatedData);
      const sendSuccess = await userInfoService.sendUserInfo(userInfo);

      if (sendSuccess) {
        logger.info("사용자 정보 전송 완료", {
          userId: userInfo.userId,
          userName: userInfo.userName,
        });
      } else {
        logger.warn("사용자 정보 전송 실패", {
          userId: userInfo.userId,
        });
      }
    } catch (userInfoError) {
      logger.error("사용자 정보 전송 중 오류 발생", {
        userId: validatedData.userRequest.user.id,
        error: userInfoError instanceof Error ? userInfoError.message : "Unknown error",
      });
    }

    // 카카오톡 챗봇 응답
    const userName = validatedData.userRequest.user.properties?.name || "임경빈";
    const response = {
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: `메시지를 받았습니다.\n받은 메시지: ${validatedData.userRequest.utterance}\n보낸사람: ${userName}`,
            },
          },
        ],
      },
    };

    res.json(response);
  } catch (error) {
    logger.error("챗봇 스킬 처리 중 오류 발생:", error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      message: "챗봇 스킬 처리 중 오류가 발생했습니다.",
    });
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
        serverUrl: process.env.BACKEND_SERVER_URL || "http://localhost:8080/api/users",
      });
    } else {
      res.status(503).json({
        success: false,
        message: "사용자 정보 서버 연결 실패",
        serverUrl: process.env.BACKEND_SERVER_URL || "http://localhost:8080/api/users",
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
