// Trọng số & kiểu dữ liệu xếp hạng — tách riêng để client component dùng được
// (lib/ranking.ts có import prisma nên chỉ chạy phía server).

export const RANK_WEIGHTS = { exam: 0.3, revenue: 0.4, transform: 0.3 };

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
