import { prisma } from "@/lib/prisma";

function computeWeekBounds(year: number, month: number) {
  const d = new Date(year, month - 1, 1);
  const dow = d.getDay() || 7;
  const firstMon = new Date(d);
  firstMon.setDate(d.getDate() - dow + 1);
  return [1, 2, 3, 4, 5].map((w) => {
    const start = new Date(firstMon);
    start.setDate(firstMon.getDate() + (w - 1) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { w, start, end };
  });
}

type TargetRow = {
  id: string;
  userId: string;
  branchId: string;
  weeklyActuals: {
    id: string;
    monthlyTargetId: string;
    weekNumber: number;
    weekStart: Date;
    weekEnd: Date;
    revenueActual: number;
    fitpartnerRevenueActual: number;
    fitActual: number;
    cooperationActual: number;
    transformActual: number;
    googleReviewActual: number;
    cvActual: number;
    weeklyTaskNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  [key: string]: unknown;
};

export async function enrichTargetsWithDynamicActuals<T extends TargetRow>(
  targets: T[],
  month: number,
  year: number
): Promise<T[]> {
  if (targets.length === 0) return targets;

  const ptIds = Array.from(new Set(targets.map((t) => t.userId)));
  const branchIds = Array.from(new Set(targets.map((t) => t.branchId)));
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const weekBounds = computeWeekBounds(year, month);

  const [leads, consultations, transformedClients] = await Promise.all([
    // Every lead in the reporting month counts toward revenue (matches Setup
    // "Tổng doanh thu") — no status / signDate gate.
    prisma.salesLead.findMany({
      where: {
        assignedPTId: { in: ptIds },
        branchId: { in: branchIds },
        month,
        year,
      },
      select: { assignedPTId: true, signDate: true, createdAt: true, actualRevenue: true, fitpartnerRevenue: true },
    }),
    prisma.consultation.findMany({
      where: {
        createdById: { in: ptIds },
        status: "COMPLETED",
        updatedAt: { gte: monthStart, lte: monthEnd },
      },
      select: { createdById: true, updatedAt: true },
    }),
    prisma.client.findMany({
      where: {
        assignedPTId: { in: ptIds },
        hasTransformed: true,
        updatedAt: { gte: monthStart, lte: monthEnd },
      },
      select: { assignedPTId: true, updatedAt: true },
    }),
  ]);

  // Assign a lead to a reporting week by sign date (else creation date); anything that
  // doesn't fall in a week window lands in the final week so the month total is complete.
  const assignWeek = (date: Date): number => {
    for (const { w, start, end } of weekBounds) {
      if (date >= start && date <= end) return w;
    }
    return 5;
  };

  return targets.map((target) => {
    const myLeads = leads.filter((l) => l.assignedPTId === target.userId);
    const myConsults = consultations.filter((c) => c.createdById === target.userId);
    const myTransforms = transformedClients.filter((c) => c.assignedPTId === target.userId);

    const weeklyActuals = weekBounds.map(({ w, start, end }) => {
      const existing = target.weeklyActuals.find((wa) => wa.weekNumber === w);

      const wLeads = myLeads.filter((l) => assignWeek(new Date(l.signDate ?? l.createdAt)) === w);
      const revenueActual = wLeads.reduce((s, l) => s + (l.actualRevenue ?? 0), 0);
      const fitpartnerRevenueActual = wLeads.reduce((s, l) => s + (l.fitpartnerRevenue ?? 0), 0);
      const fitActual = myConsults.filter((c) => c.updatedAt >= start && c.updatedAt <= end).length;
      const transformActual = myTransforms.filter((c) => c.updatedAt >= start && c.updatedAt <= end).length;

      if (existing) {
        // Revenue is always derived from leads (never entered by hand), so refresh it from
        // the current leads; keep the manually-entered actuals (fit/cooperation/…/notes).
        return { ...existing, revenueActual, fitpartnerRevenueActual };
      }
      return {
        id: `dyn-${target.id}-w${w}`,
        monthlyTargetId: target.id,
        weekNumber: w,
        weekStart: start,
        weekEnd: end,
        revenueActual,
        fitpartnerRevenueActual,
        fitActual,
        cooperationActual: 0,
        transformActual,
        googleReviewActual: 0,
        cvActual: 0,
        weeklyTaskNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    return { ...target, weeklyActuals };
  });
}
