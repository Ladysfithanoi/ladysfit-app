import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Thông báo khách chậm tiến độ giảm cân của FM / Admin. Xem lib/performance-check.ts.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.slowProgressNotification.findMany({
    where: { userId: session.user.id },
    include: { client: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.slowProgressNotification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

// Bỏ `ids` = đánh dấu đã đọc tất cả.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

  await prisma.slowProgressNotification.updateMany({
    where: { userId: session.user.id, ...(ids.length > 0 ? { id: { in: ids } } : {}) },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
