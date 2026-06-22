import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

function computeWeekBounds(year: number, month: number) {
  const d = new Date(year, month - 1, 1);
  const dow = d.getDay() || 7;
  const firstMon = new Date(d);
  firstMon.setDate(d.getDate() - dow + 1);
  const lastDay = new Date(year, month, 0);
  return [1, 2, 3, 4, 5].map((w) => {
    const start = new Date(firstMon);
    start.setDate(firstMon.getDate() + (w - 1) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    // The final reporting week (5) always ends on the last calendar day of the month;
    // clamp any earlier week that spills past month-end too.
    if (w === 5 || end > lastDay) {
      end.setFullYear(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());
    }
    end.setHours(23, 59, 59, 999);
    return { weekNumber: w, weekStart: start.toISOString(), weekEnd: end.toISOString() };
  });
}

const KPI_DEFS = [
  { label: "Doanh số (triệu)", targetKey: "revenueTarget" as const, weekTargetKey: "revenueTarget" as const, actualKey: "revenueActual" as const, isFloat: true },
  { label: "Doanh thu Fitpartner (triệu)", targetKey: "fitpartnerRevenueTarget" as const, weekTargetKey: "fitpartnerRevenueTarget" as const, actualKey: "fitpartnerRevenueActual" as const, isFloat: true },
  { label: "FIT (KH trải nghiệm)", targetKey: "fitTarget" as const, weekTargetKey: "fitTarget" as const, actualKey: "fitActual" as const, isFloat: false },
  { label: "KH hợp tác", targetKey: "cooperationTarget" as const, weekTargetKey: "cooperationTarget" as const, actualKey: "cooperationActual" as const, isFloat: false },
  { label: "Transform", targetKey: "transformTarget" as const, weekTargetKey: "transformTarget" as const, actualKey: "transformActual" as const, isFloat: false },
  { label: "Google Business", targetKey: "googleReviewTarget" as const, weekTargetKey: "googleReviewTarget" as const, actualKey: "googleReviewActual" as const, isFloat: false },
  { label: "CV tuyển dụng", targetKey: "cvTarget" as const, weekTargetKey: "cvTarget" as const, actualKey: "cvActual" as const, isFloat: false },
] as const;

type MonthlyTargetRow = {
  id: string;
  userId: string;
  branchId: string;
  month: number;
  year: number;
  revenueTarget: number;
  fitpartnerRevenueTarget: number;
  fitTarget: number;
  cooperationTarget: number;
  transformTarget: number;
  googleReviewTarget: number;
  cvTarget: number;
  user: { id: string; name: string | null; email: string };
  weeklyActuals: {
    id: string;
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
    revenueTarget: number;
    fitpartnerRevenueTarget: number;
    fitTarget: number;
    cooperationTarget: number;
    transformTarget: number;
    googleReviewTarget: number;
    cvTarget: number;
  }[];
};

function getWeekTarget(_target: MonthlyTargetRow, wa: MonthlyTargetRow["weeklyActuals"][0] | undefined, weekTargetKey: keyof MonthlyTargetRow["weeklyActuals"][0]): number {
  return wa ? (wa[weekTargetKey] as number) : 0;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const allowedRoles = ["ADMIN", "FM", "CEO_FITPARTNER", "COO", "PT"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month = parseInt(searchParams.get("month") ?? "0");
  const year = parseInt(searchParams.get("year") ?? "0");
  const weekNumber = parseInt(searchParams.get("weekNumber") ?? "1");

  if (!branchId || !month || !year) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const isFM = role === "FM";
  const isPT = role === "PT";
  const isAdmin = role === "ADMIN";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // PT can only see their own row; others see all rows in the branch.
  // CEO_FITPARTNER/COO are management, not gym staff — never list them as a row.
  const targetsWhere = isPT
    ? { branchId, month, year, userId: session.user.id, user: { deletedAt: null } }
    : { branchId, month, year, user: { deletedAt: null, role: { notIn: ["CEO_FITPARTNER", "COO"] as Role[] } } };

  // Reports are now per-user: each staff member owns their own notes for the week.
  const [targets, report] = await Promise.all([
    prisma.monthlyTarget.findMany({
      where: targetsWhere,
      include: {
        user: { select: { id: true, name: true, email: true } },
        weeklyActuals: { orderBy: { weekNumber: "asc" } },
      },
    }) as Promise<MonthlyTargetRow[]>,
    prisma.weeklyReport.findUnique({
      where: {
        branchId_month_year_weekNumber_userId: {
          branchId, month, year, weekNumber, userId: session.user.id,
        },
      },
    }),
  ]);

  // FM/CEO/COO/ADMIN can additionally read the other staff reports of the branch
  // (the managedBranchIds guard above already limits FM to their own branches).
  // Includes PT and FM reports so Admin/CEO/COO can read each branch FM's report,
  // not just the PTs'. The viewer's own report is shown in the editable area above,
  // so it's excluded here. PT only ever receive their own report, never others'.
  const canViewOthers = role === "FM" || role === "CEO_FITPARTNER" || role === "COO" || isAdmin;
  let userReports: {
    userId: string; userName: string; role: string;
    arisingTasks: string | null; incompleteWork: string | null; solutions: string | null;
  }[] = [];
  if (canViewOthers) {
    const rows = await prisma.weeklyReport.findMany({
      where: {
        branchId, month, year, weekNumber,
        userId: { not: session.user.id },
        user: { role: { in: ["PT", "FM"] as Role[] }, deletedAt: null },
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    userReports = rows
      .map((r) => ({
        userId: r.userId,
        userName: r.user.name ?? r.user.email,
        role: r.user.role,
        arisingTasks: r.arisingTasks,
        incompleteWork: r.incompleteWork,
        solutions: r.solutions,
      }))
      // FM first, then PT; alphabetically within each role.
      .sort((a, b) =>
        a.role === b.role
          ? a.userName.localeCompare(b.userName, "vi")
          : a.role === "FM" ? -1 : 1
      );
  }

  const weekBounds = computeWeekBounds(year, month);

  // Aggregate KPI (sum across all users) — used by FM/Admin/CEO view
  const kpi = KPI_DEFS.map((k) => {
    const weekTarget = targets.reduce((s, t) => {
      const wa = t.weeklyActuals.find((a) => a.weekNumber === weekNumber);
      return s + getWeekTarget(t, wa, k.weekTargetKey);
    }, 0);
    const weekActual = targets.reduce((s, t) => {
      const wa = t.weeklyActuals.find((a) => a.weekNumber === weekNumber);
      return s + ((wa?.[k.actualKey] as number) ?? 0);
    }, 0);
    const pct = weekTarget > 0 ? Math.round((weekActual / weekTarget) * 100) : 0;
    return { label: k.label, weekTarget, weekActual, pct, isFloat: k.isFloat };
  });

  // Per-user KPI breakdown
  const perUserKpi = targets.map((t) => {
    const wa = t.weeklyActuals.find((a) => a.weekNumber === weekNumber);
    const kpiRows = KPI_DEFS.map((k) => {
      const weekTarget = getWeekTarget(t, wa, k.weekTargetKey);
      const weekActual = (wa?.[k.actualKey] as number) ?? 0;
      const pct = weekTarget > 0 ? Math.round((weekActual / weekTarget) * 100) : 0;
      return {
        label: k.label,
        weekTarget,
        weekActual,
        pct,
        isFloat: k.isFloat,
        actualKey: k.actualKey,
      };
    });
    return {
      monthlyTargetId: t.id,
      userId: t.userId,
      userName: t.user.name ?? t.user.email,
      weeklyActualId: wa?.id ?? null,
      weekStart: weekBounds.find(wb => wb.weekNumber === weekNumber)?.weekStart ?? null,
      weekEnd: weekBounds.find(wb => wb.weekNumber === weekNumber)?.weekEnd ?? null,
      kpi: kpiRows,
    };
  });

  // Ensure the logged-in user always has an entry in perUserKpi so they can enter
  // their own actuals even if no MonthlyTarget has been created for them yet.
  const currentUserInList = perUserKpi.some((p) => p.userId === session.user.id);
  if (!currentUserInList) {
    const wb = weekBounds.find((b) => b.weekNumber === weekNumber);
    perUserKpi.push({
      monthlyTargetId: null as unknown as string, // sentinel: auto-create on first save
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "",
      weeklyActualId: null,
      weekStart: wb?.weekStart ?? null,
      weekEnd: wb?.weekEnd ?? null,
      kpi: KPI_DEFS.map((k) => ({
        label: k.label, weekTarget: 0, weekActual: 0, pct: 0,
        isFloat: k.isFloat, actualKey: k.actualKey,
      })),
    });
  }

  // Revenue per user for the selected week. Every lead in the reporting month counts
  // (matches Setup "Tổng doanh thu") regardless of payment/sign status — bucket by sign
  // date, else creation date, with the final week catching anything not in a week window.
  const selectedBound = weekBounds.find((b) => b.weekNumber === weekNumber);
  if (selectedBound) {
    const assignWeek = (date: Date): number => {
      for (const b of weekBounds) {
        if (date >= new Date(b.weekStart) && date <= new Date(b.weekEnd)) return b.weekNumber;
      }
      return 5;
    };

    const leads = await prisma.salesLead.findMany({
      where: { branchId, month, year },
      select: { assignedPTId: true, signDate: true, createdAt: true, actualRevenue: true },
    });

    const leadRevenueByUser: Record<string, number> = {};
    for (const lead of leads) {
      if (assignWeek(new Date(lead.signDate ?? lead.createdAt)) !== weekNumber) continue;
      if (lead.assignedPTId && lead.actualRevenue !== null) {
        leadRevenueByUser[lead.assignedPTId] =
          (leadRevenueByUser[lead.assignedPTId] ?? 0) + lead.actualRevenue;
      }
    }

    for (const pu of perUserKpi) {
      const revRow = pu.kpi.find((k) => k.actualKey === "revenueActual");
      if (revRow) {
        revRow.weekActual = leadRevenueByUser[pu.userId] ?? 0;
        revRow.pct = revRow.weekTarget > 0 ? Math.round((revRow.weekActual / revRow.weekTarget) * 100) : 0;
      }
    }

    const aggRevRow = kpi.find((k) => k.label === "Doanh số (triệu)");
    if (aggRevRow) {
      aggRevRow.weekActual = Object.values(leadRevenueByUser).reduce((s, v) => s + v, 0);
      aggRevRow.pct = aggRevRow.weekTarget > 0 ? Math.round((aggRevRow.weekActual / aggRevRow.weekTarget) * 100) : 0;
    }
  }

  // Only expose aggregate to privileged roles; PT/Admin see only their own row
  const kpiForRole = (isPT || isAdmin) ? [] : kpi;

  return NextResponse.json({ report, userReports, kpi: kpiForRole, perUserKpi, weekBounds });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  // CEO_FitPartner & COO chỉ được XEM báo cáo tuần — không ghi.
  if (!["FM", "ADMIN", "PT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    branchId: string;
    month: number;
    year: number;
    weekNumber: number;
    arisingTasks: string | null;
    incompleteWork: string | null;
    solutions: string | null;
  };

  const { branchId, month, year, weekNumber, arisingTasks, incompleteWork, solutions } = body;
  if (!branchId || !month || !year || !weekNumber) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];
  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Each staff member edits only their own report for the week.
  const report = await prisma.weeklyReport.upsert({
    where: {
      branchId_month_year_weekNumber_userId: {
        branchId, month, year, weekNumber, userId: session.user.id,
      },
    },
    update: { arisingTasks: arisingTasks ?? null, incompleteWork: incompleteWork ?? null, solutions: solutions ?? null },
    create: {
      branchId,
      userId: session.user.id,
      month,
      year,
      weekNumber,
      arisingTasks: arisingTasks ?? null,
      incompleteWork: incompleteWork ?? null,
      solutions: solutions ?? null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(report);
}
