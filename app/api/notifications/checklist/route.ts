import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";

// Auto-cleanup helper — call before returning data
async function cleanup(userId: string) {
  await prisma.checklistNotification.deleteMany({
    where: {
      userId,
      createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
}

// GET — fetch checklist notifications for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  await cleanup(userId);

  const notifs = await prisma.checklistNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return NextResponse.json({
    notifications: notifs.map((n) => ({
      id:        n.id,
      type:      n.type,
      message:   n.message,
      isRead:    n.isRead,
      date:      n.date.toISOString(),
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}

// PATCH — mark notifications as read
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = body.ids ?? [];

  if (ids.length === 0) {
    // Mark all as read
    await prisma.checklistNotification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data:  { isRead: true },
    });
  } else {
    await prisma.checklistNotification.updateMany({
      where: { id: { in: ids }, userId: session.user.id },
      data:  { isRead: true },
    });
  }

  return NextResponse.json({ ok: true });
}
