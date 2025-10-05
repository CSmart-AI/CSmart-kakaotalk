import { Router } from "express";
import { z } from "zod";
import { KakaoTalkService } from "../services/kakaotalk.service";
import { logger } from "../utils/logger";

const router: Router = Router();
const kakaoTalkService = new KakaoTalkService();

// 메시지 전송 요청 스키마
const messageSchema = z.object({
  recipient: z.string().min(1, "수신자는 필수입니다."),
  message: z.string().min(1, "메시지 내용은 필수입니다."),
  messageType: z.enum(["text", "image", "file"]).default("text"),
  imageUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  chatId: z.string().min(1, "채팅방 ID는 필수입니다."),
});

/**
 * 카카오톡 메시지 전송 엔드포인트
 * POST 요청으로 메시지 내용을 받아서 Playwright를 통해 카카오톡으로 전송
 */
router.post("/send", async (req, res) => {
  try {
    // 요청 데이터 검증
    const validatedData = messageSchema.parse(req.body);

    logger.info("카카오톡 메시지 전송 요청", {
      recipient: validatedData.recipient,
      messageType: validatedData.messageType,
      messageLength: validatedData.message.length,
      chatId: validatedData.chatId,
    });

    // Playwright를 통한 카카오톡 메시지 전송
    const result = await kakaoTalkService.sendMessage(
      {
        recipient: validatedData.recipient,
        message: validatedData.message,
        messageType: validatedData.messageType,
        imageUrl: validatedData.imageUrl || undefined,
        fileName: validatedData.fileName || undefined,
      },
      validatedData.chatId
    );

    res.json({
      success: true,
      message: "메시지가 성공적으로 전송되었습니다.",
      result,
    });
  } catch (error) {
    logger.error("메시지 전송 중 오류 발생:", error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      message: "메시지 전송 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 메시지 전송 상태 확인 엔드포인트
 */
router.get("/status/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;

    // 메시지 전송 상태 확인 로직 구현
    logger.info("메시지 상태 확인 요청", { messageId });

    res.json({
      messageId,
      status: "sent", // sent, failed, pending
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("메시지 상태 확인 중 오류 발생:", error);
    res.status(500).json({
      error: "메시지 상태 확인 중 오류가 발생했습니다.",
    });
  }
});

/**
 * 카카오톡에서 채팅 목록을 가져와서 자동 저장하는 엔드포인트
 * POST 요청으로 카카오톡 API에서 채팅 목록을 가져와서 자동으로 저장
 */
router.post("/chat-list", async (_req, res) => {
  try {
    logger.info("카카오톡에서 채팅 목록 가져오기 및 자동 저장 요청");

    // 카카오톡에서 채팅 목록을 가져와서 자동으로 저장
    const result = await kakaoTalkService.fetchAndSaveChatList();

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || "카카오톡에서 채팅 목록을 가져오고 저장하는데 실패했습니다.",
      });
      return;
    }

    res.json({
      success: true,
      message: "카카오톡에서 채팅 목록을 성공적으로 가져와서 저장했습니다.",
      data: {
        id: result.id,
        savedAt: new Date().toISOString(),
        totalCount: result.data?.items.length || 0,
        chatList: result.data,
      },
    });
  } catch (error) {
    logger.error("카카오톡 채팅 목록 가져오기 및 자동 저장 중 오류 발생:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "카카오톡에서 채팅 목록을 가져오고 저장하는 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as messageRouter };
