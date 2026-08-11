import type { Message, TAttachmentContent } from "zca-js";
import { logger } from "../logger.js";

function isAttachmentContent(content: unknown): content is TAttachmentContent {
  return typeof content === "object" && content !== null && !Array.isArray(content);
}

/**
 * Zalo (unofficial) khong co tai lieu chinh thuc cho cau truc noi dung tin nhan anh.
 * Heuristic: khi `data.content` la object (khong phai string), day thuong la mot attachment
 * (anh/file/link). Uu tien `href` (anh goc), fallback sang `thumb`, va thu doc them cac URL
 * chat luong cao hon trong `params` (JSON string) neu co. Neu Zalo doi cau truc, chinh sua tai day.
 */
export function extractImageUrl(message: Message): string | undefined {
  const content = message.data.content;
  if (!isAttachmentContent(content)) return undefined;

  let bestUrl: string | undefined;
  if (typeof content.params === "string") {
    try {
      const parsed = JSON.parse(content.params) as Record<string, unknown>;
      for (const key of ["hdUrl", "oriUrl", "normalUrl", "fullUrl"]) {
        const value = parsed[key];
        if (typeof value === "string" && value.startsWith("http")) {
          bestUrl = value;
          break;
        }
      }
    } catch {
      // params khong phai JSON hop le - bo qua, dung href/thumb ben duoi
    }
  }

  if (!bestUrl && typeof content.href === "string" && content.href.startsWith("http")) {
    bestUrl = content.href;
  }
  if (!bestUrl && typeof content.thumb === "string" && content.thumb.startsWith("http")) {
    bestUrl = content.thumb;
  }

  if (!bestUrl) {
    logger.debug({ content }, "khong tim thay URL anh trong noi dung tin nhan");
  }
  return bestUrl;
}

export function isTextMessage(message: Message): message is Message & { data: { content: string } } {
  return typeof message.data.content === "string";
}

export function getTextContent(message: Message): string | undefined {
  return isTextMessage(message) ? message.data.content : undefined;
}
