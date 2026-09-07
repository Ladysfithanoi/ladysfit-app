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

/**
 * Mở lại lộ trình đã tự hết hạn nhưng nay lại còn hạn.
 *
 * FM gia hạn (hoặc bảo lưu thêm ngày, hoặc sửa ngày bắt đầu) cho một gói đã
 * EXPIRED thì endDate được đẩy ra tương lai — nhưng trạng thái vẫn nằm ở
 * EXPIRED. Mọi chỗ trừ buổi và chặn check-in đều đòi ACTIVE, nên theo lý thì
 * khách được ký tiếp mà thực tế vẫn bị chặn vì "đã hết hạn". Chỗ này đưa gói
 * đó trở lại ACTIVE.
 *
 * CHỈ đụng tới EXPIRED: đó là trạng thái duy nhất hệ thống tự đặt vì lý do
 * THỜI GIAN, nên thời gian đổi thì đảo ngược được. COMPLETED (hết buổi, hoặc
 * FM chủ động đánh dấu kết thúc sớm) và PAUSED (bảo lưu) là quyết định của
 * con người — mở lại phải do người dùng bấm, xem closeFinishedPackages.
 *
 * Trả về danh sách khách có gói vừa mở lại — cần chạy reactivateClientOnNewPackage
 * để họ ra khỏi trạng thái "Nghỉ tập".
 */
export async function reopenExtendedPackages(clientId?: string): Promise<string[]> {
  const now = new Date();

  const revived = await prisma.packageEnrollment.findMany({
    where: {
      status:  "EXPIRED",
      endDate: { gt: now },
      ...(clientId ? { clientId } : {}),
    },
    select: { id: true, clientId: true, sessions: true, sessionsUsed: true },
  });

  // Hết buổi rồi thì thêm bao nhiêu ngày cũng không cứu được — để nguyên.
  const usable = revived.filter((p) => p.sessionsUsed < p.sessions);
  if (usable.length === 0) return [];

  await prisma.packageEnrollment.updateMany({
    where: { id: { in: usable.map((p) => p.id) } },
    data:  { status: "ACTIVE" },
  });

  return Array.from(new Set(usable.map((p) => p.clientId)));
}
