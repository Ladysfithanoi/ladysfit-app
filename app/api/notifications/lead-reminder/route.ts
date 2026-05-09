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
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const now = new Date();

  // Bulk
  if ("entries" in body) {
    const { entries } = body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ sent: 0 });
    }
    await prisma.checklistNotification.createMany({
      data: entries.map(e => ({
        userId:  e.assignedPTId,
        type:    "LEAD_REMINDER" as const,
        message: `⚠️ FM nhắc nhở: Chưa cập nhật tình hình chăm sóc cho khách hàng "${e.customerName}". Hãy cập nhật ngay!`,
        isRead:  false,
        date:    now,
      })),
    });
    return NextResponse.json({ sent: entries.length });
  }

  // Single
  const { assignedPTId, customerName } = body;
  if (!assignedPTId || !customerName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  await prisma.checklistNotification.create({
    data: {
      userId:  assignedPTId,
      type:    "LEAD_REMINDER",
      message: `⚠️ FM nhắc nhở: Chưa cập nhật tình hình chăm sóc cho khách hàng "${customerName}". Hãy cập nhật ngay!`,
      isRead:  false,
      date:    now,
    },
  });
  return NextResponse.json({ ok: true });
}
