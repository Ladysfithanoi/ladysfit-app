import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "FM", "CEO_FITPARTNER", "COO"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isFM = session.user.role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const alerts = await prisma.performanceAlert.findMany({
    where: isFM ? { client: { branchId: { in: managedBranchIds } } } : {},
    include: {
      client: { select: { id: true, fullName: true, branchId: true, branch: { select: { id: true, name: true } } } },
      pt: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(
    alerts.map((a) => ({
      id: a.id,
      alertType: a.alertType,
      weekStart: a.weekStart.toISOString(),
      expectedRate: a.expectedRate,
      actualRate: a.actualRate,
      weeksAnalyzed: a.weeksAnalyzed ?? null,
      note: a.note ?? null,
      isRead: a.isRead,
      createdAt: a.createdAt.toISOString(),
      client: a.client,
      branchId: a.client.branchId,
      branchName: a.client.branch?.name ?? "—",
      pt: a.pt,
    }))
  );
}
