import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, type Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTaskDone, mergeReflection, toDateOnly } from "@/lib/checklist-review";

// GET /api/checklist/overview?date=YYYY-MM-DD
// One-glance summary of EVERY staff member's check-list for a single day, so an
// FM doesn't have to open each person's check-list one by one.
// FM sees staff in their managed branches; ADMIN sees all PT/FM.

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
      checkedOutAt: true,
      fmRating: true,
      fmReviewedAt: true,
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
        checkedOut: false,
        checkedOutAt: null as string | null,
        fmRating: null as number | null,
        reviewed: false,
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
      checkedOut: cl.checkedOutAt != null,
      checkedOutAt: cl.checkedOutAt?.toISOString() ?? null,
      fmRating: cl.fmRating,
      reviewed: cl.fmReviewedAt != null,
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
