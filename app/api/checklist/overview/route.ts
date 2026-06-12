import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, type Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/checklist/overview?date=YYYY-MM-DD
// One-glance summary of EVERY staff member's check-list for a single day, so an
// FM doesn't have to open each person's check-list one by one.
// FM sees staff in their managed branches; ADMIN sees all PT/FM.

function toDateOnly(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

// Same completion rule as the daily progress bar: numeric KPI > 0 and
// actualResult reaches at least 80% of it.
function isTaskDone(kpi: string | null, actual: number | null): boolean {
  const k = kpi ? parseFloat(kpi) : NaN;
  if (isNaN(k) || k <= 0) return false;
  return ((actual ?? 0) / k) * 100 >= 80;
}

// Collapse the (now single) reflection field, falling back to the legacy
// 4-field layout for check-lists saved before the consolidation.
function mergeReflection(c: {
  dailyResults: string | null;
  dailyCompleted: string | null;
  dailyIncomplete: string | null;
  dailyNextPlan: string | null;
}): string {
  if (c.dailyResults && c.dailyResults.trim()) return c.dailyResults.trim();
  const parts: string[] = [];
  if (c.dailyCompleted?.trim()) parts.push(`✅ Đã hoàn thành: ${c.dailyCompleted.trim()}`);
  if (c.dailyIncomplete?.trim()) parts.push(`⏳ Chưa hoàn thành: ${c.dailyIncomplete.trim()}`);
  if (c.dailyNextPlan?.trim()) parts.push(`➡️ Kế hoạch tiếp theo: ${c.dailyNextPlan.trim()}`);
  return parts.join("\n");
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM = role === "FM";
  if (!isAdmin && !isFM) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  // Resolve which staff to include.
  const staffWhere: Prisma.UserWhereInput = {
    role: { in: ["PT", "FM"] as Role[] },
    deletedAt: null,
  };
  if (isFM) {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (managedBranchIds.length === 0) return NextResponse.json({ date, staff: [] });
    staffWhere.branchId = { in: managedBranchIds };
  }

  const staff = await prisma.user.findMany({
    where: staffWhere,
    select: { id: true, name: true, email: true, role: true, branch: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  if (staff.length === 0) return NextResponse.json({ date, staff: [] });

  const staffIds = staff.map((s) => s.id);
  const reportDate = toDateOnly(date);
  const nextDay = new Date(reportDate);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const checklists = await prisma.dailyChecklist.findMany({
    where: { userId: { in: staffIds }, reportDate: { gte: reportDate, lt: nextDay } },
    select: {
      userId: true,
      targetNote: true,
      dailyResults: true,
      dailyCompleted: true,
      dailyIncomplete: true,
      dailyNextPlan: true,
      items: { select: { kpi: true, actualResult: true, isTeachingSession: true } },
    },
  });
  const byUser = new Map(checklists.map((c) => [c.userId, c]));

  const result = staff.map((s) => {
    const cl = byUser.get(s.id);
    if (!cl) {
      return {
        userId: s.id,
        name: s.name ?? s.email,
        role: s.role,
        branchName: s.branch?.name ?? "",
        filled: false,
        tasksTotal: 0,
        tasksCompleted: 0,
        taskRate: 0,
        teachingSetup: 0,
        teachingDone: 0,
        targetNote: "",
        reflection: "",
      };
    }

    let tasksTotal = 0;
    let tasksCompleted = 0;
    let teachingSetup = 0;
    let teachingDone = 0;
    for (const item of cl.items) {
      tasksTotal += 1;
      if (isTaskDone(item.kpi, item.actualResult)) tasksCompleted += 1;
      if (item.isTeachingSession) {
        const planned = item.kpi ? parseFloat(item.kpi) : NaN;
        teachingSetup += !isNaN(planned) && planned > 0 ? planned : 1;
        teachingDone += item.actualResult ?? 0;
      }
    }

    return {
      userId: s.id,
      name: s.name ?? s.email,
      role: s.role,
      branchName: s.branch?.name ?? "",
      filled: true,
      tasksTotal,
      tasksCompleted,
      taskRate: tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0,
      teachingSetup: Math.round(teachingSetup * 10) / 10,
      teachingDone: Math.round(teachingDone * 10) / 10,
      targetNote: cl.targetNote ?? "",
      reflection: mergeReflection(cl),
    };
  });

  return NextResponse.json({ date, staff: result });
}
