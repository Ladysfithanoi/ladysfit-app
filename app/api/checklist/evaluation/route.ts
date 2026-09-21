import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, type Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { todayVN } from "@/lib/week";
import {
  isPeriod,
  isTaskDone,
  mergeReflection,
  periodRange,
  toDateOnly,
  type Period,
} from "@/lib/checklist-review";

/**
 * GET /api/checklist/evaluation?period=week&date=YYYY-MM-DD[&userId=...]
 *
 * Tổng kết đánh giá của FM theo ngày / tuần / tháng / quý / năm. Mỗi nhân sự
 * một dòng: đã chốt ngày bao nhiêu lần, FM đã chấm bao nhiêu lần, điểm trung
 * bình, tỉ lệ việc hoàn thành. Kèm `userId` thì trả thêm chi tiết TỪNG NGÀY của
 * riêng người đó (tự luận + đánh giá) để bung ra đọc.
 *
 * Số ngày của kỳ có thể lên tới 366 (cả năm) nhưng mỗi ngày chỉ là một dòng
 * check-list, nên một truy vấn theo khoảng là đủ — không lặp theo ngày.
 */

/** Trung bình làm tròn 1 chữ số, danh sách rỗng trả `null` chứ không phải 0. */
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM    = role === "FM";
  if (!isAdmin && !isFM) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rawPeriod = searchParams.get("period");
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : "week";
  const anchor = searchParams.get("date") ?? todayVN();
  const detailUserId = searchParams.get("userId");

  const range = periodRange(period, anchor);

  // Ai được nhìn: FM chỉ thấy nhân sự trong cơ sở mình phụ trách, Admin thấy hết.
  const staffWhere: Prisma.UserWhereInput = {
    // Đúng hai vai trò điền được check-list (xem POST /api/checklist/daily) —
    // gom thêm vai trò khác chỉ đẻ ra một loạt dòng toàn số 0.
    role: { in: ["PT", "FM"] as Role[] },
    deletedAt: null,
  };
  if (isFM) {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (managedBranchIds.length === 0) {
      return NextResponse.json({ period, ...range, staff: [], detail: null });
    }
    staffWhere.branchId = { in: managedBranchIds };
  }

  const staff = await prisma.user.findMany({
    where:   staffWhere,
    select:  { id: true, name: true, email: true, role: true, branch: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  if (staff.length === 0) {
    return NextResponse.json({ period, ...range, staff: [], detail: null });
  }

  const staffIds = staff.map(s => s.id);
  const to = toDateOnly(range.to);
  to.setUTCDate(to.getUTCDate() + 1);   // `to` của kỳ là ngày BAO GỒM

  const checklists = await prisma.dailyChecklist.findMany({
    where: {
      userId: { in: staffIds },
      reportDate: { gte: toDateOnly(range.from), lt: to },
    },
    select: {
      id: true, userId: true, reportDate: true, checkedOutAt: true,
      fmRating: true, fmComment: true, fmReviewedAt: true,
      fmReviewer: { select: { name: true, email: true } },
      dailyResults: true, dailyCompleted: true, dailyIncomplete: true, dailyNextPlan: true,
      items: { select: { kpi: true, actualResult: true } },
    },
    orderBy: { reportDate: "asc" },
  });

  const byUser = new Map<string, typeof checklists>();
  for (const c of checklists) {
    const list = byUser.get(c.userId);
    if (list) list.push(c);
    else byUser.set(c.userId, [c]);
  }

  const rows = staff.map(s => {
    const list = byUser.get(s.id) ?? [];

    let tasksTotal = 0;
    let tasksDone  = 0;
    for (const c of list) {
      for (const item of c.items) {
        tasksTotal += 1;
        if (isTaskDone(item.kpi, item.actualResult)) tasksDone += 1;
      }
    }

    const ratings = list.map(c => c.fmRating).filter((r): r is number => r != null);

    return {
      userId:       s.id,
      name:         s.name ?? s.email,
      role:         s.role,
      branchName:   s.branch?.name ?? "",
      daysFilled:   list.length,
      daysCheckedOut: list.filter(c => c.checkedOutAt != null).length,
      daysReviewed: list.filter(c => c.fmReviewedAt != null).length,
      avgRating:    average(ratings),
      tasksTotal,
      tasksDone,
      taskRate:     tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0,
    };
  });

  // Chi tiết từng ngày của một người — chỉ trả khi được hỏi, vì cả năm là 366
  // dòng tự luận.
  let detail: unknown = null;
  if (detailUserId && staffIds.includes(detailUserId)) {
    detail = (byUser.get(detailUserId) ?? []).map(c => ({
      date:           c.reportDate.toISOString().slice(0, 10),
      checkedOutAt:   c.checkedOutAt?.toISOString() ?? null,
      reflection:     mergeReflection(c),
      fmRating:       c.fmRating,
      fmComment:      c.fmComment,
      fmReviewedAt:   c.fmReviewedAt?.toISOString() ?? null,
      fmReviewerName: c.fmReviewer?.name ?? c.fmReviewer?.email ?? null,
    }));
  }

  return NextResponse.json({ period, ...range, staff: rows, detail });
}
