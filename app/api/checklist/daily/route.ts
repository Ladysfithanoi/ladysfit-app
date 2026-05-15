import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toDateOnly(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isFM = role === "FM";
  const isPT = role === "PT";
  if (!isFM && !isPT) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const requestedUserId = searchParams.get("userId") ?? session.user.id;

  // PT can only view their own
  if (isPT && requestedUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // FM can only view staff in managed branches
  if (isFM) {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (requestedUserId !== session.user.id) {
      const targetUser = await prisma.user.findUnique({ where: { id: requestedUserId }, select: { branchId: true } });
      if (!targetUser?.branchId || !managedBranchIds.includes(targetUser.branchId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const reportDate = toDateOnly(date);
  const nextDay = new Date(reportDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const checklist = await prisma.dailyChecklist.findFirst({
    where: { userId: requestedUserId, reportDate: { gte: reportDate, lt: nextDay } },
    include: { items: { orderBy: { order: "asc" } } },
  });

  // Auto-calculate totalActual from SalesLead for current month/year
  const now = new Date(reportDate);
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const revenueAgg = await prisma.salesLead.aggregate({
    where: { assignedPTId: requestedUserId, month, year, status: { in: ["PIF", "DE", "PB"] } },
    _sum: { actualRevenue: true },
  });
  const totalActual = revenueAgg._sum.actualRevenue ?? 0;

  // MonthlyTarget for KPI context
  const targetUser = await prisma.user.findUnique({ where: { id: requestedUserId }, select: { branchId: true } });
  const monthlyTarget = targetUser?.branchId
    ? await prisma.monthlyTarget.findUnique({
        where: { branchId_userId_month_year: { branchId: targetUser.branchId, userId: requestedUserId, month, year } },
      })
    : null;

  return NextResponse.json({ checklist, totalActual, monthlyTarget });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isFM = role === "FM";
  const isPT = role === "PT";
  if (!isFM && !isPT) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    date: string;
    userId: string;
    position: string;
    targetNote?: string;
    totalTarget?: number;
    dailyResults?: string;
    dailyCompleted?: string;
    dailyIncomplete?: string;
    dailyNextPlan?: string;
    items: { order: number; time?: string; task: string; kpi?: string; status: boolean; hasEvent: boolean; note?: string }[];
  };

  // PT can only save their own
  if (isPT && body.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reportDate = toDateOnly(body.date);
  const nextDay = new Date(reportDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const existing = await prisma.dailyChecklist.findFirst({
    where: { userId: body.userId, reportDate: { gte: reportDate, lt: nextDay } },
  });

  let checklist;
  if (existing) {
    // Update checklist + replace items
    await prisma.checklistItem.deleteMany({ where: { checklistId: existing.id } });
    checklist = await prisma.dailyChecklist.update({
      where: { id: existing.id },
      data: {
        position: body.position,
        targetNote: body.targetNote ?? null,
        totalTarget: body.totalTarget ?? null,
        dailyResults: body.dailyResults ?? null,
        dailyCompleted: body.dailyCompleted ?? null,
        dailyIncomplete: body.dailyIncomplete ?? null,
        dailyNextPlan: body.dailyNextPlan ?? null,
        items: {
          create: body.items.map((item) => ({
            order: item.order,
            time: item.time ?? null,
            task: item.task,
            kpi: item.kpi ?? null,
            status: item.status,
            hasEvent: item.hasEvent,
            note: item.note ?? null,
          })),
        },
      },
      include: { items: { orderBy: { order: "asc" } } },
    });
  } else {
    checklist = await prisma.dailyChecklist.create({
      data: {
        userId: body.userId,
        reportDate,
        position: body.position,
        targetNote: body.targetNote ?? null,
        totalTarget: body.totalTarget ?? null,
        dailyResults: body.dailyResults ?? null,
        dailyCompleted: body.dailyCompleted ?? null,
        dailyIncomplete: body.dailyIncomplete ?? null,
        dailyNextPlan: body.dailyNextPlan ?? null,
        items: {
          create: body.items.map((item) => ({
            order: item.order,
            time: item.time ?? null,
            task: item.task,
            kpi: item.kpi ?? null,
            status: item.status,
            hasEvent: item.hasEvent,
            note: item.note ?? null,
          })),
        },
      },
      include: { items: { orderBy: { order: "asc" } } },
    });
  }

  return NextResponse.json(checklist);
}
