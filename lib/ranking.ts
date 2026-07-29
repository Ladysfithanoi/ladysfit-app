import { prisma } from "@/lib/prisma";
import { computePtStats } from "@/lib/pt-promotion";
import { RANK_WEIGHTS, type RankRow } from "@/lib/ranking-config";

// ── Xếp hạng nhân sự ─────────────────────────────────────────────────────────
// Điểm xếp hạng gộp 3 tiêu chí, mỗi tiêu chí quy về thang 100 rồi nhân trọng số:
//   1. Điểm thi   — % bài thi gần nhất trong năm (chưa thi = 0đ)
//   2. Doanh số   — TB doanh số/tháng, so với người cao nhất trong kỳ
//   3. Transform  — số khách transform, so với người cao nhất trong kỳ
// Doanh số và transform chấm theo tương quan nội bộ nên hạng luôn phản ánh
// đúng mặt bằng của kỳ đang xét.

export { RANK_WEIGHTS } from "@/lib/ranking-config";
export type { RankRow } from "@/lib/ranking-config";

/** Bảng xếp hạng toàn bộ PT đang hoạt động trong 1 năm. */
export async function computeRanking(year: number): Promise<RankRow[]> {
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
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const [stats, attempts] = await Promise.all([
    computePtStats(ptIds, year),
    prisma.examAttempt.findMany({
      where: { userId: { in: ptIds }, createdAt: { gte: yearStart, lt: yearEnd } },
      select: { userId: true, score: true, total: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Lần thi gần nhất trong năm của mỗi PT
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
    const points =
      examPoints * RANK_WEIGHTS.exam +
      revenuePoints * RANK_WEIGHTS.revenue +
      transformPoints * RANK_WEIGHTS.transform;
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
  year: number
): Promise<{ rank: number; total: number; points: number } | null> {
  const rows = await computeRanking(year);
  const me = rows.find((r) => r.ptId === userId);
  if (!me) return null;
  return { rank: me.rank, total: rows.length, points: me.points };
}
