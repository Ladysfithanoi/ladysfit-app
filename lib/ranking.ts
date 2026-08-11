import { prisma } from "@/lib/prisma";
import {
  DEFAULT_RANK_WEIGHTS,
  isValidWeights,
  periodMonths,
  type RankPeriod,
  type RankRow,
  type RankWeights,
} from "@/lib/ranking-config";
import { countTransformsByPt } from "@/lib/transform-credit";

// ── Xếp hạng nhân sự ─────────────────────────────────────────────────────────
// Điểm xếp hạng gộp 3 tiêu chí, mỗi tiêu chí quy về thang 100 rồi nhân trọng số:
//   1. Điểm thi   — % bài thi gần nhất trong kỳ (chưa thi = 0đ)
//   2. Doanh số   — TB doanh số/tháng trong kỳ, so với người cao nhất
//   3. Transform  — số khách transform được ghi công trong kỳ, so với người cao nhất
// Doanh số và transform chấm theo tương quan nội bộ nên hạng luôn phản ánh
// đúng mặt bằng của kỳ đang xét. Trọng số do admin chỉnh ở Đề thi > Cấu hình.
// Kỳ có thể là tháng, quý hoặc năm — chỉ dữ liệu phát sinh trong kỳ được tính.

export type { RankRow, RankWeights } from "@/lib/ranking-config";

/** Khoảng thời gian [start, end) của kỳ. */
function periodRange(period: RankPeriod): { start: Date; end: Date } {
  const months = periodMonths(period);
  const first = months[0];
  const last = months[months.length - 1];
  return {
    start: new Date(period.year, first - 1, 1),
    end: new Date(period.year, last, 1), // đầu tháng kế tiếp
  };
}

/**
 * Các tháng thực sự được tính vào TB doanh số. Tháng đang diễn ra bị loại để
 * số liệu dở dang không kéo trung bình xuống — trừ khi kỳ chỉ có mỗi tháng đó.
 */
function countedMonths(period: RankPeriod, now: Date = new Date()): number[] {
  const all = periodMonths(period);
  if (period.year < now.getFullYear()) return all;
  if (period.year > now.getFullYear()) return [];

  const currentMonth = now.getMonth() + 1;
  if (period.type === "month") return all; // xem tháng nào thì lấy đúng tháng đó
  const elapsed = all.filter((m) => m < currentMonth);
  return elapsed.length > 0 ? elapsed : all.filter((m) => m === currentMonth);
}

type PtPeriodStat = { avgMonthlyRevenue: number; transformedCount: number };

/**
 * TB doanh số/tháng (triệu) + số khách transform của từng PT trong kỳ.
 * Transform lấy mốc là lần cân đầu tiên giảm đủ 7 kg và chỉ ghi công cho người
 * đã kèm khách ≥ 6 tuần tính đến mốc đó — xem lib/transform-credit.ts.
 */
export async function computePtPeriodStats(
  ptIds: string[],
  period: RankPeriod
): Promise<Map<string, PtPeriodStat>> {
  const stats = new Map<string, PtPeriodStat>();
  if (ptIds.length === 0) return stats;

  const months = countedMonths(period);
  const { start, end } = periodRange(period);

  const [leads, transformByPt] = await Promise.all([
    months.length > 0
      ? prisma.salesLead.findMany({
          where: { assignedPTId: { in: ptIds }, year: period.year, month: { in: months } },
          select: { assignedPTId: true, actualRevenue: true },
        })
      : Promise.resolve([]),
    countTransformsByPt(start, end),
  ]);

  const revenueByPt = new Map<string, number>();
  for (const l of leads) {
    if (!l.assignedPTId) continue;
    revenueByPt.set(l.assignedPTId, (revenueByPt.get(l.assignedPTId) ?? 0) + (l.actualRevenue ?? 0));
  }

  const divisor = Math.max(months.length, 1);
  for (const id of ptIds) {
    stats.set(id, {
      avgMonthlyRevenue: (revenueByPt.get(id) ?? 0) / divisor,
      transformedCount: transformByPt.get(id) ?? 0,
    });
  }
  return stats;
}

