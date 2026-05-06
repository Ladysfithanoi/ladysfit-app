import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") ?? "";
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const dayStart = new Date(parsed);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];

  const pts = await prisma.user.findMany({
    where: { role: { in: ["FREE", "RESTRICTED"] }, branchId: { in: managedBranchIds } },
    select: { id: true, name: true, email: true, branch: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const filled = await prisma.dailyChecklist.findMany({
    where: { userId: { in: pts.map((p) => p.id) }, reportDate: { gte: dayStart, lt: dayEnd } },
    select: { userId: true },
  });
  const filledIds = new Set(filled.map((c) => c.userId));

  return NextResponse.json({
    date:      dayStart.toISOString(),
    filled:    pts.filter((p) =>  filledIds.has(p.id)).map((p) => ({ id: p.id, name: p.name ?? p.email, branchName: p.branch?.name ?? "" })),
    notFilled: pts.filter((p) => !filledIds.has(p.id)).map((p) => ({ id: p.id, name: p.name ?? p.email, branchName: p.branch?.name ?? "" })),
  });
}
