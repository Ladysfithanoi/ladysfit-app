import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FM" && role !== "CEO_FITPARTNER" && role !== "COO") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const branchFilter = isFM ? { id: { in: managedBranchIds } } : undefined;
  const clientBranchFilter = isFM ? { branchId: { in: managedBranchIds } } : {};

  const [allClients, branches, chartLogs] = await Promise.all([
    prisma.client.findMany({
      where: clientBranchFilter,
      select: {
        id: true, fullName: true, status: true,
        initialWeight: true, currentWeight: true,
        updatedAt: true, branchId: true,
        branch: { select: { id: true, name: true } },
        assignedPT: { select: { name: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.branch.findMany({
      where: branchFilter,
      select: { id: true, name: true, _count: { select: { users: { where: { deletedAt: null } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.weightLog.findMany({
      where: {
        date: { gte: eightWeeksAgo },
        ...(isFM ? { client: { branchId: { in: managedBranchIds } } } : {}),
      },
      select: { date: true, weight: true, client: { select: { initialWeight: true } } },
    }),
  ]);

  return NextResponse.json({ allClients, branches, chartLogs });
}
