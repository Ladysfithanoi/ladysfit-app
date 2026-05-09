import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";

type ReminderEntry = {
  assignedPTId: string;
  customerName:  string;
};

type Body =
  | { entries: ReminderEntry[] }
  | { assignedPTId: string; customerName: string };

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    console.error("[lead-reminder] No session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "FM") {
    console.error("[lead-reminder] Wrong role:", session.user.role);
    return NextResponse.json({ error: "Forbidden", role: session.user.role }, { status: 403 });
  }

  let body: Body;
  try { body = await req.json(); } catch {
    console.error("[lead-reminder] Invalid body");
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
      console.log("[lead-reminder] Bulk creating", entries.length, "notifications");
      await prisma.checklistNotification.createMany({
        data: entries.map(e => ({
          userId:  e.assignedPTId,
          type:    "LEAD_REMINDER" as const,
          message: `⚠️ FM nhắc nhở: Chưa cập nhật tình hình chăm sóc cho khách hàng "${e.customerName}". Hãy cập nhật ngay!`,
          isRead:  false,
          date:    now,
        })),
      });
      const ptCount = new Set(entries.map(e => e.assignedPTId)).size;
      console.log("[lead-reminder] Bulk sent OK:", entries.length, "to", ptCount, "PTs");
      return NextResponse.json({ sent: entries.length, ptCount });
    }

    // Single
    const { assignedPTId, customerName } = body;
    if (!assignedPTId || !customerName) {
      console.error("[lead-reminder] Missing fields:", { assignedPTId, customerName });
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    console.log("[lead-reminder] Single creating for PT:", assignedPTId, "KH:", customerName);
    await prisma.checklistNotification.create({
      data: {
        userId:  assignedPTId,
        type:    "LEAD_REMINDER",
        message: `⚠️ FM nhắc nhở: Chưa cập nhật tình hình chăm sóc cho khách hàng "${customerName}". Hãy cập nhật ngay!`,
        isRead:  false,
        date:    now,
      },
    });
    console.log("[lead-reminder] Single sent OK");
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
