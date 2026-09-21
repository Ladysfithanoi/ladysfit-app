import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/setup/leads/follow-ups — các hẹn chăm sóc lại cần nhắc người đang
 * đăng nhập, để vẽ dòng nhắc trên đầu trang.
 *
 * Nhắc ĐÚNG NGƯỜI, không nhắc cả phòng: lead của chính mình, cộng thêm những cái
 * hẹn do chính mình đặt hộ (FM đặt hẹn trên lead của nhân sự khác thì FM cũng
 * phải thấy). FM không vì thế mà nhận hết hẹn của cả cơ sở — như vậy thì dòng
 * nhắc thành một đống ai cũng bỏ qua.
 *
 * Lấy tới HẾT HÔM NAY: hẹn đã tới giờ (kể cả quá hạn từ hôm trước) là việc phải
 * làm ngay, hẹn còn lại trong ngày là để biết trước mà xếp lịch.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;

  // Cuối ngày hôm nay theo giờ Việt Nam, quy về mốc tuyệt đối. Máy chủ chạy giờ
  // UTC nên phải cộng +7 mới biết "hôm nay" ở Việt Nam là ngày nào.
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const endOfTodayVN = new Date(Date.UTC(
    vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate(), 23, 59, 59, 999,
  ) - 7 * 60 * 60 * 1000);

  const leads = await prisma.salesLead.findMany({
    where: {
      followUpAt:     { not: null, lte: endOfTodayVN },
      followUpDoneAt: null,
      OR: [{ assignedPTId: me }, { followUpById: me }],
    },
    select: {
      id: true, customerName: true, phone: true, status: true,
      followUpAt: true, followUpNote: true,
      assignedPT: { select: { name: true, email: true } },
      branch:     { select: { name: true } },
    },
    orderBy: { followUpAt: "asc" },
    take: 50,
  });

  const now = Date.now();
  return NextResponse.json(
    leads.map(l => ({
      id:           l.id,
      customerName: l.customerName,
      phone:        l.phone,
      status:       l.status,
      followUpAt:   l.followUpAt!.toISOString(),
      followUpNote: l.followUpNote,
      ptName:       l.assignedPT?.name ?? l.assignedPT?.email ?? null,
      branchName:   l.branch?.name ?? null,
      /** Đã tới giờ — phân biệt việc phải làm ngay với hẹn còn ở phía trước. */
      due:          l.followUpAt!.getTime() <= now,
    })),
  );
}
