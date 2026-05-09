import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";
import crypto               from "crypto";

type ReminderEntry = {
  assignedPTId: string;
  customerName:  string;
};

type Body =
  | { entries: ReminderEntry[] }
  | { assignedPTId: string; customerName: string };

// Use raw SQL to insert notifications — bypasses Prisma client enum validation
// which can be stale on Vercel due to build-cache of the generated client.
async function insertReminder(assignedPTId: string, customerName: string, now: Date) {
  const id      = crypto.randomUUID();
  const message = `⚠️ FM nhắc nhở: Chưa cập nhật tình hình chăm sóc cho khách hàng "${customerName}". Hãy cập nhật ngay!`;
  await prisma.$executeRaw`
    INSERT INTO checklist_notifications (id, "userId", type, message, "isRead", date, "createdAt")
    VALUES (
      ${id},
      ${assignedPTId},
      'LEAD_REMINDER'::"ChecklistNotifType",
      ${message},
      false,
      ${now},
      ${now}
    )
  `;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "FM") {
    return NextResponse.json({ error: "Forbidden", role: session.user.role }, { status: 403 });
  }

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const now = new Date();

  try {
    // Bulk
    if ("entries" in body) {
      const { entries } = body;
      if (!Array.isArray(entries) || entries.length === 0) {
        return NextResponse.json({ sent: 0, ptCount: 0 });
      }
      for (const e of entries) {
        await insertReminder(e.assignedPTId, e.customerName, now);
      }
      const ptCount = new Set(entries.map(e => e.assignedPTId)).size;
      return NextResponse.json({ sent: entries.length, ptCount });
    }

    // Single
    const { assignedPTId, customerName } = body;
    if (!assignedPTId || !customerName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    await insertReminder(assignedPTId, customerName, now);
    return NextResponse.json({ ok: true });

  } catch (err: unknown) {
    const e = err as { message?: string; code?: string; meta?: unknown };
    console.error("[lead-reminder] DB error:", e.message, "code:", e.code, "meta:", e.meta);
    return NextResponse.json(
      { error: "DB error", message: e.message, code: e.code },
      { status: 500 }
    );
  }
}
