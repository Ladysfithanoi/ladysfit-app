// ── Thưởng Google Business của FM ───────────────────────────────────────────
//
// Giống tiền show: người tạo bảng lương NHẬP số lượt đánh giá, thưởng = số lượt ×
// đơn giá. Ảnh đánh giá (google_review_proofs) chỉ để ĐỐI CHIẾU — một ảnh chụp có
// thể gồm nhiều đánh giá nên không đếm ảnh ra tiền.

export const GOOGLE_BONUS_AMOUNT = 100_000;

/** Số ảnh đối chiếu tối đa của một cơ sở trong một tháng. */
export const MAX_GOOGLE_REVIEW_IMAGES = 10;

/** Số lượt nhập tay → số nguyên không âm. */
export function normalizeReviewCount(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
