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

// 카카오톡 채팅 목록 관련 인터페이스
export interface TalkUser {
  status_message: string;
  active: boolean;
  profile_image_url: string;
  chat_id: string;
  user_type: number;
  nickname: string;
  original_profile_image_url: string;
  id: string;
  full_profile_image_url: string;
}

export interface ChatItem {
  talk_user: TalkUser;
  last_seen_log_id: string;
  created_at: number;
  last_message: string;
  is_replied: boolean;
  is_read: boolean;
  unread_count: number;
  need_manager_confirm: boolean;
  is_deleted: boolean;
  updated_at: number;
  id: string;
  assignee_id: number;
  last_log_id: string;
  is_done: boolean;
  user_last_seen_log_id: string;
  version: number;
  last_log_send_at: number;
  is_blocked: boolean;
  is_starred: boolean;
  is_user_left: boolean;
  profile_id: string;
  encoded_profile_id: string;
  ai_flag: boolean;
  name: string;
  chat_label_ids: string[];
  is_friend: boolean;
  add_msg_layer_status?: string;
  check_add_friend_message?: boolean;
}

export interface ChatListResponse {
  items: ChatItem[];
  has_next: boolean;
}

export interface SaveChatListRequest {
  chatList: ChatItem[];
  saved_at: Date;
}

export interface ChatListStorage {
  id: string;
  chat_list: ChatItem[];
  saved_at: Date;
  total_count: number;
}

/**
 * 카카오톡 메시지 전송 서비스
 * Playwright를 사용하여 headless 브라우저로 카카오톡 웹에서 메시지 전송
 */
export class KakaoTalkService {
  private browser: Browser | null = null;
  private mainPage: Page | null = null;
  private isLoggedIn = false;
  private readonly baseChatUrl = "https://center-pf.kakao.com/_TcdTn/chats/";

  // 메모리 기반 채팅 목록 저장소 (실제 프로덕션에서는 데이터베이스 사용 권장)
  private chatListStorage: ChatListStorage[] = [];

