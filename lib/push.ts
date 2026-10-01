import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * Gửi thông báo đẩy (Web Push) tới mọi thiết bị đã đăng ký của các user.
 *
 * Khoá VAPID nằm trong biến môi trường:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — trình duyệt dùng để đăng ký
 *   VAPID_PRIVATE_KEY            — máy chủ dùng để ký thông báo
 *   VAPID_SUBJECT                — mailto: liên hệ (bắt buộc theo chuẩn)
 * Thiếu khoá thì im lặng bỏ qua: app vẫn chạy, chỉ là không có thông báo đẩy.
 */
export type PushPayload = {
  title: string;
  body: string;
  /** Mở trang này khi bấm vào thông báo. */
  url?: string;
  /** Cùng tag thì thông báo mới thay thông báo cũ thay vì xếp chồng. */
  tag?: string;
};

let configured: boolean | null = null;
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:ladysfit.mastertrainer@gmail.com", pub, priv);
  return (configured = true);
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!ensureConfigured() || userIds.length === 0) return 0;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: Array.from(new Set(userIds)) } },
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 30 * 60, urgency: "high" },
        );
        sent++;
      } catch (err) {
        // 404/410: thiết bị đã gỡ quyền hoặc xoá app — dọn đi cho khỏi gửi mãi.
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
  return sent;
}
