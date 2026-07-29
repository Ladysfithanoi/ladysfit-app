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
