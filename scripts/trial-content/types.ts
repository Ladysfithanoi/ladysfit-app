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

/**
 * Một hồ sơ khách của vòng khay ăn.
 *
 * Chỉ tiêu nào để null thì vòng không chấm chỉ tiêu đó — phần lớn hồ sơ chỉ đặt
 * calo và đạm, vì đó là hai con số quyết định của một chương trình giảm cân hay
 * tăng cân, còn béo/đường thì đi theo.
 */
export type MealBriefSeed = {
  /** CUT giảm cân · BULK cần tăng calo · SPECIAL có ràng buộc bắt buộc. */
  kind: "CUT" | "BULK" | "SPECIAL";
  clientProfile: string;
  targetCalories: number;
  targetProtein: number;
  /** Sai số cho phép quanh mỗi chỉ tiêu (%). */
  tolerancePercent: number;
  /** Tên món khách KHÔNG được ăn — phải trùng đúng tên trong lib/foods-data.ts. */
  bannedFoods: string[];
  explanation: string;
};
