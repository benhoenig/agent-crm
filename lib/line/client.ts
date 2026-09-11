import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// LINE Messaging API access (ported from the Solo Gang dashboard). The
// channel access token + secret live in env (worker secrets in prod) and
// never reach the browser. v1 only REPLIES — replies ride a webhook event's
// single-use token and are free; there is no push (no LINE quota spend).

const REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

export const lineConfigured = () =>
  Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET);

/** Free reply via a webhook event's single-use token (max 5 messages). */
export async function reply(replyToken: string, messages: object[]) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  const res = await fetch(REPLY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LINE reply failed (${res.status}): ${detail}`);
  }
}

export const textMessage = (text: string) => ({
  type: "text",
  text: text.slice(0, 5000),
});

/**
 * Verify x-line-signature: HMAC-SHA256 over the RAW body bytes (never a
 * re-serialized object). False on any mismatch or missing config → 401.
 */
export function verifySignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
