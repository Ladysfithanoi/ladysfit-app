import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminDashboard, AdminStats } from "@/components/dashboard/admin-dashboard";
import { PTDashboard, PTStats } from "@/components/dashboard/pt-dashboard";
import { WeekDayData } from "@/components/dashboard/weight-chart";
import { CEODashboard } from "@/components/dashboard/ceo-dashboard";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function getLast8WeeksData(
  logs: { date: Date; weight: number; client: { initialWeight: number } }[]
): WeekDayData[] {
  const now = new Date();
  const dow = now.getDay();
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  thisMonday.setHours(0, 0, 0, 0);

  return Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(thisMonday.getDate() - (7 - i) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const label =
      i === 7
        ? "Tuần này"
        : `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

    const losses = logs
      .filter((l) => l.date >= weekStart && l.date < weekEnd)
      .map((l) => l.client.initialWeight - l.weight)
      .filter((loss) => loss > 0);

    const avgLoss =
      losses.length > 0
        ? Math.round((losses.reduce((a, b) => a + b, 0) / losses.length) * 10) / 10
        : 0;

    return { day: label, avgLoss };
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isCEO = role === "CEO_FITPARTNER";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];
  const greet = greeting();
  const userName = session.user.name ?? "bạn";

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  if (isCEO) {
    return <CEODashboard month={new Date().getMonth() + 1} year={new Date().getFullYear()} />;
  }

  if (isAdmin || isFM) {
    const noFitpartner = { name: { not: { contains: "Fitpartner" } } };
    const clientBranchFilter = isFM
      ? { branchId: { in: managedBranchIds }, branch: noFitpartner }
      : { branch: noFitpartner };
    const branchFilter = isFM
      ? { id: { in: managedBranchIds }, ...noFitpartner }
      : noFitpartner;

    const [allClients, branches, chartLogs] = await Promise.all([
      prisma.client.findMany({
        where: clientBranchFilter,
        select: {
          id: true,
          fullName: true,
          status: true,
          initialWeight: true,
          currentWeight: true,
          updatedAt: true,
          branchId: true,
          branch: { select: { id: true, name: true } },
          assignedPT: { select: { name: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.branch.findMany({
        where: branchFilter,
        select: { id: true, name: true, _count: { select: { users: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.weightLog.findMany({
        where: {
          date: { gte: eightWeeksAgo },
          client: isFM
            ? { branchId: { in: managedBranchIds }, branch: noFitpartner }
            : { branch: noFitpartner },
        },
        select: { date: true, weight: true, client: { select: { initialWeight: true } } },
      }),
    ]);

    const transformed = allClients.filter((c) => c.initialWeight - c.currentWeight >= 7);

    const stats: AdminStats = {
      totalClients: allClients.length,
      activeClients: allClients.filter((c) => c.status === "ACTIVE").length,
      transformedCount: transformed.length,
      branchCount: branches.length,
      branchStats: branches.map((b) => {
        const bc = allClients.filter((c) => c.branchId === b.id);
        const bt = bc.filter((c) => c.initialWeight - c.currentWeight >= 7);
        return {
          id: b.id,
          name: b.name,
          ptCount: b._count.users,
          totalKH: bc.length,
          activeKH: bc.filter((c) => c.status === "ACTIVE").length,
          transformedKH: bt.length,
          transformRate: bc.length > 0 ? (bt.length / bc.length) * 100 : 0,
        };
      }),
      recentTransforms: transformed.slice(0, 10).map((c) => ({
        id: c.id,
        fullName: c.fullName,
        branchName: c.branch.name,
        ptName: c.assignedPT.name ?? c.assignedPT.email,
        lostKg: c.initialWeight - c.currentWeight,
        updatedAt: c.updatedAt.toISOString(),
      })),
      weeklyChart: getLast8WeeksData(chartLogs),
    };

    return <AdminDashboard stats={stats} greeting={greet} userName={userName} isFM={isFM} />;
  }

  // PT view
  const ptId = session.user.id;

  const [myClients, chartLogs, rawRecentLogs] = await Promise.all([
    prisma.client.findMany({
      where: { assignedPTId: ptId },
      select: {
        id: true,
        fullName: true,
        status: true,
        initialWeight: true,
        currentWeight: true,
        targetWeight: true,
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

  const recentLogs = rawRecentLogs.slice(0, 5).map((log) => {
    const prev = rawRecentLogs.find(
      (l) =>
        l.clientId === log.clientId &&
        new Date(l.date).getTime() < new Date(log.date).getTime()
    );
    return {
      clientId: log.clientId,
      clientName: log.client.fullName,
      weight: log.weight,
      change: prev ? log.weight - prev.weight : null,
      logDate: log.date.toISOString(),
    };
  });

  const stats: PTStats = {
    totalClients: myClients.length,
    activeClients: myClients.filter((c) => c.status === "ACTIVE").length,
    transformedCount: myClients.filter((c) => c.initialWeight - c.currentWeight >= 7).length,
    clientProgress: myClients.map((c) => {
      const lostKg = Math.max(0, c.initialWeight - c.currentWeight);
      const totalToLose = c.initialWeight - c.targetWeight;
      return {
        id: c.id,
        fullName: c.fullName,
        currentWeight: c.currentWeight,
        initialWeight: c.initialWeight,
        targetWeight: c.targetWeight,
        lostKg,
        progressPct: totalToLose > 0 ? Math.min(100, Math.round((lostKg / totalToLose) * 100)) : 0,
        isTransformed: lostKg >= 7,
      };
    }),
    recentLogs,
    weeklyChart: getLast8WeeksData(chartLogs),
  };

  return <PTDashboard stats={stats} greeting={greet} userName={userName} role={role} />;
}
