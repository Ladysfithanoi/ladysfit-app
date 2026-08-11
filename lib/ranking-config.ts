// Trọng số & kiểu dữ liệu xếp hạng — tách riêng để client component dùng được
// (lib/ranking.ts có import prisma nên chỉ chạy phía server).

/** Trọng số 3 tiêu chí, đơn vị %, tổng luôn bằng 100. */
export type RankWeights = { exam: number; revenue: number; transform: number };

export const DEFAULT_RANK_WEIGHTS: RankWeights = { exam: 30, revenue: 40, transform: 30 };

export const WEIGHT_TOTAL = 100;

/** Trọng số hợp lệ khi cả 3 đều >= 0 và tổng đúng 100. */
export function isValidWeights(w: RankWeights): boolean {
  const vals = [w.exam, w.revenue, w.transform];
  if (vals.some((v) => !Number.isInteger(v) || v < 0 || v > WEIGHT_TOTAL)) return false;
  return vals.reduce((a, b) => a + b, 0) === WEIGHT_TOTAL;
}

// ── Kỳ xếp hạng ──────────────────────────────────────────────────────────────
// Tháng / quý chỉ tính doanh số và transform phát sinh trong kỳ đó.

export type RankPeriodType = "month" | "quarter" | "year";

export type RankPeriod = {
  type: RankPeriodType;
  year: number;
  month: number; // 1-12, chỉ dùng khi type = "month"
  quarter: number; // 1-4, chỉ dùng khi type = "quarter"
};

export function periodLabel(p: RankPeriod): string {
  if (p.type === "month") return `Tháng ${p.month}/${p.year}`;
  if (p.type === "quarter") return `Quý ${p.quarter}/${p.year}`;
  return `Năm ${p.year}`;
}

/** Các tháng (1-12) thuộc kỳ. */
export function periodMonths(p: RankPeriod): number[] {
  if (p.type === "month") return [p.month];
  if (p.type === "quarter") {
    const start = (p.quarter - 1) * 3 + 1;
    return [start, start + 1, start + 2];
  }
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

export function currentPeriod(now: Date = new Date()): RankPeriod {
  const month = now.getMonth() + 1;
  return {
    type: "year",
    year: now.getFullYear(),
    month,
    quarter: Math.floor((month - 1) / 3) + 1,
  };
}

/**
 * Trọng số dùng cho xếp hạng phòng tập: bỏ điểm thi (phòng tập không đi thi),
 * chia lại phần của doanh số và transform cho tổng vẫn bằng 100 — admin chỉnh
 * trọng số ở Đề thi > Cấu hình thì bảng phòng tập đổi theo cùng tỉ lệ.
 */
export function branchWeights(w: RankWeights): { revenue: number; transform: number } {
  const total = w.revenue + w.transform;
  if (total <= 0) return { revenue: 50, transform: 50 };
  const revenue = Math.round((w.revenue / total) * WEIGHT_TOTAL);
  return { revenue, transform: WEIGHT_TOTAL - revenue };
}

export type BranchRankRow = {
  branchId: string;
  name: string;
  avgMonthlyRevenue: number; // triệu/tháng
  /** Số khách transform của phòng trong kỳ — đếm cả khách của nhân sự đã nghỉ. */
  transformedCount: number;
  revenuePoints: number;
  transformPoints: number;
  points: number; // điểm tổng, thang 100
  rank: number;
};

export type RankRow = {
  ptId: string;
  name: string;
  email: string;
  branchName: string | null;
  levelName: string | null;
  levelColor: string | null;
  examScore: number; // % bài thi gần nhất, 0 nếu chưa thi
  hasExam: boolean;
  avgMonthlyRevenue: number; // triệu/tháng
  transformedCount: number;
  examPoints: number;
  revenuePoints: number;
  transformPoints: number;
  points: number; // điểm tổng, thang 100
  rank: number;
};
