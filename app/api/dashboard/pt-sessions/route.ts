import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "FM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const branchIdParam = searchParams.get("branchId") || null;
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);

  const managedBranchIds = session.user.managedBranchIds ?? [];

  // Validate branchId belongs to this FM
  const branchIds =
    branchIdParam && managedBranchIds.includes(branchIdParam)
      ? [branchIdParam]
      : managedBranchIds;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const logs = await prisma.workoutLog.findMany({
    where: {
      createdAt: { gte: monthStart, lt: monthEnd },
      client: { branchId: { in: branchIds } },
    },
    select: {
      clientId: true,
      createdById: true,
      createdBy: { select: { name: true, email: true } },
      client: { select: { branch: { select: { name: true } } } },
    },
  });

  // Aggregate by PT
  const ptMap = new Map<
    string,
    { ptName: string; branchName: string; sessionCount: number; clients: Set<string> }
  >();

  for (const log of logs) {
    const key = log.createdById;
    const ptName = log.createdBy.name ?? log.createdBy.email;
    const branchName = log.client.branch.name;
    if (!ptMap.has(key)) {
      ptMap.set(key, { ptName, branchName, sessionCount: 0, clients: new Set() });
    }
    const entry = ptMap.get(key)!;
    entry.sessionCount++;
    entry.clients.add(log.clientId);
  }

  const result = Array.from(ptMap.entries())
    .map(([ptId, e]) => ({
      ptId,
      ptName: e.ptName,
      branchName: e.branchName,
      sessionCount: e.sessionCount,
      clientCount: e.clients.size,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);

  return NextResponse.json(result);
}
