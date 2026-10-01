import { prisma } from "@/lib/prisma";
import { MAX_SESSION_MINUTES } from "@/lib/workout-session";
import { sendPushToUsers } from "@/lib/push";

/**
 * Đẩy thông báo nhắc ký check-out — cùng cửa sổ với thanh cảnh báo vàng
 * (GET /api/workout-logs/pending-checkout): đã check-in quá 90' mà chưa đóng.
 *
 * Hai lần nhắc, đánh dấu bằng workout_logs.checkoutPushCount để không gửi lặp:
 *   1. Phút 90  → PT dạy buổi đó + PT phụ trách khách.
 *   2. Phút 110 → nhắc lần cuối (còn 10' là buổi bị huỷ, không tính lương),
 *                 gửi thêm cho FM của chi nhánh để đôn đốc.
 */
const FIRST_MINUTES = 90;
const LAST_MINUTES = MAX_SESSION_MINUTES - 10;

export async function sendCheckoutReminders(): Promise<{ first: number; last: number }> {
  const now = Date.now();
  const cap = new Date(now - MAX_SESSION_MINUTES * 60_000);
  const result = { first: 0, last: 0 };

  for (const stage of [1, 2] as const) {
    const minutes = stage === 1 ? FIRST_MINUTES : LAST_MINUTES;
    const logs = await prisma.workoutLog.findMany({
      where: {
        status: "IN_PROGRESS",
        // Lần 1 không nhận buổi đã quá mốc lần 2 (cron lỡ nhịp) — để lần 2 lo,
        // khỏi bắn hai thông báo liền nhau.
        checkInAt: {
          lt: new Date(now - minutes * 60_000),
          gte: stage === 1 ? new Date(now - LAST_MINUTES * 60_000) : cap,
        },
        checkoutPushCount: { lt: stage },
      },
      select: {
        id: true,
        createdById: true,
        client: { select: { id: true, fullName: true, assignedPTId: true, branchId: true } },
      },
    });

    for (const log of logs) {
      // Đánh dấu TRƯỚC khi gửi: cron chạy chồng nhau cũng chỉ một lần thắng.
      const claimed = await prisma.workoutLog.updateMany({
        where: { id: log.id, checkoutPushCount: { lt: stage } },
        data: { checkoutPushCount: stage },
      });
      if (claimed.count === 0) continue;

      const recipients = [log.createdById, log.client.assignedPTId].filter((x): x is string => !!x);
      if (stage === 2 && log.client.branchId) {
        const fms = await prisma.fMBranchAssignment.findMany({
          where: { branchId: log.client.branchId },
          select: { userId: true },
        });
        recipients.push(...fms.map((f) => f.userId));
      }

      await sendPushToUsers(recipients, {
        title: stage === 1 ? "Chưa ký check-out" : "⚠️ Sắp huỷ buổi — ký check-out ngay",
        body: stage === 1
          ? `Buổi của ${log.client.fullName} đã quá 90 phút mà chưa ký check-out.`
          : `Buổi của ${log.client.fullName} còn khoảng 10 phút là bị huỷ và không tính buổi dạy.`,
        url: `/dashboard/clients/${log.client.id}`,
        tag: `checkout-${log.id}`,
      });
      if (stage === 1) result.first++; else result.last++;
    }
  }
  return result;
}
