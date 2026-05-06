import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";

function authorized(req: Request, role?: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") === secret) return true;
  return role === "ADMIN";
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
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

  // Get all FM users with their managed branches
  const fms = await prisma.user.findMany({
    where: { role: "FM" },
    select: {
      id: true,
      managedBranches: { select: { branchId: true } },
    },
  });

  let created = 0;

  for (const fm of fms) {
    const branchIds = fm.managedBranches.map((b) => b.branchId);
    if (branchIds.length === 0) continue;

    // Skip if already has a report for today
    const existing = await prisma.checklistNotification.findFirst({
      where: { userId: fm.id, type: "DAILY_REPORT", date: { gte: today, lt: tomorrow } },
    });
    if (existing) continue;

    // Get all PTs in managed branches with branch name
    const pts = await prisma.user.findMany({
      where: { role: { in: ["FREE", "RESTRICTED"] }, branchId: { in: branchIds } },
      select: { id: true, name: true, email: true, branchId: true, branch: { select: { name: true } } },
    });
    if (pts.length === 0) continue;

    // Check who filled checklist today
    const filled = await prisma.dailyChecklist.findMany({
      where: { userId: { in: pts.map((p) => p.id) }, reportDate: { gte: today, lt: tomorrow } },
      select: { userId: true },
    });
    const filledIds = new Set(filled.map((c) => c.userId));

    const filledPts    = pts.filter((p) => filledIds.has(p.id));
    const notFilledPts = pts.filter((p) => !filledIds.has(p.id));

    const filledLines    = filledPts.map((p)    => `• ${p.name ?? p.email} - ${p.branch?.name ?? ""}`).join("\n");
    const notFilledLines = notFilledPts.map((p) => `• ${p.name ?? p.email} - ${p.branch?.name ?? ""}`).join("\n");

    const message = [
      `📋 Báo cáo Check-list ngày ${fmtDate(today)}`,
      "",
      `✅ Đã điền (${filledPts.length} người):`,
      filledLines || "• (Không có)",
      "",
      `❌ Chưa điền (${notFilledPts.length} người):`,
      notFilledLines || "• (Không có)",
    ].join("\n");

    await prisma.checklistNotification.create({
      data: {
        userId:  fm.id,
        type:    "DAILY_REPORT",
        message,
        isRead:  false,
        date:    today,
      },
    });
    created++;
  }

  return NextResponse.json({ created });
}
