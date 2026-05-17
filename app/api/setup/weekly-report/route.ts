import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

function getWeekTarget(target: MonthlyTargetRow, wa: MonthlyTargetRow["weeklyActuals"][0] | undefined, weekTargetKey: keyof MonthlyTargetRow["weeklyActuals"][0]): number {
  const perWeek = wa ? (wa[weekTargetKey] as number) : 0;
  if (perWeek > 0) return perWeek;
  // fallback: monthly target / 5
  return (target[weekTargetKey as keyof MonthlyTargetRow] as number) / 5;
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

  // PT can only see their own row; others see all rows in the branch
  const targetsWhere = isPT
    ? { branchId, month, year, userId: session.user.id, user: { deletedAt: null } }
    : { branchId, month, year, user: { deletedAt: null } };

  const [targets, report] = await Promise.all([
    prisma.monthlyTarget.findMany({
      where: targetsWhere,
      include: {
        user: { select: { id: true, name: true, email: true } },
        weeklyActuals: { orderBy: { weekNumber: "asc" } },
      },
    }) as Promise<MonthlyTargetRow[]>,
    prisma.weeklyReport.findUnique({
      where: { branchId_month_year_weekNumber: { branchId, month, year, weekNumber } },
    }),
  ]);

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

  // Only expose aggregate to privileged roles; PT/Admin see only their own row
  const kpiForRole = (isPT || isAdmin) ? [] : kpi;

  return NextResponse.json({ report, kpi: kpiForRole, perUserKpi, weekBounds });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["FM", "CEO_FITPARTNER", "COO"].includes(role)) {
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

  const report = await prisma.weeklyReport.upsert({
    where: { branchId_month_year_weekNumber: { branchId, month, year, weekNumber } },
    update: { arisingTasks: arisingTasks ?? null, incompleteWork: incompleteWork ?? null, solutions: solutions ?? null },
    create: {
      branchId,
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
