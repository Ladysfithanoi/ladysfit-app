import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";

type RawNotif = {
  id:        string;
  type:      string;
  message:   string;
  isRead:    boolean;
  date:      Date;
  relatedId: string | null;
  createdAt: Date;
};

// Auto-cleanup: delete notifications older than 7 days
async function cleanup(userId: string) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.$executeRaw`
    DELETE FROM checklist_notifications
    WHERE "userId" = ${userId} AND "createdAt" < ${cutoff}
  `;
}

// GET — fetch checklist notifications for current user
// Uses raw SQL so unknown enum values (e.g. LEAD_REMINDER on a stale Prisma client)
// are returned as plain strings instead of causing a validation error.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  await cleanup(userId);

  const notifs = await prisma.$queryRaw<RawNotif[]>`
    SELECT id, type, message, "isRead", date, "relatedId", "createdAt"
    FROM checklist_notifications
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
    LIMIT 20
  `;

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return NextResponse.json({
    notifications: notifs.map((n) => ({
      id:        n.id,
      type:      n.type,
      message:   n.message,
      isRead:    n.isRead,
      date:      n.date instanceof Date ? n.date.toISOString() : n.date,
      relatedId: n.relatedId ?? null,
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
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
    await prisma.$executeRaw`
      UPDATE checklist_notifications
      SET "isRead" = true
      WHERE "userId" = ${session.user.id} AND "isRead" = false
    `;
  } else {
    // Build a safe IN clause — ids are UUIDs/cuid strings, no SQL injection risk
    // but we still use a loop of individual updates for safety
    for (const id of ids) {
      await prisma.$executeRaw`
        UPDATE checklist_notifications
        SET "isRead" = true
        WHERE id = ${id} AND "userId" = ${session.user.id}
      `;
    }
  }

  return NextResponse.json({ ok: true });
}
