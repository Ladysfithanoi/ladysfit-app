import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";
import { FILLED_CHECKLIST_WHERE } from "@/lib/checklist-review";

// Vercel Cron gọi bằng GET kèm "Authorization: Bearer <CRON_SECRET>"; nút
// "Test thông báo" của Admin gọi POST bằng phiên đăng nhập. Trước đây route chỉ
// có POST và chỉ đọc header x-cron-secret, nên cron của Vercel chưa lần nào lọt qua.
function authorized(req: Request, role?: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (secret && req.headers.get("x-cron-secret") === secret) return true;
  return role === "ADMIN";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!authorized(req, session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const pts = await prisma.user.findMany({
    where: { role: "PT", deletedAt: null },
    select: { id: true },
  });
  if (pts.length === 0) return NextResponse.json({ created: 0 });

  const ptIds = pts.map((p) => p.id);

  const [filledToday, existingReminders] = await Promise.all([
    prisma.dailyChecklist.findMany({
      where: { userId: { in: ptIds }, reportDate: { gte: today, lt: tomorrow }, ...FILLED_CHECKLIST_WHERE },
      select: { userId: true },
    }),
    prisma.checklistNotification.findMany({
      where: { userId: { in: ptIds }, type: "REMINDER", date: { gte: today, lt: tomorrow } },
      select: { userId: true },
    }),
  ]);

  const filledIds    = new Set(filledToday.map((c) => c.userId));
  const remindedIds  = new Set(existingReminders.map((r) => r.userId));
  const toRemind     = ptIds.filter((id) => !filledIds.has(id) && !remindedIds.has(id));

  if (toRemind.length === 0) return NextResponse.json({ created: 0 });

  await prisma.checklistNotification.createMany({
    data: toRemind.map((userId) => ({
      userId,
      type: "REMINDER" as const,
      message: "⏰ Nhắc nhở: Bạn chưa điền Check-list hôm nay.\nHãy cập nhật ngay để FM theo dõi tiến độ nhé!",
      isRead: false,
      date: today,
    })),
  });

  return NextResponse.json({ created: toRemind.length });
}

export const GET = POST;
