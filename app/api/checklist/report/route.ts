import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ReportType } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isFM = role === "FM";
  const isPT = role === "FREE" || role === "RESTRICTED";
  if (!isFM && !isPT) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "MONTHLY") as ReportType;
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const week = searchParams.get("week") ? parseInt(searchParams.get("week")!) : null;
  const requestedUserId = searchParams.get("userId") ?? session.user.id;

  if (isPT && requestedUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const report = await prisma.weeklyMonthlyReport.findFirst({
    where: {
      userId: requestedUserId,
      reportType: type,
      month,
      year,
      weekNumber: week,
    },
  });

  const targetUser = await prisma.user.findUnique({ where: { id: requestedUserId }, select: { branchId: true } });
  const monthlyTarget = targetUser?.branchId
    ? await prisma.monthlyTarget.findUnique({
        where: { branchId_userId_month_year: { branchId: targetUser.branchId, userId: requestedUserId, month, year } },
      })
    : null;

  return NextResponse.json({ report, monthlyTarget });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isFM = role === "FM";
  const isPT = role === "FREE" || role === "RESTRICTED";
  if (!isFM && !isPT) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    userId: string;
    reportType: ReportType;
    month: number;
    year: number;
    weekNumber: number | null;
    importantTasks: string;
    results?: string;
    completed?: string;
    incomplete?: string;
    nextPlan?: string;
  };

  if (isPT && body.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.weeklyMonthlyReport.findFirst({
    where: { userId: body.userId, reportType: body.reportType, month: body.month, year: body.year, weekNumber: body.weekNumber },
  });

  const data = {
    importantTasks: body.importantTasks,
    results: body.results ?? null,
    completed: body.completed ?? null,
    incomplete: body.incomplete ?? null,
    nextPlan: body.nextPlan ?? null,
  };

  const report = existing
    ? await prisma.weeklyMonthlyReport.update({ where: { id: existing.id }, data })
    : await prisma.weeklyMonthlyReport.create({
        data: {
          userId: body.userId,
          reportType: body.reportType,
          month: body.month,
          year: body.year,
          weekNumber: body.weekNumber,
          ...data,
        },
      });

  return NextResponse.json(report);
}
