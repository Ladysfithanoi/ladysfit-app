import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Thông báo tiến độ lộ trình của FM (50/70/90% số buổi · 2 tháng / 1 tháng /
// 2 tuần theo ngày tập). Xem lib/package-progress.ts.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.packageProgressNotification.findMany({
    where: { userId: session.user.id },
    include: { client: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json({ notifications, unreadCount });
}

// Bỏ `ids` = đánh dấu đã đọc tất cả.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = body.ids ?? [];

  await prisma.packageProgressNotification.updateMany({
    where: { userId: session.user.id, ...(ids.length > 0 ? { id: { in: ids } } : {}) },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
