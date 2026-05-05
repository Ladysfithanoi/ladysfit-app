import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ptId = session.user.id;
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [myClients, chartLogs, rawRecentLogs] = await Promise.all([
    prisma.client.findMany({
      where: { assignedPTId: ptId },
      select: {
        id: true, fullName: true, status: true,
        initialWeight: true, currentWeight: true, targetWeight: true,
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.weightLog.findMany({
      where: { date: { gte: eightWeeksAgo }, client: { assignedPTId: ptId } },
      select: { date: true, weight: true, client: { select: { initialWeight: true } } },
    }),
    prisma.weightLog.findMany({
      where: { client: { assignedPTId: ptId } },
      include: { client: { select: { id: true, fullName: true } } },
      orderBy: { date: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({ myClients, chartLogs, rawRecentLogs });
}
