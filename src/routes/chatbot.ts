import { Router } from "express";
import { z } from "zod";
import { logger } from "../utils/logger";

const router: Router = Router();

// 카카오톡 챗봇 스킬 요청 스키마
const chatbotSkillSchema = z.object({
  userRequest: z.object({
    utterance: z.string(),
    user: z.object({
      id: z.string(),
      type: z.string(),
    }),
  }),
  action: z.object({
    name: z.string(),
    clientExtra: z.any().optional(),
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
    });

    // 여기에 실제 알림 로직 구현
    // 예: 웹훅 전송, 데이터베이스 저장, 다른 서비스 호출 등

    // 카카오톡 챗봇 응답
    const response = {
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: `메시지를 받았습니다: "${validatedData.userRequest.utterance}"`,
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
 * 카카오톡 알림 설정 엔드포인트
 */
router.post("/notifications/setup", (req, res) => {
  try {
    const { webhookUrl, userId } = req.body;

    if (!webhookUrl || !userId) {
      res.status(400).json({
        error: "webhookUrl과 userId는 필수입니다.",
      });
      return;
    }

    // 알림 설정 로직 구현
    logger.info("알림 설정 요청", { webhookUrl, userId });

    res.json({
      message: "알림이 성공적으로 설정되었습니다.",
      webhookUrl,
      userId,
    });
  } catch (error) {
    logger.error("알림 설정 중 오류 발생:", error);
    res.status(500).json({
      error: "알림 설정 중 오류가 발생했습니다.",
    });
  }
});

export { router as chatbotRouter };
