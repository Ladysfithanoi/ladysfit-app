import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vnMonthStart } from "@/lib/format-date";
import { isSatisfied } from "@/lib/session-rating";
import { monthYearParams, statsBranchIds } from "@/lib/stats-scope";

// GET /api/dashboard/session-ratings?month=&year=&branchId=
// Điểm khách chấm buổi tập trong tháng (giờ VN), theo PT — Tổng quan Admin/FM.

type Agg = { count: number; sum: number; satisfied: number; dist: [number, number, number, number, number] };

const emptyAgg = (): Agg => ({ count: 0, sum: 0, satisfied: 0, dist: [0, 0, 0, 0, 0] });

function add(a: Agg, score: number) {
  a.count++;
  a.sum += score;
  if (isSatisfied(score)) a.satisfied++;
  a.dist[score - 1]++;
}

const out = (a: Agg) => ({
  count: a.count,
  avg: a.count ? Math.round((a.sum / a.count) * 100) / 100 : null,
  satisfiedPct: a.count ? Math.round((a.satisfied / a.count) * 1000) / 10 : null,
  dist: a.dist,
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branchIds = await statsBranchIds(session.user, new URL(req.url).searchParams.get("branchId"));
  if (!branchIds) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { month, year } = monthYearParams(req.url);
  const ratings = await prisma.sessionRating.findMany({
    where: {
      branchId: { in: branchIds },
      createdAt: { gte: vnMonthStart(year, month), lt: vnMonthStart(year, month + 1) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      score: true,
      comment: true,
      createdAt: true,
      ptId: true,
      pt: { select: { name: true, email: true } },
      client: { select: { id: true, fullName: true } },
      branch: { select: { name: true } },
      workoutLog: { select: { sessionDate: true, session: { select: { sessionName: true } } } },
    },
  });

  const total = emptyAgg();
  const byPt = new Map<string, { ptName: string; branches: Set<string>; agg: Agg; lastComment: string | null }>();
  for (const r of ratings) {
    add(total, r.score);
    let row = byPt.get(r.ptId);
    if (!row) {
      row = { ptName: r.pt.name ?? r.pt.email, branches: new Set(), agg: emptyAgg(), lastComment: null };
      byPt.set(r.ptId, row);
    }
    row.branches.add(r.branch.name);
    add(row.agg, r.score);
    if (!row.lastComment && r.comment) row.lastComment = r.comment;
  }

  return NextResponse.json({
    summary: out(total),
    byPt: Array.from(byPt.entries())
      .map(([ptId, r]) => ({ ptId, ptName: r.ptName, branchName: Array.from(r.branches).join(", "), lastComment: r.lastComment, ...out(r.agg) }))
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0) || b.count - a.count),
    ratings: ratings.map((r) => ({
      id: r.id,
      ptId: r.ptId,
      ptName: r.pt.name ?? r.pt.email,
      clientId: r.client.id,
      clientName: r.client.fullName,
      branchName: r.branch.name,
      score: r.score,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      sessionDate: r.workoutLog.sessionDate.toISOString(),
      sessionName: r.workoutLog.session.sessionName,
    })),
  });
}
