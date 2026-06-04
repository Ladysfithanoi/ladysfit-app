import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, type Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/checklist/monthly-stats?month=&year=&branchId=
// Aggregates each staff member's daily check-lists for the month into a work-
// performance summary: task completion + "buổi dạy" (rows marked as teaching
// sessions, where KPI = planned and actualResult = completed).
// FM sees staff in their managed branches; ADMIN sees everyone (optionally by branch).

// A task counts as completed using the same rule as the daily progress bar:
// it has a numeric KPI > 0 and actualResult reaches at least 80% of it.
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
  const now = new Date();
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
  const branchId = searchParams.get("branchId");

  // Resolve which staff to include.
  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  const staffWhere: Prisma.UserWhereInput = {
    role: { in: ["PT", "FM"] as Role[] },
  };
  if (isFM) {
    if (managedBranchIds.length === 0) return NextResponse.json({ stats: [], month, year });
    staffWhere.branchId = { in: managedBranchIds };
  } else if (branchId) {
    staffWhere.branchId = branchId;
  }

  const staff = await prisma.user.findMany({
    where: staffWhere,
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  if (staff.length === 0) return NextResponse.json({ stats: [], month, year });

  const staffIds = staff.map((s) => s.id);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const checklists = await prisma.dailyChecklist.findMany({
    where: { userId: { in: staffIds }, reportDate: { gte: startDate, lt: endDate } },
    select: {
      userId: true,
      items: { select: { kpi: true, actualResult: true, isTeachingSession: true } },
    },
  });

  // Aggregate per user.
  type Acc = {
    daysReported: number;
    tasksTotal: number;
    tasksCompleted: number;
    teachingSetup: number;
    teachingDone: number;
  };
  const accByUser = new Map<string, Acc>();
  for (const id of staffIds) {
    accByUser.set(id, { daysReported: 0, tasksTotal: 0, tasksCompleted: 0, teachingSetup: 0, teachingDone: 0 });
  }

  for (const cl of checklists) {
    const acc = accByUser.get(cl.userId);
    if (!acc) continue;
    acc.daysReported += 1;
    for (const item of cl.items) {
      acc.tasksTotal += 1;
      if (isTaskDone(item.kpi, item.actualResult)) acc.tasksCompleted += 1;
      if (item.isTeachingSession) {
        const planned = item.kpi ? parseFloat(item.kpi) : NaN;
        acc.teachingSetup += !isNaN(planned) && planned > 0 ? planned : 1;
        acc.teachingDone += item.actualResult ?? 0;
      }
    }
  }

  const stats = staff.map((s) => {
    const a = accByUser.get(s.id)!;
    return {
      userId: s.id,
      name: s.name ?? s.email,
      role: s.role,
      daysReported: a.daysReported,
      tasksTotal: a.tasksTotal,
      tasksCompleted: a.tasksCompleted,
      taskRate: a.tasksTotal > 0 ? Math.round((a.tasksCompleted / a.tasksTotal) * 1000) / 10 : 0,
      teachingSetup: Math.round(a.teachingSetup * 10) / 10,
      teachingDone: Math.round(a.teachingDone * 10) / 10,
      teachingRate: a.teachingSetup > 0 ? Math.round((a.teachingDone / a.teachingSetup) * 1000) / 10 : 0,
    };
  });

  return NextResponse.json({ stats, month, year });
}
