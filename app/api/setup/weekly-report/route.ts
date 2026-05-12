import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichTargetsWithDynamicActuals } from "@/lib/compute-actuals";

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

const KPI_KEYS = [
  { label: "Doanh số (triệu)", targetKey: "revenueTarget", actualKey: "revenueActual", isFloat: true },
  { label: "Doanh thu Fitpartner (triệu)", targetKey: "fitpartnerRevenueTarget", actualKey: "fitpartnerRevenueActual", isFloat: true },
  { label: "FIT (KH trải nghiệm)", targetKey: "fitTarget", actualKey: "fitActual", isFloat: false },
  { label: "KH hợp tác", targetKey: "cooperationTarget", actualKey: "cooperationActual", isFloat: false },
  { label: "Transform", targetKey: "transformTarget", actualKey: "transformActual", isFloat: false },
  { label: "Google Business", targetKey: "googleReviewTarget", actualKey: "googleReviewActual", isFloat: false },
  { label: "CV tuyển dụng", targetKey: "cvTarget", actualKey: "cvActual", isFloat: false },
];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["ADMIN", "FM", "CEO_FITPARTNER", "COO"].includes(role)) {
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
  const managedBranchIds = session.user.managedBranchIds ?? [];
  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [targets, report] = await Promise.all([
    prisma.monthlyTarget.findMany({
      where: { branchId, month, year },
      include: {
        user: { select: { id: true, name: true, email: true } },
        weeklyActuals: { orderBy: { weekNumber: "asc" } },
      },
    }),
    prisma.weeklyReport.findUnique({
      where: { branchId_month_year_weekNumber: { branchId, month, year, weekNumber } },
    }),
  ]);

  const enriched = await enrichTargetsWithDynamicActuals(targets, month, year);
  const weekBounds = computeWeekBounds(year, month);

  const kpi = KPI_KEYS.map((k) => {
    const monthTarget = enriched.reduce((s, t) => s + ((t[k.targetKey as keyof typeof t] as number) ?? 0), 0);
    const weekTarget = monthTarget > 0 ? monthTarget / 5 : 0;
    const weekActual = enriched.reduce((s, t) => {
      const wa = t.weeklyActuals.find((a) => a.weekNumber === weekNumber);
      return s + ((wa?.[k.actualKey as keyof typeof wa] as number) ?? 0);
    }, 0);
    const pct = weekTarget > 0 ? Math.round((weekActual / weekTarget) * 100) : 0;
    return { label: k.label, weekTarget, weekActual, pct, isFloat: k.isFloat };
  });

  return NextResponse.json({ report, kpi, weekBounds });
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
  };

  const { branchId, month, year, weekNumber, arisingTasks, incompleteWork } = body;
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
    update: { arisingTasks: arisingTasks ?? null, incompleteWork: incompleteWork ?? null },
    create: {
      branchId,
      month,
      year,
      weekNumber,
      arisingTasks: arisingTasks ?? null,
      incompleteWork: incompleteWork ?? null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(report);
}
