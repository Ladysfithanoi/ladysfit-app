import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, type Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDaysISO, mondayOf, todayVN, weekKey } from "@/lib/week";

// GET /api/checklist/weekly-overview?weekStart=YYYY-MM-DD
// Bảng tổng hợp báo cáo tuần của toàn bộ nhân sự cho FM/ADMIN: ai đã gửi, ai còn
// nháp, ai chưa làm — kèm số ngày đã điền check-list và tiến độ công việc tuần đó.

function toUTC(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

function isTaskDone(kpi: string | null, actual: number | null): boolean {
  const k = kpi ? parseFloat(kpi) : NaN;
  if (isNaN(k) || k <= 0) return false;
  return ((actual ?? 0) / k) * 100 >= 80;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM = role === "FM";
  if (!isAdmin && !isFM) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("weekStart");
  const weekStart = mondayOf(raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayVN());
  const weekEnd = addDaysISO(weekStart, 7); // exclusive

  const staffWhere: Prisma.UserWhereInput = {
    role: { in: ["PT", "FM"] as Role[] },
    deletedAt: null,
  };
  if (isFM) {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (managedBranchIds.length === 0) return NextResponse.json({ weekStart, staff: [] });
    staffWhere.branchId = { in: managedBranchIds };
  }

  const staff = await prisma.user.findMany({
    where: staffWhere,
    select: { id: true, name: true, email: true, role: true, branch: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  if (staff.length === 0) return NextResponse.json({ weekStart, staff: [] });

  const staffIds = staff.map((s) => s.id);
  const { year, month, weekNumber } = weekKey(weekStart);

  const [reports, checklists] = await Promise.all([
    prisma.weeklyMonthlyReport.findMany({
      where: { userId: { in: staffIds }, reportType: "WEEKLY", month, year, weekNumber },
    }),
    prisma.dailyChecklist.findMany({
      where: {
        userId: { in: staffIds },
        reportDate: { gte: toUTC(weekStart), lt: toUTC(weekEnd) },
      },
      select: {
        userId: true,
        items: { select: { kpi: true, actualResult: true, isTeachingSession: true } },
      },
    }),
  ]);

  const reportByUser = new Map(reports.map((r) => [r.userId, r]));

  const stats = new Map<string, { days: number; total: number; done: number; teaching: number }>();
  for (const cl of checklists) {
    const s = stats.get(cl.userId) ?? { days: 0, total: 0, done: 0, teaching: 0 };
    s.days += 1;
    for (const item of cl.items) {
      s.total += 1;
      if (isTaskDone(item.kpi, item.actualResult)) s.done += 1;
      if (item.isTeachingSession) s.teaching += item.actualResult ?? 0;
    }
    stats.set(cl.userId, s);
  }

  const result = staff.map((s) => {
    const r = reportByUser.get(s.id);
    const st = stats.get(s.id) ?? { days: 0, total: 0, done: 0, teaching: 0 };
    return {
      userId:      s.id,
      name:        s.name ?? s.email,
      role:        s.role,
      branchName:  s.branch?.name ?? "",
      submitted:   !!r?.submittedAt,
      submittedAt: r?.submittedAt ? r.submittedAt.toISOString() : null,
      hasDraft:    !!r && !r.submittedAt,
      aiGenerated: r?.aiGenerated ?? false,
      results:     r?.results    ?? "",
      completed:   r?.completed  ?? "",
      incomplete:  r?.incomplete ?? "",
      nextPlan:    r?.nextPlan   ?? "",
      daysFilled:  st.days,
      tasksTotal:  st.total,
      tasksDone:   st.done,
      taskRate:    st.total > 0 ? Math.round((st.done / st.total) * 100) : 0,
      teachingDone: Math.round(st.teaching * 10) / 10,
    };
  });

  return NextResponse.json({ weekStart, staff: result });
}
