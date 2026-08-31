import { prisma } from "@/lib/prisma";

/**
 * FM bắt buộc thi.
 *
 * Bài thi thăng cấp vốn chỉ dành cho HLV: đậu thì được xét lên cấp, rớt thì
 * ghi nhận để thi lại. Admin cần thêm một thứ khác — bắt một số FM cùng làm
 * bài để biết trình độ chuyên môn của họ tới đâu. Nên FM ở đây làm cùng đề,
 * cùng khung giờ, điểm lưu lại cho Admin xem, NHƯNG bài thi không kéo theo hệ
 * quả nào: không thăng, không hạ, không thông báo, không vào xếp hạng.
 *
 * Ai không có tên trong bảng thì vẫn là FM bình thường, không thấy bài thi.
 */

/** Vai trò này có bị bắt thi không (chỉ FM mới cần tra bảng). */
export async function isRequiredExamFM(userId: string): Promise<boolean> {
  const row = await prisma.examRequiredFM.findUnique({ where: { userId } });
  return !!row;
}

/** Thông báo khi FM không nằm trong danh sách bắt buộc thi. */
export const NOT_REQUIRED_MESSAGE =
  "Bạn không nằm trong danh sách bắt buộc thi của kỳ thi này.";

/** Thông báo khi Admin đã khoá quyền vào thi của người này. */
export const BLOCKED_MESSAGE =
  "Quản lý đã khoá quyền vào thi của bạn cho kỳ thi này. Liên hệ quản lý nếu cần mở lại.";

/**
 * Admin có đang khoá quyền vào thi của người này không.
 *
 * Khoá gắn với TỪNG KỲ (examKey là ngày thi) nên sang kỳ mới là hết hiệu lực.
 * Bảng bật/tắt nằm ở tab Lịch thi — xem app/api/exam/access.
 */
export async function isExamBlocked(userId: string): Promise<boolean> {
  const config = await prisma.examConfig.findFirst({ select: { examDate: true } });
  const examKey = config?.examDate ?? null;
  if (!examKey) return false;
  const row = await prisma.examBlock.findUnique({
    where: { userId_examKey: { userId, examKey } },
  });
  return !!row;
}

export type SitCheck = { ok: true } | { ok: false; message: string };

/**
 * Người này có được vào làm bài thi thật không, và nếu không thì vì sao.
 *
 * Ba cửa, theo thứ tự: Admin có khoá tay không → vai trò có được thi không →
 * (riêng FM) có nằm trong danh sách bắt buộc thi không.
 */
export async function checkCanSitExam(userId: string, role: string): Promise<SitCheck> {
  if (await isExamBlocked(userId)) return { ok: false, message: BLOCKED_MESSAGE };
  if (role === "PT") return { ok: true };
  if (role === "FM") {
    return (await isRequiredExamFM(userId))
      ? { ok: true }
      : { ok: false, message: NOT_REQUIRED_MESSAGE };
  }
  return { ok: false, message: "Forbidden" };
}
