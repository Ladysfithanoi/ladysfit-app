import { prisma } from "@/lib/prisma";
import { vnWallClock } from "@/lib/format-date";

// Mốc tuần là NGÀY LỊCH VN dựng bằng Date.UTC; thời điểm đem so phải qua
// vnWallClock trước (xem lib/format-date).
function computeWeekDates(year: number, month: number, weekNumber: number) {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay() || 7;
  const weekStart = new Date(Date.UTC(year, month - 1, 2 - dow + (weekNumber - 1) * 7));
  // The final reporting week (5) always ends on the last calendar day of the month,
  // so revenue signed at month-end is captured. Clamp earlier overflow weeks too.
  const nextMonth = Date.UTC(year, month, 1);
  const weekEndExcl = weekNumber === 5 ? nextMonth : Math.min(weekStart.getTime() + 7 * 86_400_000, nextMonth);
  const weekEnd = new Date(weekEndExcl - 1);
  return { weekStart, weekEnd };
}

function getWeekNumber(signDate: Date, year: number, month: number): number | null {
  const vn = vnWallClock(signDate);
  for (let w = 1; w <= 5; w++) {
    const { weekStart, weekEnd } = computeWeekDates(year, month, w);
    if (vn >= weekStart && vn <= weekEnd) return w;
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
