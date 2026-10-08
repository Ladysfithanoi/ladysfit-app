// ── Khách chấm điểm buổi tập ────────────────────────────────────────────────
//
// Sau khi buổi tập đóng (COMPLETED), app khách hiện thẻ "Chị chấm buổi tập thế
// nào?" — 1 đến 5 sao kèm nhận xét. Mỗi buổi chấm một lần, người nhận điểm là
// người đứng lớp buổi đó (WorkoutLog.createdById). Điểm về Tổng quan Admin và
// Tổng quan FM (cơ sở họ quản lý).
//
// File này không import prisma để component client cũng dùng được.

/** Từ mức này trở lên là "hài lòng" — chỉ tiêu L0: 90% khách hài lòng. */
export const SATISFIED_MIN_SCORE = 4;

/** Buổi đóng quá ngần này ngày thì thôi không mời chấm nữa. */
export const RATING_WINDOW_DAYS = 7;

export const MAX_COMMENT_LENGTH = 1000;

export const SCORE_LABELS: Record<number, string> = {
  1: "Rất không hài lòng",
  2: "Chưa hài lòng",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Rất hài lòng",
};

export function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

export function isSatisfied(score: number): boolean {
  return score >= SATISFIED_MIN_SCORE;
}
