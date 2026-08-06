import { prisma } from "@/lib/prisma";

/**
 * Tự đóng lộ trình đã kết thúc.
 *
 * Một gói đang ACTIVE tự hết khi:
 *   • HẾT BUỔI  — sessionsUsed >= sessions → COMPLETED
 *   • HẾT HẠN   — endDate đã qua (endDate đã cộng sẵn ngày bảo lưu + gia hạn) → EXPIRED
 *
 * sessionsUsed là số buổi KHÁCH ĐÃ CHECK-IN, không phải số buổi PT đã dạy thực
 * tế: khách ký check-in là buổi đã bị trừ khỏi lộ trình, nên gói phải đóng khi
 * hết buổi kể cả khi PT chưa ký check-out buổi đó (buổi bỏ dở, buổi bị huỷ vì
 * quá 2 tiếng). "Số buổi PT" chỉ dùng để tính lương, không đụng tới lộ trình.
 *
 * Chỉ ĐÓNG, không bao giờ tự mở lại — gói PAUSED (bảo lưu) và gói FM chủ động
 * đánh dấu kết thúc sớm đều giữ nguyên. Việc mở lại do thao tác rõ ràng của
 * người dùng (sửa số buổi đã tập, xoá/huỷ một buổi tập) đảm nhiệm.
 */
export type ClosePackagesResult = {
  completed: number;
  expired:   number;
  /** Khách có gói vừa bị đóng — cần chạy lại refreshClientChurnStatus. */
  clientIds: string[];
};

export async function closeFinishedPackages(clientId?: string): Promise<ClosePackagesResult> {
  const now = new Date();

  // Điều kiện "hết buổi" so sánh hai cột nên không viết được bằng Prisma filter;
  // lọc ở JS rồi cập nhật theo lô.
  const active = await prisma.packageEnrollment.findMany({
    where: { status: "ACTIVE", ...(clientId ? { clientId } : {}) },
    select: { id: true, clientId: true, sessions: true, sessionsUsed: true, endDate: true },
  });

  const completedIds: string[] = [];
  const expiredIds:   string[] = [];
  const touched = new Set<string>();

  for (const p of active) {
    if (p.sessionsUsed >= p.sessions) {
      completedIds.push(p.id);
      touched.add(p.clientId);
    } else if (p.endDate != null && p.endDate < now) {
      expiredIds.push(p.id);
      touched.add(p.clientId);
    }
  }

  if (completedIds.length > 0) {
    await prisma.packageEnrollment.updateMany({
      where: { id: { in: completedIds } },
      data:  { status: "COMPLETED" },
    });
  }
  if (expiredIds.length > 0) {
    await prisma.packageEnrollment.updateMany({
      where: { id: { in: expiredIds } },
      data:  { status: "EXPIRED" },
    });
  }

  return {
    completed: completedIds.length,
    expired:   expiredIds.length,
    clientIds: Array.from(touched),
  };
}
