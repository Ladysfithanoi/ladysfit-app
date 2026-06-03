export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichTargetsWithDynamicActuals } from "@/lib/compute-actuals";

// Same KPI set as the monthly report (Báo cáo tháng), just aggregated by quarter / year.
const KPIS = [
  { key: "revenue", label: "Doanh số (triệu)", targetKey: "revenueTarget", actualKey: "revenueActual", isFloat: true },
  { key: "fitpartner", label: "Doanh thu Fitpartner (triệu)", targetKey: "fitpartnerRevenueTarget", actualKey: "fitpartnerRevenueActual", isFloat: true, fitpartnerOnly: true },
  { key: "fit", label: "FIT (KH trải nghiệm)", targetKey: "fitTarget", actualKey: "fitActual", isFloat: false },
  { key: "cooperation", label: "KH hợp tác", targetKey: "cooperationTarget", actualKey: "cooperationActual", isFloat: false },
  { key: "transform", label: "Transform", targetKey: "transformTarget", actualKey: "transformActual", isFloat: false },
  { key: "google", label: "Google Business", targetKey: "googleReviewTarget", actualKey: "googleReviewActual", isFloat: false },
  { key: "cv", label: "CV tuyển dụng", targetKey: "cvTarget", actualKey: "cvActual", isFloat: false },
] as const;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const year = parseInt(searchParams.get("year") ?? "0");
  const period = searchParams.get("period") === "year" ? "year" : "quarter";
  const quarter = parseInt(searchParams.get("quarter") ?? "0");

  if (!branchId || !year || (period === "quarter" && (quarter < 1 || quarter > 4))) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];
  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
  const isFitpartner = (branch?.name ?? "").toLowerCase().includes("fitpartner");
  const activeKpis = KPIS.filter((k) => !("fitpartnerOnly" in k && k.fitpartnerOnly) || isFitpartner);

  const months =
    period === "year"
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      : [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3];

  // Per-month aggregate of each KPI (sum across PTs + weeks), identical to monthly report.
  const perMonth = await Promise.all(
    months.map(async (m) => {
      const where: Record<string, unknown> = { branchId, month: m, year, user: { deletedAt: null } };
      if (isPT) where.userId = session.user.id;

      const targets = await prisma.monthlyTarget.findMany({
        where,
        include: { weeklyActuals: { orderBy: { weekNumber: "asc" } } },
        orderBy: { createdAt: "asc" },
      });
      const enriched = await enrichTargetsWithDynamicActuals(targets, m, year);

      const agg: Record<string, { target: number; actual: number }> = {};
      for (const kpi of activeKpis) {
        let target = 0;
        let actual = 0;
        for (const t of enriched) {
          target += Number((t as Record<string, unknown>)[kpi.targetKey] ?? 0);
          for (const wa of t.weeklyActuals) {
            actual += Number((wa as Record<string, unknown>)[kpi.actualKey] ?? 0);
          }
        }
        agg[kpi.key] = { target, actual };
      }
      return { month: m, agg };
    })
  );

  const byMonth = new Map(perMonth.map((p) => [p.month, p.agg]));

  // Sub-periods: quarter → its 3 months; year → its 4 quarters.
  const subPeriods =
    period === "year"
      ? [1, 2, 3, 4].map((q) => ({ short: `Q${q}`, label: `Quý ${q}`, months: [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3] }))
      : months.map((m) => ({ short: `T${m}`, label: `Tháng ${m}`, months: [m] }));

  const rows = activeKpis.map((kpi) => {
    const subTargets: number[] = [];
    const subActuals: number[] = [];
    for (const sp of subPeriods) {
      let target = 0;
      let actual = 0;
      for (const m of sp.months) {
        const a = byMonth.get(m)?.[kpi.key];
        target += a?.target ?? 0;
        actual += a?.actual ?? 0;
      }
      subTargets.push(target);
      subActuals.push(actual);
    }
    const totalTarget = subTargets.reduce((s, v) => s + v, 0);
    const totalActual = subActuals.reduce((s, v) => s + v, 0);
    const pct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
    return { key: kpi.key, label: kpi.label, isFloat: kpi.isFloat, subTargets, subActuals, totalTarget, totalActual, pct };
  });

  return NextResponse.json({
    period,
    year,
    quarter: period === "quarter" ? quarter : null,
    subPeriods: subPeriods.map((s) => ({ short: s.short, label: s.label })),
    totalLabel: period === "year" ? "Năm" : "Quý",
    rows,
  });
}
