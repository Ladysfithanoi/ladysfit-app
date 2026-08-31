import { prisma } from "@/lib/prisma";

/**
 * ── Lượt thi ─────────────────────────────────────────────────────────────────
 *
 * Trước đây một bài thi chỉ tồn tại ở hai thời điểm rời rạc: lúc bốc đề
 * (GET /api/exam/take) và lúc nộp bài (POST /api/exam/attempts). Giữa hai mốc
 * đó server không nhớ gì cả, nên ba lỗ hổng sau là không vá được:
 *
 *   • Thi bao nhiêu lần cũng được, lần sau đè lần trước.
 *   • F5 là bốc đề mới và đồng hồ chạy lại từ đầu.
 *   • Không có chỗ nào để ghi "người này vừa chuyển tab đi đọc tài liệu".
 *
 * ExamSession là chỗ nhớ đó: mỗi người MỘT dòng cho MỘT kỳ thi (khoá theo ngày
 * thi). Đề đã bốc, mốc bắt đầu, số phút bị phạt và mốc nộp bài đều nằm ở server.
 *
 * Muốn cho ai đó thi lại thì Admin xoá bài của họ ở tab Kết quả thi — xoá bài
 * kéo theo xoá lượt, khoá tự mở.
 */

/** Hai sự kiện của cùng một lần rời trang (blur + visibilitychange) chỉ tính một. */
export const VIOLATION_DEBOUNCE_MS = 5_000;

export const ALREADY_TAKEN_MESSAGE =
  "Bạn đã hoàn thành bài thi của kỳ này rồi. Mỗi người chỉ được thi một lần duy nhất.";

export const SESSION_EXPIRED_MESSAGE =
  "Đã hết thời lượng làm bài của bạn cho kỳ thi này.";

export type DeadlineInput = {
  startedAt: Date;
  durationMinutes: number;
  penaltyMinutes: number;
};

/**
 * Mốc hết giờ của một lượt thi, đã trừ phạt rời trang và không bao giờ vượt quá
 * giờ đóng phòng thi. Trả null khi kỳ thi không giới hạn thời lượng.
 */
export function sessionDeadline(s: DeadlineInput, windowEndAt: Date | null): Date | null {
  if (s.durationMinutes <= 0) return null;
  const minutesLeft = s.durationMinutes - s.penaltyMinutes;
  const raw = new Date(s.startedAt.getTime() + minutesLeft * 60_000);
  if (windowEndAt && windowEndAt.getTime() < raw.getTime()) return windowEndAt;
  return raw;
}

/** Đề đã bốc của lượt thi, đọc ra từ JSON — hỏng thì coi như chưa bốc. */
export function parseQuestionIds(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Người này đã thi kỳ đang mở chưa.
 *
 * Kiểm cả hai chỗ: lượt thi đã nộp, VÀ bài thi đã có trong khung giờ của kỳ.
 * Vế thứ hai là để những bài nộp trước khi có bảng exam_sessions (hoặc bài
 * Admin nhập tay) vẫn khoá được người ta lại.
 */
export async function hasTakenExam(
  userId: string,
  examKey: string | null,
  window: { startAt: Date | null; endAt: Date | null }
): Promise<boolean> {
  if (examKey) {
    const s = await prisma.examSession.findUnique({
      where: { userId_examKey: { userId, examKey } },
      select: { submittedAt: true },
    });
    if (s?.submittedAt) return true;
  }
  if (!window.startAt || !window.endAt) return false;
  const prior = await prisma.examAttempt.count({
    where: { userId, createdAt: { gte: window.startAt, lte: window.endAt } },
  });
  return prior > 0;
}
