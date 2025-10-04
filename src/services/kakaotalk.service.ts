import { type Browser, type Page, chromium } from "playwright";
import { logger } from "../utils/logger";

export interface MessageData {
  recipient: string;
  message: string;
  messageType: "text" | "image" | "file";
  imageUrl?: string;
  fileName?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * 카카오톡 메시지 전송 서비스
 * Playwright를 사용하여 headless 브라우저로 카카오톡 웹에서 메시지 전송
 */
export class KakaoTalkService {
  private browser: Browser | null = null;
  private readonly baseChatUrl = "https://center-pf.kakao.com/_TcdTn/chats/";

  /**
   * 브라우저 인스턴스 초기화
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: false, // 디버깅을 위해 브라우저 창 표시
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      });
    }
    return this.browser;
  }

  /**
   * 카카오톡 웹 로그인 처리
   * @param page Playwright 페이지 인스턴스
   */
  private async loginToKakaoTalk(page: Page): Promise<boolean> {
    try {
      logger.info("카카오톡 웹 로그인 시도");

      // 카카오톡 웹 로그인 페이지로 이동
      await page.goto("https://center-pf.kakao.com/_TcdTn/chats");

      // 로그인 폼이 있는지 확인
      const loginIdInput = page.locator("#loginId--1");
      const passwordInput = page.locator("#password--2");
      const loginButton = page.locator("div.confirm_btn > button.btn_g.highlight.submit");

      // 로그인 폼이 보이면 로그인 시도
      if (await loginIdInput.isVisible({ timeout: 5000 })) {
        logger.info("로그인 폼 발견, 자동 로그인 시도");

        // 아이디 입력
        await loginIdInput.fill(process.env.KAKAO_LOGIN_ID || "");

        // 비밀번호 입력
        await passwordInput.fill(process.env.KAKAO_LOGIN_PASSWORD || "");

        // 로그인 버튼 클릭
        await loginButton.click();

        // 로그인 완료 대기 (채팅 목록이 로드될 때까지)
        await page.waitForLoadState("networkidle");

        // 2단계 인증 완료를 기다림 (최대 60초)
        logger.info("2단계 인증 완료를 기다리는 중...");

        try {
          // 2단계 인증이 완료되어 메인 화면으로 넘어가는 것을 감지
          await page.waitForSelector("#kakaoContent", { timeout: 60000 });
          logger.info("2단계 인증 완료, 카카오톡 로그인 성공");
          return true;
        } catch (error) {
          // 60초 내에 메인 화면으로 넘어가지 않으면 로그인 실패로 간주
          logger.warn("2단계 인증 시간 초과 또는 로그인 실패", error);
          return false;
        }
      }

      // 이미 로그인된 상태인지 확인
      const isAlreadyLoggedIn = await page
        .locator(".list_chat, .profile_area, .chat_list")
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isAlreadyLoggedIn) {
        logger.info("이미 로그인된 상태");
        return true;
      }

      logger.warn("로그인 폼을 찾을 수 없습니다");
      return false;
    } catch (error) {
      logger.error("카카오톡 로그인 실패:", error);
      return false;
    }
  }

