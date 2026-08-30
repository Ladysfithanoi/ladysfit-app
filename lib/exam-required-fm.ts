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

/** Người này có được vào làm bài thi thật không. */
export async function canSitExam(userId: string, role: string): Promise<boolean> {
  if (role === "PT") return true;
  if (role === "FM") return isRequiredExamFM(userId);
  return false;
}

/** Thông báo khi FM không nằm trong danh sách bắt buộc thi. */
export const NOT_REQUIRED_MESSAGE =
  "Bạn không nằm trong danh sách bắt buộc thi của kỳ thi này.";
