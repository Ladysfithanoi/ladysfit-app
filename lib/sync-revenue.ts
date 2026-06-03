import { prisma } from "@/lib/prisma";

function computeWeekDates(year: number, month: number, weekNumber: number) {
  const d = new Date(year, month - 1, 1);
  const dow = d.getDay() || 7;
  const firstMon = new Date(d);
  firstMon.setDate(d.getDate() - dow + 1);
  const weekStart = new Date(firstMon);
  weekStart.setDate(firstMon.getDate() + (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  // The final reporting week (5) always ends on the last calendar day of the month,
  // so revenue signed at month-end is captured. Clamp earlier overflow weeks too.
  const lastDay = new Date(year, month, 0);
  if (weekNumber === 5 || weekEnd > lastDay) {
    weekEnd.setFullYear(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());
  }
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

function getWeekNumber(signDate: Date, year: number, month: number): number | null {
  for (let w = 1; w <= 5; w++) {
    const { weekStart, weekEnd } = computeWeekDates(year, month, w);
    if (signDate >= weekStart && signDate <= weekEnd) return w;
  }
  return null;
}

export async function syncLeadRevenueToWeeklyActuals(
  ptId: string,
  branchId: string,
  month: number,
  year: number
): Promise<void> {
  const target = await prisma.monthlyTarget.findUnique({
    where: { branchId_userId_month_year: { branchId, userId: ptId, month, year } },
    select: { id: true, weeklyActuals: { select: { id: true, weekNumber: true } } },
  });

  if (!target) return;

  // Every lead in the reporting month counts toward revenue — whether or not it was
  // fully paid or a sign date was entered — so this matches Setup "Tổng doanh thu".
  const leads = await prisma.salesLead.findMany({
    where: {
      assignedPTId: ptId,
      branchId,
      month,
      year,
    },
    select: { signDate: true, createdAt: true, actualRevenue: true, fitpartnerRevenue: true },
  });

  const weekRevenue: Record<number, { revenue: number; fitpartner: number }> = {};
  for (const lead of leads) {
    // Bucket by sign date when present, else the date the lead was created. Leads that
    // still don't fall in any week land in the final week so the month total is complete.
    const bucketDate = lead.signDate ?? lead.createdAt;
    const w = getWeekNumber(new Date(bucketDate), year, month) ?? 5;
    if (!weekRevenue[w]) weekRevenue[w] = { revenue: 0, fitpartner: 0 };
    weekRevenue[w].revenue += lead.actualRevenue ?? 0;
    weekRevenue[w].fitpartner += lead.fitpartnerRevenue ?? 0;
  }

  await Promise.all(
    [1, 2, 3, 4, 5].map(async (w) => {
      const { weekStart, weekEnd } = computeWeekDates(year, month, w);
      const rev = weekRevenue[w]?.revenue ?? 0;
      const fp = weekRevenue[w]?.fitpartner ?? 0;
      await prisma.weeklyActual.upsert({
        where: { monthlyTargetId_weekNumber: { monthlyTargetId: target.id, weekNumber: w } },
        update: { revenueActual: rev, fitpartnerRevenueActual: fp },
        create: {
          monthlyTargetId: target.id,
          weekNumber: w,
          weekStart,
          weekEnd,
          revenueActual: rev,
          fitpartnerRevenueActual: fp,
          fitActual: 0,
          cooperationActual: 0,
          transformActual: 0,
          googleReviewActual: 0,
          cvActual: 0,
        },
      });
    })
  );
}
