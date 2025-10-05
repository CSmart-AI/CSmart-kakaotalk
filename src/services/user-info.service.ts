import { logger } from "../utils/logger";

// 사용자 정보 인터페이스
export interface UserInfo {
  userId: string;
  userName?: string;
  userType: string;
  utterance: string;
  timestamp: string;
  botId: string;
  botName: string;
  actionName: string;
}

/**
 * 사용자 정보를 외부 서버로 전송하는 서비스
 */
export class UserInfoService {
  private readonly serverUrl: string;
  private readonly timeout: number;

  constructor() {
    // 환경변수에서 서버 URL과 타임아웃 설정
    this.serverUrl = process.env.USER_INFO_SERVER_URL || "http://localhost:8080/api/users";
    this.timeout = Number.parseInt(process.env.USER_INFO_SERVER_TIMEOUT || "5000", 10);
  }

  /**
   * 사용자 정보를 외부 서버로 POST 요청
   * @param userInfo 전송할 사용자 정보
   * @returns Promise<boolean> 전송 성공 여부
   */
  async sendUserInfo(userInfo: UserInfo): Promise<boolean> {
    try {
      logger.info("사용자 정보 전송 시작", {
        userId: userInfo.userId,
        serverUrl: this.serverUrl,
        userInfo: userInfo,
      });

      // 실제 서버가 없으므로 로그로만 확인
      logger.info("📤 POST 요청 시뮬레이션", {
        method: "POST",
        url: this.serverUrl,
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "CSmart-KakaoTalk/1.0.0",
        },
        body: userInfo,
      });

      // 실제 서버가 있다면 아래 코드를 사용
      /*
      const response: AxiosResponse<UserInfoResponse> = await axios.post(
        this.serverUrl,
        userInfo,
        {
          timeout: this.timeout,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "CSmart-KakaoTalk/1.0.0",
          },
        }
      );

      if (response.data.success) {
        logger.info("사용자 정보 전송 성공", {
          userId: userInfo.userId,
          response: response.data,
        });
        return true;
      } else {
        logger.warn("사용자 정보 전송 실패", {
          userId: userInfo.userId,
          response: response.data,
        });
        return false;
      }
      */

      // 시뮬레이션용 성공 응답
      logger.info("✅ 사용자 정보 전송 완료 (시뮬레이션)", {
        userId: userInfo.userId,
        message: "사용자 정보가 성공적으로 전송되었습니다.",
      });

      return true;
    } catch (error) {
      logger.error("사용자 정보 전송 중 오류 발생", {
        userId: userInfo.userId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * 카카오톡 챗봇 요청 데이터를 UserInfo 형식으로 변환
   * @param chatbotData 카카오톡 챗봇 요청 데이터
   * @returns UserInfo 변환된 사용자 정보
   */
  static convertFromChatbotData(chatbotData: Record<string, unknown>): UserInfo {
    const userRequest = chatbotData.userRequest as Record<string, unknown>;
    const user = userRequest.user as Record<string, unknown>;
    const userProperties = user.properties as Record<string, unknown> | undefined;
    const bot = chatbotData.bot as Record<string, unknown>;
    const action = chatbotData.action as Record<string, unknown>;

    return {
      userId: user.id as string,
      userName: (userProperties?.name as string) || "Unknown",
      userType: user.type as string,
      utterance: userRequest.utterance as string,
      timestamp: new Date().toISOString(),
      botId: bot.id as string,
      botName: bot.name as string,
      actionName: action.name as string,
    };
  }

  /**
   * 서버 연결 테스트
   * @returns Promise<boolean> 연결 가능 여부
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info("서버 연결 테스트 시작", { serverUrl: this.serverUrl });

      // 실제 서버가 있다면 아래 코드를 사용
      /*
      const response = await axios.get(`${this.serverUrl}/health`, {
        timeout: this.timeout,
      });
      
      logger.info("서버 연결 테스트 성공", {
        serverUrl: this.serverUrl,
        status: response.status,
      });
      return true;
      */

      // 시뮬레이션용 성공 응답
      logger.info("🔗 서버 연결 테스트 성공 (시뮬레이션)", {
        serverUrl: this.serverUrl,
        timeout: this.timeout,
        status: 200,
      });
      return true;
    } catch (error) {
      logger.error("서버 연결 테스트 실패", {
        serverUrl: this.serverUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }
}
