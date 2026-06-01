export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["ADMIN", "CEO_FITPARTNER", "COO"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "0");
  const year = parseInt(searchParams.get("year") ?? "0");

  if (!month || !year) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const branches = await prisma.branch.findMany({
    where: { name: { not: { contains: "Fitpartner" } } },
    orderBy: { name: "asc" },
    include: {
      fmAssignments: {
        include: { user: { select: { id: true, name: true } } },
        take: 1,
      },
      monthlyTargets: {
        where: { month, year },
        include: { weeklyActuals: true },
      },
    },
  });

  const branchIds = branches.map((b) => b.id);

  // Revenue: sum actualRevenue across ALL leads for the branch/month — identical to the
  // "Tổng doanh thu" card in Setup Doanh số (leads-tab), which counts every lead regardless
  // of status or sign date. No status / signDate filter so the two screens always match.
  const leads = await prisma.salesLead.findMany({
    where: {
      branchId: { in: branchIds },
      month,
      year,
    },
    select: { branchId: true, actualRevenue: true },
  });

  const revenueByBranch = new Map<string, number>();
  for (const lead of leads) {
    const prev = revenueByBranch.get(lead.branchId) ?? 0;
    revenueByBranch.set(lead.branchId, prev + (lead.actualRevenue ?? 0));
  }

  const summary = branches.map((b) => {
    const targets = b.monthlyTargets;

    const revenueTarget   = targets.reduce((s, t) => s + (t.revenueTarget ?? 0), 0);
    const fitTarget       = targets.reduce((s, t) => s + (t.fitTarget ?? 0), 0);
    const transformTarget = targets.reduce((s, t) => s + (t.transformTarget ?? 0), 0);
    const googleTarget    = targets.reduce((s, t) => s + (t.googleReviewTarget ?? 0), 0);

    // revenueActual: fresh from SalesLead (same source as monthly-stats)
    const revenueActual = revenueByBranch.get(b.id) ?? 0;

    // Other KPIs: from WeeklyActual (manually entered by FM/PT)
    const allWeeks = targets.flatMap((t) => t.weeklyActuals);
    const fitActual       = allWeeks.reduce((s, w) => s + (w.fitActual ?? 0), 0);
    const transformActual = allWeeks.reduce((s, w) => s + (w.transformActual ?? 0), 0);
    const googleActual    = allWeeks.reduce((s, w) => s + (w.googleReviewActual ?? 0), 0);

    return {
      branchId: b.id,
      branchName: b.name,
      fm: b.fmAssignments[0]?.user?.name ?? null,
      revenueTarget,
      revenueActual,
      revenuePct: revenueTarget > 0 ? Math.round((revenueActual / revenueTarget) * 100) : 0,
      fitTarget,
      fitActual,
      transformTarget,
      transformActual,
      googleTarget,
      googleActual,
    };
  });

  return NextResponse.json(summary);
}
