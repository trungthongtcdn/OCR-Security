import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import type { SerializedCookie } from "tough-cookie";
import {
  API,
  LoginQRCallbackEventType,
  ThreadType,
  Zalo,
  type LoginQRCallbackEvent,
  type Message,
} from "zca-js";
import { logger } from "../logger.js";

export type ZaloConnectionState = "logged_out" | "connecting" | "qr_pending" | "logged_in";

interface StoredSession {
  imei: string;
  userAgent: string;
  cookie: SerializedCookie[];
  ownId?: string;
  ownName?: string;
}

export interface ZaloStatus {
  state: ZaloConnectionState;
  qrDataUrl?: string;
  ownId?: string;
  ownName?: string;
  error?: string;
}

/**
 * Quan ly vong doi dang nhap Zalo (tai khoan ca nhan cua Admin) qua zca-js: dang nhap
 * bang QR duoc kich hoat tu trang Admin (khong tu dong hien QR khi khoi dong app),
 * phuc hoi session da luu khi restart, va phat su kien "logged_in" de phan con lai cua
 * ung dung gan message listener.
 */
export class ZaloSessionManager extends EventEmitter {
  private api: API | undefined;
  private state: ZaloConnectionState = "logged_out";
  private qrDataUrl: string | undefined;
  private ownId: string | undefined;
  private ownName: string | undefined;
  private pendingOwnName: string | undefined;
  private lastError: string | undefined;

  constructor(private readonly sessionDir: string) {
    super();
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  private get sessionFile(): string {
    return path.join(this.sessionDir, "session.json");
  }

  getStatus(): ZaloStatus {
    return {
      state: this.state,
      qrDataUrl: this.qrDataUrl,
      ownId: this.ownId,
      ownName: this.ownName,
      error: this.lastError,
    };
  }

  getApi(): API {
    if (!this.api) throw new Error("Chua dang nhap Zalo.");
    return this.api;
  }

  private loadStoredSession(): StoredSession | undefined {
    if (!fs.existsSync(this.sessionFile)) return undefined;
    try {
      return JSON.parse(fs.readFileSync(this.sessionFile, "utf-8")) as StoredSession;
    } catch (err) {
      logger.warn({ err }, "khong doc duoc session Zalo da luu");
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
      ownId: this.ownId,
      ownName: this.ownName,
    };
    fs.writeFileSync(this.sessionFile, JSON.stringify(session, null, 2), "utf-8");
    logger.info({ file: this.sessionFile }, "da luu session Zalo");
  }

  /** Goi 1 lan luc khoi dong: thu dung lai session da luu, khong ep hien QR neu that bai. */
  async tryResumeSession(): Promise<boolean> {
    const stored = this.loadStoredSession();
    if (!stored) return false;

    this.state = "connecting";
    this.emit("update");
    try {
      const zalo = new Zalo();
      this.api = await zalo.login({
        imei: stored.imei,
        userAgent: stored.userAgent,
        cookie: stored.cookie,
      });
      this.onLoggedIn(stored.ownId, stored.ownName);
      return true;
    } catch (err) {
      logger.warn({ err }, "khong phuc hoi duoc session Zalo da luu, can dang nhap lai bang QR");
      this.state = "logged_out";
      this.emit("update");
      return false;
    }
  }

  /** Admin bam nut "Dang nhap" tren trang web -> bat dau flow quet QR. */
  async startQrLogin(): Promise<void> {
    if (this.state === "connecting" || this.state === "qr_pending") return;
    this.state = "connecting";
    this.lastError = undefined;
    this.qrDataUrl = undefined;
    this.pendingOwnName = undefined;
    this.emit("update");

    const zalo = new Zalo();
    try {
      this.api = await zalo.loginQR({}, (event: LoginQRCallbackEvent) => {
        this.handleLoginQrEvent(event);
      });
      this.onLoggedIn(undefined, this.pendingOwnName);
      this.persistSession();
    } catch (err) {
      logger.error({ err }, "dang nhap Zalo bang QR that bai");
      this.state = "logged_out";
      this.lastError = err instanceof Error ? err.message : String(err);
      this.emit("update");
    }
  }

  private handleLoginQrEvent(event: LoginQRCallbackEvent): void {
    switch (event.type) {
      case LoginQRCallbackEventType.QRCodeGenerated: {
        const raw = event.data.image;
        this.qrDataUrl = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
        this.state = "qr_pending";
        this.emit("update");
        break;
      }
      case LoginQRCallbackEventType.QRCodeExpired:
        this.qrDataUrl = undefined;
        this.state = "connecting";
        this.emit("update");
        break;
      case LoginQRCallbackEventType.QRCodeScanned:
        this.pendingOwnName = event.data.display_name;
        this.state = "connecting";
        this.emit("update");
        break;
      case LoginQRCallbackEventType.QRCodeDeclined:
        this.state = "logged_out";
        this.lastError = "Da tu choi dang nhap tren dien thoai";
        this.emit("update");
        break;
      default:
        break;
    }
  }

  private onLoggedIn(ownId: string | undefined, ownName: string | undefined): void {
    this.state = "logged_in";
    this.ownId = ownId ?? this.api?.getOwnId();
    this.ownName = ownName;
    this.qrDataUrl = undefined;
    this.lastError = undefined;
    this.emit("update");
    this.emit("logged_in");
  }

  logout(): void {
    try {
      this.api?.listener.stop();
    } catch (err) {
      logger.warn({ err }, "loi khi dung Zalo listener luc dang xuat");
    }
    this.api = undefined;
    this.state = "logged_out";
    this.qrDataUrl = undefined;
    this.ownId = undefined;
    this.ownName = undefined;
    if (fs.existsSync(this.sessionFile)) fs.unlinkSync(this.sessionFile);
    this.emit("update");
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

  /**
   * Tra cuu zalo_id + ten hien thi tu so dien thoai, de trang Admin them NVKD ma khong
   * can biet/nhap zalo_id thu cong. Chi dung duoc khi da dang nhap Zalo. Tra ve undefined
   * neu khong tim thay nguoi dung voi so dien thoai nay (hoac ho khong cho phep tim kiem).
   */
  async findUserByPhone(phone: string): Promise<{ uid: string; displayName: string } | undefined> {
    const user = await this.getApi().findUser(phone);
    if (!user?.uid) return undefined;
    return { uid: user.uid, displayName: user.display_name || user.zalo_name || user.uid };
  }
}
