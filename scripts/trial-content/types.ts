import type { ExamSortZone } from "@prisma/client";

/**
 * Một thẻ tình huống của vòng phân loại.
 *
 * Nội dung tách khỏi scripts/seed-trial-cap2.ts vì mỗi đại tội có ngân hàng
 * khoảng 50 thẻ — để chung một file thì file đó thành hai nghìn dòng và không
 * ai soát nổi. Mỗi tội một file, thêm thẻ chỉ việc mở đúng file của tội đó.
 */
export type SortCardSeed = {
  text: string;
  correctZone: ExamSortZone;
  /** Vì sao đáp án đúng là vùng đó. Hiện ở màn soi lại sau khi chấm. */
  explanation: string;
};
