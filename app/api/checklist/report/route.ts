import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mondayOf, todayVN, weekKey, weekLabel } from "@/lib/week";

// Báo cáo tuần của một nhân sự (bảng weekly_monthly_reports, reportType = WEEKLY).
// Một tuần được định danh bằng Thứ 2 của tuần đó — server quy về (year, month,
// weekNumber) qua weekKey() nên client chỉ cần gửi `weekStart`.

type ReportBody = {
  weekStart:    string;
  userId?:      string;
  content?:     string;
  submit?:      boolean;
  aiGenerated?: boolean;
};

function isValidISO(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** FM/ADMIN được xem báo cáo của nhân sự thuộc chi nhánh mình quản lý. */
async function canViewOther(
  role: string,
  managedBranchIds: string[],
  targetUserId: string
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "FM") return false;
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { branchId: true },
  });
  return !!target?.branchId && managedBranchIds.includes(target.branchId);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["PT", "FM", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawWeek = searchParams.get("weekStart");
  const weekStart = mondayOf(isValidISO(rawWeek) ? rawWeek : todayVN());
  const requestedUserId = searchParams.get("userId") ?? session.user.id;

  if (requestedUserId !== session.user.id) {
    const ok = await canViewOther(role, session.user.managedBranchIds ?? [], requestedUserId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { year, month, weekNumber } = weekKey(weekStart);
  const report = await prisma.weeklyMonthlyReport.findFirst({
    where: { userId: requestedUserId, reportType: "WEEKLY", month, year, weekNumber },
  });

  return NextResponse.json({ weekStart, report });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["PT", "FM", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as ReportBody;
  if (!isValidISO(body.weekStart)) {
    return NextResponse.json({ error: "Thiếu tuần cần lưu" }, { status: 400 });
  }

  // Ai cũng chỉ viết được báo cáo của chính mình.
  if (body.userId && body.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = session.user.id;

  const weekStart = mondayOf(body.weekStart);
  // Không cho viết trước cho tuần chưa tới.
  if (weekStart > mondayOf(todayVN())) {
    return NextResponse.json(
      { error: "Chưa thể viết báo cáo cho tuần chưa bắt đầu" },
      { status: 403 }
    );
  }

  const { year, month, weekNumber } = weekKey(weekStart);

  // Nội dung báo cáo giờ là một ô duy nhất, lưu ở cột `results`. Ba cột cũ được
  // xoá đi vì client đã gộp chúng vào ô này khi mở báo cáo cũ ra — giữ lại sẽ
  // thành nội dung trùng lặp.
  const data = {
    results:     body.content?.trim() || null,
    completed:   null,
    incomplete:  null,
    nextPlan:    null,
    aiGenerated: body.aiGenerated ?? false,
    ...(body.submit ? { submittedAt: new Date() } : {}),
  };

  const existing = await prisma.weeklyMonthlyReport.findFirst({
    where: { userId, reportType: "WEEKLY", month, year, weekNumber },
  });

  const report = existing
    ? await prisma.weeklyMonthlyReport.update({ where: { id: existing.id }, data })
    : await prisma.weeklyMonthlyReport.create({
        data: { userId, reportType: "WEEKLY", month, year, weekNumber, ...data },
      });

  // Gửi cho FM → báo cho mọi FM đang quản lý chi nhánh của người gửi.
  let notified = 0;
  if (body.submit) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, branchId: true },
    });
    if (me?.branchId) {
      const fms = await prisma.user.findMany({
        where: {
          role: "FM",
          deletedAt: null,
          id: { not: userId },
          managedBranches: { some: { branchId: me.branchId } },
        },
        select: { id: true },
      });
      const message = `🗒️ ${me.name ?? me.email} đã gửi báo cáo tuần — ${weekLabel(weekStart)}`;
      for (const fm of fms) {
        // Enum WEEKLY_REPORT có thể chưa có trên Prisma client cũ → dùng raw SQL,
        // giống cách các route thông báo khác đang làm. Id được dựng cố định theo
        // (báo cáo, FM) nên gửi lại chỉ cập nhật chứ không tạo thêm thông báo mới.
        // Báo cáo đã lưu xong rồi, nên lỗi khi bắn thông báo không được làm hỏng
        // thao tác gửi của nhân sự.
        try {
          await prisma.$executeRaw`
            INSERT INTO checklist_notifications (id, "userId", type, message, "isRead", date, "relatedId", "createdAt")
            VALUES (
              ${`wr_${report.id}_${fm.id}`},
              ${fm.id},
              'WEEKLY_REPORT'::"ChecklistNotifType",
              ${message},
              false,
              ${new Date()},
              ${report.id},
              ${new Date()}
            )
            ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message, "isRead" = false, "createdAt" = EXCLUDED."createdAt"
          `;
          notified += 1;
        } catch (err) {
          console.error("weekly report notify failed", err);
        }
      }
    }
  }

  return NextResponse.json({ report, notified });
}