  /**
   * 브라우저 인스턴스 초기화 및 로그인
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true, // Docker 환경에서는 headless 모드
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-blink-features=AutomationControlled",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-images",
          "--disable-javascript-harmony-shipping",
          "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ],
      });

      // 메인 페이지 생성 및 로그인
      await this.initializeMainPage();
    }
    return this.browser;
  }

  /**
   * 메인 페이지 초기화 및 로그인
   */
  private async initializeMainPage(): Promise<void> {
    if (!this.browser) {
      throw new Error("브라우저가 초기화되지 않았습니다.");
    }

    try {
      logger.info("메인 페이지 초기화 시작");

      // 메인 페이지 생성
      this.mainPage = await this.browser.newPage();

      // 페이지 설정
      await this.mainPage.setViewportSize({ width: 1920, height: 1080 });
      await this.mainPage.setExtraHTTPHeaders({
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8,en-US;q=0.7",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      });

      // 로그인 수행
      const loginSuccess = await this.loginToKakaoTalk(this.mainPage);
      if (!loginSuccess) {
        throw new Error("카카오톡 로그인에 실패했습니다.");
      }

      this.isLoggedIn = true;
      logger.info("메인 페이지 초기화 및 로그인 완료");
    } catch (error) {
      logger.error("메인 페이지 초기화 실패:", error);
      this.isLoggedIn = false;
      if (this.mainPage) {
        await this.mainPage.close();
        this.mainPage = null;
      }
      throw error;
    }
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
    let tempPage: Page | null = null;

    try {
      // 브라우저 초기화 (로그인이 되어있지 않으면 로그인 수행)
      await this.initBrowser();

      // 로그인 상태 확인
      if (!this.isLoggedIn || !this.mainPage || this.mainPage.isClosed()) {
        logger.warn("로그인 세션이 만료되었습니다. 재로그인을 시도합니다.");
        this.isLoggedIn = false;
        this.mainPage = null;

        // 브라우저 재초기화
        if (this.browser) {
          await this.browser.close();
          this.browser = null;
        }
        await this.initBrowser();
      }

      // 채팅방 URL 구성
      const chatUrl = `${this.baseChatUrl}${chatId}`;

      // 메인 페이지에서 새 탭으로 채팅방 열기
      logger.info("카카오톡 채팅방으로 이동", { chatUrl, chatId });
      if (!this.mainPage) {
        throw new Error("메인 페이지가 초기화되지 않았습니다.");
      }
      tempPage = await this.mainPage.context().newPage();
      await tempPage.goto(chatUrl);

      // 페이지 로딩 대기
      await tempPage.waitForLoadState("networkidle");

      // 메시지 입력 및 전송
      await this.inputAndSendMessage(tempPage, messageData);

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

      // 로그인 세션 오류인 경우 재로그인 플래그 설정
      if (error instanceof Error && error.message.includes("로그인")) {
        this.isLoggedIn = false;
        this.mainPage = null;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    } finally {
      if (tempPage && !tempPage.isClosed()) {
        try {
          await tempPage.close();
        } catch (error) {
          logger.warn("임시 페이지 닫기 실패:", error);
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
   * 카카오톡 API에서 채팅 목록 가져오기
   * @returns 카카오톡 채팅 목록 데이터
   */
  async fetchChatList(): Promise<{ success: boolean; data?: ChatListResponse; error?: string }> {
    try {
      logger.info("카카오톡 API에서 채팅 목록 가져오기 시작");

      const response = await fetch(
        "https://center-pf.kakao.com/api/profiles/_TcdTn/chats/search?size=100",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "accept-language": "ko-KR,ko;q=0.9,en;q=0.8,en-US;q=0.7",
            "content-type": "application/json",
            priority: "u=1, i",
            "sec-ch-ua": '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-kakao-rocketapiversion": "19",
            referer: "https://center-pf.kakao.com/_TcdTn/chats",
            cookie:
              "webid=4996617d457b42b48459748e335c408f; webid_ts=1741872094440; _karb=N7PmH56c-oVpf8He_1746702932158; _kadu=ydc7R75Do4pit0Ho9DRjJvKHmLZs_1746607248; _ga_MS10Z6SM95=GS2.1.s1756367305$o3$g0$t1756367305$j60$l0$h0; _pfdl=y; _pn2859988199_af_hint=y; kd_lang=ko; _clck=1gyk0hu%5E2%5Efzf%5E0%5E1959; _ga_QD3JP8QSW2=GS2.1.s1758182238$o2$g0$t1758183777$j60$l0$h0; _ga=GA1.2.1268595154.1747131163; _gid=GA1.2.1390150880.1759573662; __T_=1; __T_SECURE=1; JSESSIONID=Zc2Ck5hZu0SuRijLbgnrEwTno4YTgvDDzGrcxvd8; _kawask=dbea5084-e5ab-4fa2-a64e-7864d4ae7e8f; _kau=8b84a9d0ba070680a24df0bceeecf34fa04fc0a68be1e8826ba0d23449ed53af9e1f2c4397cd517eade475488a595df6a41d4859296cc3d6c292d79789d6c0f8588efaa283e8da6b97042dbf0456073d66f58aafa3eddc6fcca967f8c364339a84808c47c7538af2666aae2a42897e8d83fc0f857c2b1ee0bd00593338383031373733343936393638353233373834303539303336313734303639e50a1c9fac0bd681ae46ae4091bb0747; _kawlt=L6BWC-FCIy_shgNzO1N_TJMxGF5drxyjBHOXIr08FwMmDWZpVvCPqVgDkVaRen7dOeRAWxD6m4iN8ujbMCGMnapWgbFO56rXzfVMrQXCsZsvcI0ePu8WxzNfKZmHLDH_; _kawltea=1759712998; _karmt=bfuBeJyqwwirFKA6okTQdSZtbGGokbQYBRoG7Oks0V587CVZVaf8uc-V4evqKv2I; _karmtea=1759723798; _kahai=899d7e5e563a9951c101e34d5e9a4a8d3f9d58f17278cabe85d21e1ee9e29974; _gat=1; _T_ANO=JVtSrKBRItwCTgmaVGF1u5hMukSQqDt9q/JbUzhaOvtfYVI04wHrYheRNtOhVUzjwVsXT4AVoLiXH8pP3qqCIGTxE8ScJw950fo7S9EE6080k/tQGYJm3QL6dUjNY0lKPndXXVxTgPCONBnTNMlM3/sx9n0kXfqrOgkWD1JDmwWdlZo4SkHU/rETo9lVBHNV3IHGaVGkDadDaiQVeg10v6peeSK4wV4CAuKZc95x64I+DO4h6ZPO3RwVfdULjPE2CL2CEdyQTJTvsgkGLcOktogJarWK2xI+FbGz9Gmx2d8FXmBCn/bpisf0i1fsHeCnwh8c8fMuB/fA09WS/JmwGg==; _ga_5DK2Q7749V=GS2.2.s1759637399$o9$g1$t1759637466$j60$l0$h0",
          },
          body: JSON.stringify({
            is_blocked: false,
            status: "progress",
            keyword: "",
            labels: [],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as ChatListResponse;

      logger.info("카카오톡 API에서 채팅 목록 가져오기 성공", {
        itemCount: data.items.length,
        hasNext: data.has_next,
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error("카카오톡 API에서 채팅 목록 가져오기 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 채팅 목록 저장
   * @param chatList 카카오톡 채팅 목록 데이터
   * @returns 저장 결과
   */
  async saveChatList(
    chatList: ChatItem[]
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const id = `chatlist_${Date.now()}`;
      const savedAt = new Date();

      const chatListData: ChatListStorage = {
        id,
        chat_list: chatList,
        saved_at: savedAt,
        total_count: chatList.length,
      };

      // 메모리에 저장 (실제 프로덕션에서는 데이터베이스에 저장)
      this.chatListStorage.push(chatListData);

      logger.info("채팅 목록 저장 완료", {
        id,
        totalCount: chatList.length,
        savedAt: savedAt.toISOString(),
      });

      return {
        success: true,
        id,
      };
    } catch (error) {
      logger.error("채팅 목록 저장 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 저장된 채팅 목록 조회
   * @param id 저장된 채팅 목록 ID (선택사항)
   * @returns 채팅 목록 데이터
   */
  async getChatList(
    id?: string
  ): Promise<{ success: boolean; data?: ChatListStorage[]; error?: string }> {
    try {
      let result: ChatListStorage[];

      if (id) {
        // 특정 ID의 채팅 목록 조회
        result = this.chatListStorage.filter((storage) => storage.id === id);
      } else {
        // 모든 채팅 목록 조회 (최신 순으로 정렬)
        result = [...this.chatListStorage].sort(
          (a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
        );
      }

      logger.info("채팅 목록 조회 완료", {
        id: id || "all",
        count: result.length,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error("채팅 목록 조회 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 최신 채팅 목록 조회
   * @returns 가장 최근에 저장된 채팅 목록
   */
  async getLatestChatList(): Promise<{ success: boolean; data?: ChatListStorage; error?: string }> {
    try {
      if (this.chatListStorage.length === 0) {
        return {
          success: false,
          error: "저장된 채팅 목록이 없습니다.",
        };
      }

      // 가장 최근에 저장된 채팅 목록 반환
      const latest = this.chatListStorage.reduce((latest, current) =>
        new Date(current.saved_at) > new Date(latest.saved_at) ? current : latest
      );

      logger.info("최신 채팅 목록 조회 완료", {
        id: latest.id,
        savedAt: latest.saved_at.toISOString(),
        totalCount: latest.total_count,
      });

      return {
        success: true,
        data: latest,
      };
    } catch (error) {
      logger.error("최신 채팅 목록 조회 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 카카오톡에서 채팅 목록을 가져와서 자동으로 저장
   * @returns 저장된 채팅 목록 ID와 데이터
   */
  async fetchAndSaveChatList(): Promise<{
    success: boolean;
    id?: string;
    data?: ChatListResponse;
    error?: string;
  }> {
    try {
      logger.info("카카오톡에서 채팅 목록 가져오기 및 저장 시작");

      // 카카오톡 API에서 채팅 목록 가져오기
      const fetchResult = await this.fetchChatList();

      if (!fetchResult.success || !fetchResult.data) {
        return {
          success: false,
          error: fetchResult.error || "채팅 목록을 가져오는데 실패했습니다.",
        };
      }

      // 가져온 채팅 목록을 저장
      const saveResult = await this.saveChatList(fetchResult.data.items);

      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error || "채팅 목록 저장에 실패했습니다.",
        };
      }

      logger.info("카카오톡 채팅 목록 가져오기 및 저장 완료", {
        id: saveResult.id,
        itemCount: fetchResult.data.items.length,
      });

      return {
        success: true,
        id: saveResult.id,
        data: fetchResult.data,
      };
    } catch (error) {
      logger.error("카카오톡 채팅 목록 가져오기 및 저장 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 채팅 목록 삭제
   * @param id 삭제할 채팅 목록 ID
   * @returns 삭제 결과
   */
  async deleteChatList(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const initialLength = this.chatListStorage.length;
      this.chatListStorage = this.chatListStorage.filter((storage) => storage.id !== id);

      if (this.chatListStorage.length === initialLength) {
        return {
          success: false,
          error: "해당 ID의 채팅 목록을 찾을 수 없습니다.",
        };
      }

      logger.info("채팅 목록 삭제 완료", { id });

      return {
        success: true,
      };
    } catch (error) {
      logger.error("채팅 목록 삭제 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 서비스 초기화 (Docker 시작 시 호출)
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info("KakaoTalk 서비스 초기화 시작");

      // 브라우저 초기화 및 로그인
      await this.initBrowser();

      if (!this.isLoggedIn) {
        throw new Error("초기 로그인에 실패했습니다.");
      }

      logger.info("KakaoTalk 서비스 초기화 완료");
      return { success: true };
    } catch (error) {
      logger.error("KakaoTalk 서비스 초기화 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 로그인 상태 확인
   */
  isServiceReady(): boolean {
    return this.isLoggedIn && this.mainPage !== null && !this.mainPage.isClosed();
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    try {
      if (this.mainPage && !this.mainPage.isClosed()) {
        await this.mainPage.close();
        this.mainPage = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.isLoggedIn = false;
      logger.info("브라우저가 종료되었습니다.");
    } catch (error) {
      logger.error("브라우저 종료 중 오류:", error);
    }
  }
}
