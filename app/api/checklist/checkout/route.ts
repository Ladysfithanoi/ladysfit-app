import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { todayVN, addDaysISO } from "@/lib/week";
import { dayRange, fmtVN, mergeReflection } from "@/lib/checklist-review";

/**
 * POST /api/checklist/checkout — nhân sự chốt ngày làm việc của chính mình.
 *
 * Check-list đã tự lưu suốt ngày, nên việc duy nhất của endpoint này là đóng
 * dấu `checkedOutAt` và báo cho FM phụ trách cơ sở biết là có người vừa xong
 * việc, mời vào đọc tự luận và chấm điểm.
 *
 * Chỉ chốt được cho CHÍNH MÌNH và chỉ cho ngày hôm nay hoặc hôm qua — chốt một
 * ngày trong tương lai thì vô nghĩa (chưa làm), còn ngày đã lùi quá xa thì
 * thông báo tới FM cũng không còn để làm gì. Hôm qua vẫn cho vì ca tối kết thúc
 * sau nửa đêm là chuyện thường.
 */

const BACKDATE_DAYS = 1;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { date?: string };
  const date = body.date ?? todayVN();

  const today   = todayVN();
  const earliest = addDaysISO(today, -BACKDATE_DAYS);
  if (date > today) {
    return NextResponse.json({ error: "Chưa tới ngày này nên chưa check-out được" }, { status: 400 });
  }
  if (date < earliest) {
    return NextResponse.json(
      { error: "Ngày đã qua quá lâu, không check-out được nữa" },
      { status: 400 },
    );
  }

  const userId = session.user.id;

  const checklist = await prisma.dailyChecklist.findFirst({
    where:  { userId, reportDate: dayRange(date) },
    select: {
      id: true, checkedOutAt: true,
      dailyResults: true, dailyCompleted: true, dailyIncomplete: true, dailyNextPlan: true,
    },
  });

  // Không có check-list nghĩa là chưa điền gì — không có gì để FM đọc.
  if (!checklist) {
    return NextResponse.json(
      { error: "Chưa có check-list cho ngày này. Điền việc trong ngày trước đã nhé." },
      { status: 400 },
    );
  }

  // Tự luận cuối ngày chính là thứ FM được mời vào đọc, nên thiếu nó thì việc
  // chốt ngày không mang theo nội dung gì.
  if (!mergeReflection(checklist).trim()) {
    return NextResponse.json(
      { error: "Viết tự luận cuối ngày trước khi check-out nhé." },
      { status: 400 },
    );
  }

  // Bấm lại lần nữa thì giữ nguyên mốc cũ và KHÔNG bắn thêm thông báo — FM chỉ
  // cần biết một lần cho mỗi ngày.
  if (checklist.checkedOutAt) {
    return NextResponse.json({
      checkedOutAt: checklist.checkedOutAt.toISOString(),
      alreadyDone:  true,
      notified:     0,
    });
  }

  const checkedOutAt = new Date();
  await prisma.dailyChecklist.update({
    where: { id: checklist.id },
    data:  { checkedOutAt },
  });

  const notified = await notifyManagers(userId, date, checklist.id);

  return NextResponse.json({
    checkedOutAt: checkedOutAt.toISOString(),
    alreadyDone:  false,
    notified,
  });
}

/**
 * Báo cho các FM phụ trách cơ sở của nhân sự này. `relatedId` mang chính id của
 * nhân sự, còn ngày nằm ở cột `date`, nên chuông bấm vào là mở thẳng check-list
 * đúng người đúng ngày.
 *
 * Thông báo hỏng không được làm hỏng việc chốt ngày: dấu check-out đã ghi rồi,
 * mất một dòng chuông còn hơn bắt nhân sự bấm lại.
 */
async function notifyManagers(userId: string, date: string, checklistId: string): Promise<number> {
  try {
    const staff = await prisma.user.findUnique({
      where:  { id: userId },
      select: { name: true, email: true, branchId: true, branch: { select: { name: true } } },
    });
    if (!staff?.branchId) return 0;

    const fms = await prisma.user.findMany({
      where: {
        role: "FM",
        deletedAt: null,
        managedBranches: { some: { branchId: staff.branchId } },
      },
      select: { id: true },
    });
    if (fms.length === 0) return 0;

    const who = staff.name ?? staff.email;
    const where = staff.branch?.name ? ` · ${staff.branch.name}` : "";
    const message = `🏁 ${who}${where} đã check-out ngày ${fmtVN(date)} — mời xem tự luận cuối ngày và đánh giá.`;

    await prisma.checklistNotification.createMany({
      data: fms.map(fm => ({
        userId:    fm.id,
        type:      "CHECKOUT" as const,
        message,
        isRead:    false,
        date:      new Date(`${date}T00:00:00.000Z`),
        relatedId: userId,
      })),
    });
    return fms.length;
  } catch (err) {
    console.error("Checkout notify error:", err, { userId, date, checklistId });
    return 0;
  }
}
