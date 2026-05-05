import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "FM", "CEO_FITPARTNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isFM = session.user.role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const branchFilter = isFM ? { branchId: { in: managedBranchIds } } : {};

  const [totalClients, activeClients, pausedClients, totalStaff, totalPackages, activePackages] =
    await Promise.all([
      prisma.client.count({ where: branchFilter }),
      prisma.client.count({ where: { ...branchFilter, status: "ACTIVE" } }),
      prisma.client.count({ where: { ...branchFilter, status: "PAUSED" } }),
      isFM
        ? prisma.user.count({ where: { branchId: { in: managedBranchIds } } })
        : prisma.user.count(),
      prisma.packageEnrollment.count({
        where: { client: branchFilter },
      }),
      prisma.packageEnrollment.count({
        where: { client: branchFilter, status: "ACTIVE" },
      }),
    ]);

  // New clients per month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const newClientsByMonth = await prisma.client.findMany({
    where: { ...branchFilter, createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true },
  });

  const monthlyMap: Record<string, number> = {};
  for (const c of newClientsByMonth) {
    const key = `${c.createdAt.getFullYear()}-${String(c.createdAt.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = (monthlyMap[key] ?? 0) + 1;
  }

  const monthlyNew: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("vi-VN", { month: "short", year: "2-digit" });
    monthlyNew.push({ month: label, count: monthlyMap[key] ?? 0 });
  }

  return NextResponse.json({
    totalClients,
    activeClients,
    pausedClients,
    totalStaff,
    totalPackages,
    activePackages,
    monthlyNew,
  });
}
