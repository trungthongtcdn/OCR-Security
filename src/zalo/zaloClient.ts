import fs from "node:fs";
import path from "node:path";
import { API, ThreadType, Zalo, type Message } from "zca-js";
import type { SerializedCookie } from "tough-cookie";
import { logger } from "../logger.js";

interface StoredSession {
  imei: string;
  userAgent: string;
  cookie: SerializedCookie[];
}

export class ZaloClient {
  private api: API | undefined;

  constructor(private readonly sessionDir: string) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  private get sessionFile(): string {
    return path.join(this.sessionDir, "session.json");
  }

  private loadStoredSession(): StoredSession | undefined {
    if (!fs.existsSync(this.sessionFile)) return undefined;
    try {
      return JSON.parse(fs.readFileSync(this.sessionFile, "utf-8")) as StoredSession;
    } catch (err) {
      logger.warn({ err }, "khong doc duoc session Zalo da luu, se dang nhap lai bang QR");
      return undefined;
    }
  }

  private persistSession(): void {
    if (!this.api) return;
    const context = this.api.getContext();
    const cookie = this.api.getCookie().toJSON()?.cookies ?? [];
    const session: StoredSession = {
      imei: context.imei,
      userAgent: context.userAgent,
      cookie,
    };
    fs.writeFileSync(this.sessionFile, JSON.stringify(session, null, 2), "utf-8");
    logger.info({ file: this.sessionFile }, "da luu session Zalo, lan sau khong can quet QR");
  }

  /** Dang nhap: dung lai session da luu neu co, khong thi hien QR de Admin quet. */
  async login(): Promise<API> {
    const zalo = new Zalo();
    const stored = this.loadStoredSession();

    if (stored) {
      try {
        this.api = await zalo.login({
          imei: stored.imei,
          userAgent: stored.userAgent,
          cookie: stored.cookie,
        });
        logger.info("dang nhap Zalo thanh cong bang session da luu");
        return this.api;
      } catch (err) {
        logger.warn({ err }, "session Zalo da luu khong con hop le, chuyen sang dang nhap QR");
      }
    }

    const qrPath = path.join(this.sessionDir, "qr.png");
    this.api = await zalo.loginQR({ qrPath }, (event) => {
      logger.info({ type: event.type }, "zalo loginQR event");
    });
    this.persistSession();
    logger.info("dang nhap Zalo thanh cong bang QR, da luu session cho lan sau");
    return this.api;
  }

  getApi(): API {
    if (!this.api) throw new Error("Chua dang nhap Zalo. Goi login() truoc.");
    return this.api;
  }

  onMessage(handler: (message: Message) => void | Promise<void>): void {
    this.getApi().listener.on("message", (message) => {
      Promise.resolve(handler(message)).catch((err) => {
        logger.error({ err }, "loi khi xu ly tin nhan Zalo");
      });
    });
  }

  start(): void {
    this.getApi().listener.start();
  }

  async reply(threadId: string, threadType: ThreadType, text: string): Promise<void> {
    await this.getApi().sendMessage({ msg: text }, threadId, threadType);
  }
}
