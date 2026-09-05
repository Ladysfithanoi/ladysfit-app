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
  /**
   * CUT giảm cân · SPECIAL có ràng buộc bắt buộc (dị ứng, bệnh nền, thai kỳ…).
   *
   * Không có nhóm "tăng cân": phòng tập không nhận khách mục tiêu đó, nên một
   * hồ sơ như vậy là tình huống không có thật và không đo được gì.
   */
  kind: "CUT" | "SPECIAL";
  clientProfile: string;
  targetCalories: number;
  targetProtein: number;
  /** Suy ra từ calo và đạm: phần năng lượng còn lại chia béo 30% / bột đường 70%. */
  targetFat: number;
  targetCarbs: number;
  /** Sai số cho phép quanh mỗi chỉ tiêu (%). */
  tolerancePercent: number;
  /** Tên món khách KHÔNG được ăn — phải trùng đúng tên trong lib/foods-data.ts. */
  bannedFoods: string[];
  explanation: string;
};

/**
 * Một hồ sơ của vòng DỰNG GIÁO ÁN.
 *
 * Chỉ tiêu nào để null thì vòng không chấm mục đó — nhưng lưu ý 0 KHÁC null:
 * targetUpperSets = 0 nghĩa là "buổi này không được có bài thân trên", còn null
 * là "không chấm". Buổi chia nhóm dùng số 0, buổi toàn thân dùng null.
 */
export type ProgramCaseSeed = {
  clientProfile: string;
  targetTotalSets: number | null;
  targetLowerSets: number | null;
  targetUpperSets: number | null;
  targetCoreSets: number | null;
  tolerancePercent: number;
  /** Mẫu vận động bắt buộc — phải trùng đúng pattern trong lib/exercises-data.ts. */
  requiredPatterns: string[];
  /** Bài chống chỉ định — phải trùng đúng tên bài trong lib/exercises-data.ts. */
  bannedExercises: string[];
  explanation: string;
};
