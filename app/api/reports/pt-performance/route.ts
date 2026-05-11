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

  const ptFilter = isFM ? { branchId: { in: managedBranchIds } } : {};

  const pts = await prisma.user.findMany({
    where: { ...ptFilter, role: { in: ["FREE", "RESTRICTED"] }, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      clients: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          workoutLogs: { select: { id: true, sessionDate: true }, orderBy: { sessionDate: "desc" }, take: 30 },
        },
      },
      ptAlerts: {
        where: { isRead: false },
        select: { id: true, alertType: true },
      },
    },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = pts.map((pt) => {
    const activeClients = pt.clients.length;
    const recentSessions = pt.clients.reduce((sum, c) => {
      return sum + c.workoutLogs.filter((l) => new Date(l.sessionDate) >= thirtyDaysAgo).length;
    }, 0);
    const unreadAlerts = pt.ptAlerts.length;

    return {
      id: pt.id,
      name: pt.name ?? pt.email,
      activeClients,
      recentSessions,
      unreadAlerts,
    };
  });

  return NextResponse.json(result);
}
