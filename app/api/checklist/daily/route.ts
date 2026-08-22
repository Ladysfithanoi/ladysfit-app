import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDaysISO, todayVN } from "@/lib/week";

function toDateOnly(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

// Nhân sự được điền trước cho hôm nay và các ngày sắp tới (tối đa 31 ngày),
// còn ngày đã qua thì chỉ xem lại chứ không sửa được nữa.
const EDIT_AHEAD_DAYS = 31;

function editableRange(): { from: string; to: string } {
  const from = todayVN();
  return { from, to: addDaysISO(from, EDIT_AHEAD_DAYS) };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM    = role === "FM";
  const isPT    = role === "PT";
  if (!isAdmin && !isFM && !isPT) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const requestedUserId = searchParams.get("userId") ?? session.user.id;

  // PT can only view their own
  if (isPT && requestedUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // FM can only view staff in managed branches
  if (isFM && requestedUserId !== session.user.id) {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    const targetUser = await prisma.user.findUnique({ where: { id: requestedUserId }, select: { branchId: true } });
    if (!targetUser?.branchId || !managedBranchIds.includes(targetUser.branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  // ADMIN: có thể xem bất kỳ user nào — không cần kiểm tra thêm

  // Xem thì không giới hạn ngày: ai cũng xem lại được toàn bộ lịch sử của mình,
  // FM/ADMIN xem được của nhân sự trong chi nhánh mình quản lý. Quyền ghi mới là
  // thứ bị chặn theo ngày (xem POST bên dưới).

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
    items: { order: number; time?: string; task: string; kpi?: string; actualResult?: number; note?: string; isTeachingSession?: boolean }[];
  };

  // PT can only save their own
  if (isPT && body.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Được điền cho hôm nay và các ngày phía trước (điền trước cả tuần cũng được);
  // ngày đã qua thì khoá lại, chỉ xem.
  {
    const { from, to } = editableRange();
    if (body.date < from) {
      return NextResponse.json(
        { error: "Ngày đã qua chỉ xem lại được, không chỉnh sửa được nữa" },
        { status: 403 }
      );
    }
    if (body.date > to) {
      return NextResponse.json(
        { error: `Chỉ được điền trước tối đa ${EDIT_AHEAD_DAYS} ngày` },
        { status: 403 }
      );
    }
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
            actualResult: item.actualResult ?? null,
            note: item.note ?? null,
            isTeachingSession: item.isTeachingSession ?? false,
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
            actualResult: item.actualResult ?? null,
            note: item.note ?? null,
            isTeachingSession: item.isTeachingSession ?? false,
          })),
        },
      },
      include: { items: { orderBy: { order: "asc" } } },
    });
  }

  return NextResponse.json(checklist);
}