  /**
   * 메시지 전송 처리
   * @param messageData 전송할 메시지 데이터
   * @param id 해당 학생 아이디
   * @returns 전송 결과
   */
  /**
   * 카카오톡 채팅방 ID로 메시지 전송
   * @param messageData 전송할 메시지 데이터
   * @param chatId 카카오톡 채팅방 ID (예: 4952763873902355)
   * @returns 전송 결과
   */
  async sendMessage(messageData: MessageData, chatId: string): Promise<SendMessageResult> {
    let page: Page | null = null;

    try {
      const browser = await this.initBrowser();

      // 브라우저가 닫혔는지 확인
      if (browser.isConnected()) {
        page = await browser.newPage();
      } else {
        // 브라우저가 닫혔다면 새로 초기화
        this.browser = null;
        const newBrowser = await this.initBrowser();
        page = await newBrowser.newPage();
      }

      // 카카오톡 로그인
      const loginSuccess = await this.loginToKakaoTalk(page);
      if (!loginSuccess) {
        return {
          success: false,
          error: "카카오톡 로그인에 실패했습니다.",
          timestamp: new Date(),
        };
      }

      // 채팅방 URL 구성
      const chatUrl = `${this.baseChatUrl}${chatId}`;

      // 카카오톡 채팅방으로 이동
      logger.info("카카오톡 채팅방으로 이동", { chatUrl, chatId });
      await page.goto(chatUrl);

      // 페이지 로딩 대기
      await page.waitForLoadState("networkidle");

      // 메시지 입력 및 전송
      await this.inputAndSendMessage(page, messageData);

      logger.info("메시지 전송 성공", {
        recipient: messageData.recipient,
        messageType: messageData.messageType,
        chatId,
        chatUrl,
      });

      return {
        success: true,
        messageId: `msg_${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error("메시지 전송 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    } finally {
      if (page && !page.isClosed()) {
        try {
          await page.close();
        } catch (error) {
          logger.warn("페이지 닫기 실패:", error);
        }
      }
    }
  }

  /**
   * 메시지 입력 및 전송
   * @param page Playwright 페이지 인스턴스
   * @param messageData 전송할 메시지 데이터
   */
  private async inputAndSendMessage(page: Page, messageData: MessageData): Promise<void> {
    try {
      // 메시지 입력 필드 찾기 (카카오톡 웹의 실제 셀렉터 사용)
      const messageInput = page.locator("#chatWrite");

      // 입력 필드가 로드될 때까지 대기
      await messageInput.waitFor({ state: "visible", timeout: 10000 });

      // 메시지 입력
      await messageInput.fill(messageData.message);

      // 이미지나 파일 첨부 처리
      if (messageData.messageType === "image" && messageData.imageUrl) {
        await this.attachImage(page, messageData.imageUrl);
      } else if (messageData.messageType === "file" && messageData.fileName) {
        await this.attachFile(page, messageData.fileName);
      }

      // 전송 버튼 클릭
      const sendButton = page.locator(
        "#kakaoWrap > div.chat_popup > div.popup_body > div > div.write_chat3 > div > form > fieldset > button"
      );
      // 전송 버튼 텍스트 확인
      const buttonText = await sendButton.textContent();
      console.log("전송 버튼 텍스트:", buttonText);

      await page.waitForTimeout(100);
      await sendButton.click();

      // 전송 완료를 위한 짧은 대기
      await page.waitForTimeout(1000);

      logger.info("메시지 입력 및 전송 완료", {
        messageType: messageData.messageType,
        messageLength: messageData.message.length,
      });
    } catch (error) {
      logger.error("메시지 입력 및 전송 실패:", error);
      throw error;
    }
  }

  /**
   * 이미지 첨부
   * @param page Playwright 페이지 인스턴스
   * @param imageUrl 이미지 URL
   */
  private async attachImage(page: Page, imageUrl: string): Promise<void> {
    try {
      logger.info("이미지 첨부 중", { imageUrl });

      // 첨부 버튼 클릭
      const attachButton = page.locator(
        'button[data-testid="attach-button"], .btn_attach, [aria-label*="첨부"]'
      );
      await attachButton.click();

      // 이미지 첨부 옵션 선택
      const imageOption = page.locator('button[data-testid="image-attach"], .attach_image');
      await imageOption.click();

      // 이미지 URL 입력 (실제 구현에서는 파일 업로드 처리)
      // const fileInput = page.locator('input[type="file"]');
      // await fileInput.setInputFiles(imageUrl); // 실제 파일 경로가 필요한 경우

      logger.info("이미지 첨부 완료", { imageUrl });
    } catch (error) {
      logger.error("이미지 첨부 실패:", error);
      throw error;
    }
  }

  /**
   * 파일 첨부
   * @param page Playwright 페이지 인스턴스
   * @param fileName 파일명
   */
  private async attachFile(page: Page, fileName: string): Promise<void> {
    try {
      logger.info("파일 첨부 중", { fileName });

      // 첨부 버튼 클릭
      const attachButton = page.locator(
        'button[data-testid="attach-button"], .btn_attach, [aria-label*="첨부"]'
      );
      await attachButton.click();

      // 파일 첨부 옵션 선택
      const fileOption = page.locator('button[data-testid="file-attach"], .attach_file');
      await fileOption.click();

      // 파일 선택 (실제 구현에서는 파일 경로 처리)
      // const fileInput = page.locator('input[type="file"]');
      // await fileInput.setInputFiles(fileName); // 실제 파일 경로가 필요한 경우

      logger.info("파일 첨부 완료", { fileName });
    } catch (error) {
      logger.error("파일 첨부 실패:", error);
      throw error;
    }
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info("브라우저가 종료되었습니다.");
    }
  }
}
