import { prisma } from "@/lib/prisma";

// ── Thưởng Google Business của FM — đếm từ ảnh đánh giá đã tải lên ──────────
//
// Mỗi ảnh trong google_review_proofs là bằng chứng cho MỘT đánh giá, nên số ảnh
// của cơ sở trong tháng chính là số đánh giá được thưởng. Không còn ô nhập tay:
// con số không kèm ảnh thì không ai đối chiếu được.
//
// Đi theo ô "hưởng hoa hồng doanh số cả phòng" giống thưởng Renew
// (lib/renew-bonus): cơ sở nhiều FM thì chỉ người được tích nhận.

export const GOOGLE_BONUS_AMOUNT = 100_000;

export async function getBranchGoogleReviewCount(branchId: string, month: number, year: number): Promise<number> {
  return prisma.googleReviewProof.count({ where: { branchId, month, year } });
}