/** Trọng số đang cấu hình; sai lệch (dữ liệu cũ) thì rơi về mặc định. */
export async function getRankWeights(): Promise<RankWeights> {
  const config = await prisma.examConfig.findFirst({
    select: { rankWeightExam: true, rankWeightRevenue: true, rankWeightTransform: true },
  });
  if (!config) return DEFAULT_RANK_WEIGHTS;

  const weights: RankWeights = {
    exam: config.rankWeightExam,
    revenue: config.rankWeightRevenue,
    transform: config.rankWeightTransform,
  };
  return isValidWeights(weights) ? weights : DEFAULT_RANK_WEIGHTS;
}

/** Bảng xếp hạng toàn bộ PT đang hoạt động trong 1 kỳ. */
export async function computeRanking(
  period: RankPeriod,
  weights?: RankWeights
): Promise<RankRow[]> {
  const w = weights ?? (await getRankWeights());
  const pts = await prisma.user.findMany({
    where: { role: "PT", deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      branch: { select: { name: true } },
      ptLevel: { select: { name: true, color: true } },
    },
    orderBy: { name: "asc" },
  });

  if (pts.length === 0) return [];

  const ptIds = pts.map((p) => p.id);
  const { start, end } = periodRange(period);

  const [stats, attempts] = await Promise.all([
    computePtPeriodStats(ptIds, period),
    prisma.examAttempt.findMany({
      where: { userId: { in: ptIds }, createdAt: { gte: start, lt: end } },
      select: { userId: true, score: true, total: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Lần thi gần nhất trong kỳ của mỗi PT
  const lastExam = new Map<string, { score: number; total: number }>();
  for (const a of attempts) {
    if (!lastExam.has(a.userId)) lastExam.set(a.userId, { score: a.score, total: a.total });
  }

  const base = pts.map((pt) => {
    const stat = stats.get(pt.id) ?? { avgMonthlyRevenue: 0, transformedCount: 0 };
    const exam = lastExam.get(pt.id);
    return {
      ptId: pt.id,
      name: pt.name ?? pt.email,
      email: pt.email,
      branchName: pt.branch?.name ?? null,
      levelName: pt.ptLevel?.name ?? null,
      levelColor: pt.ptLevel?.color ?? null,
      // Không thi tính 0 điểm
      examScore: exam && exam.total > 0 ? Math.round((exam.score / exam.total) * 100) : 0,
      hasExam: !!exam,
      avgMonthlyRevenue: stat.avgMonthlyRevenue,
      transformedCount: stat.transformedCount,
    };
  });

  const maxRevenue = Math.max(...base.map((b) => b.avgMonthlyRevenue), 0);
  const maxTransform = Math.max(...base.map((b) => b.transformedCount), 0);

  const scored = base.map((b) => {
    const examPoints = b.examScore;
    const revenuePoints = maxRevenue > 0 ? (b.avgMonthlyRevenue / maxRevenue) * 100 : 0;
    const transformPoints = maxTransform > 0 ? (b.transformedCount / maxTransform) * 100 : 0;
    // Trọng số lưu theo % nên chia 100 khi gộp điểm
    const points =
      (examPoints * w.exam + revenuePoints * w.revenue + transformPoints * w.transform) / 100;
    return {
      ...b,
      examPoints: Math.round(examPoints * 10) / 10,
      revenuePoints: Math.round(revenuePoints * 10) / 10,
      transformPoints: Math.round(transformPoints * 10) / 10,
      points: Math.round(points * 10) / 10,
    };
  });

  scored.sort(
    (a, b) =>
      b.points - a.points ||
      b.avgMonthlyRevenue - a.avgMonthlyRevenue ||
      b.transformedCount - a.transformedCount ||
      b.examScore - a.examScore ||
      a.name.localeCompare(b.name, "vi")
  );

  // Bằng điểm thì đồng hạng, hạng kế tiếp nhảy qua số suất đã dùng
  const rows: RankRow[] = [];
  scored.forEach((row, i) => {
    const prev = rows[i - 1];
    rows.push({ ...row, rank: prev && prev.points === row.points ? prev.rank : i + 1 });
  });

  return rows;
}

/** Hạng của 1 người trong kỳ — dùng cho thẻ hiển thị ở trang Tổng quan. */
export async function getMyRank(
  userId: string,
  period: RankPeriod,
  weights?: RankWeights
): Promise<{ rank: number; total: number; points: number } | null> {
  const rows = await computeRanking(period, weights);
  const me = rows.find((r) => r.ptId === userId);
  if (!me) return null;
  return { rank: me.rank, total: rows.length, points: me.points };
}
