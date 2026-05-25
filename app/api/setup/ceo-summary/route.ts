import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichTargetsWithDynamicActuals } from "@/lib/compute-actuals";

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

  // Enrich all targets across all branches in one batch — same logic as Setup doanh số.
  // Weeks without a stored WeeklyActual row get their revenue computed dynamically
  // from SalesLead, keeping this screen in sync with the targets tab.
  const allTargets = branches.flatMap((b) => b.monthlyTargets);
  const enrichedTargets = await enrichTargetsWithDynamicActuals(allTargets, month, year);
  const enrichedById = new Map(enrichedTargets.map((t) => [t.id, t]));

  const summary = branches.map((b) => {
    const targets = b.monthlyTargets.map((t) => enrichedById.get(t.id) ?? t);

    const revenueTarget = targets.reduce((s, t) => s + (t.revenueTarget as number ?? 0), 0);
    const fitTarget     = targets.reduce((s, t) => s + (t.fitTarget as number ?? 0), 0);
    const transformTarget = targets.reduce((s, t) => s + (t.transformTarget as number ?? 0), 0);
    const googleTarget  = targets.reduce((s, t) => s + (t.googleReviewTarget as number ?? 0), 0);

    const allWeeks = targets.flatMap((t) => t.weeklyActuals);
    const revenueActual   = allWeeks.reduce((s, w) => s + (w.revenueActual ?? 0), 0);
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
