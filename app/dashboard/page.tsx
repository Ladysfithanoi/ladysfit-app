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
  const isCEO = role === "CEO_FITPARTNER" || role === "COO";
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
          height: true,
          updatedAt: true,
          branchId: true,
          assignedPTId: true,
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
          client: isFM
            ? { branchId: { in: managedBranchIds }, branch: noFitpartner }
            : { branch: noFitpartner },
        },
        select: { date: true, weight: true, client: { select: { initialWeight: true } } },
      }),
    ]);

    const transformed = allClients.filter((c) => c.initialWeight - c.currentWeight >= 7);

    // Determine WHEN each transformed client first reached ≥ 7 kg loss, so transforms
    // can be grouped by month / quarter. Fall back to updatedAt if no weight log crossed.
    const transformedIds = transformed.map((c) => c.id);
    const transformLogs =
      transformedIds.length > 0
        ? await prisma.weightLog.findMany({
            where: { clientId: { in: transformedIds } },
            select: { clientId: true, date: true, weight: true },
            orderBy: { date: "asc" },
          })
        : [];

    const transformedById = new Map(transformed.map((c) => [c.id, c]));
    const firstTransformDate = new Map<string, Date>();
    for (const log of transformLogs) {
      if (firstTransformDate.has(log.clientId)) continue;
      const c = transformedById.get(log.clientId);
      if (c && c.initialWeight - log.weight >= 7) {
        firstTransformDate.set(log.clientId, log.date);
      }
    }

    // Fetch every client's package enrollments (lộ trình) to compute:
    //  - how many lộ trình each client has bought (enrollCount)
    //  - whether a client still has an ongoing lộ trình. "Ongoing" = ACTIVE and not past its
    //    end date, or PAUSED. COMPLETED / EXPIRED (incl. ACTIVE past endDate) = finished.
    const allClientIds = allClients.map((c) => c.id);
    const enrollments =
      allClientIds.length > 0
        ? await prisma.packageEnrollment.findMany({
            where: { clientId: { in: allClientIds } },
            select: { clientId: true, status: true, endDate: true, packageName: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          })
        : [];

    const now = Date.now();
    const enrollCount = new Map<string, number>();
    const ongoingProgramClientIds = new Set<string>();
    // Most recent enrollment per client (used to show the package + when it ended).
    const lastEnrollment = new Map<string, { packageName: string; endDate: Date | null }>();
    for (const e of enrollments) {
      enrollCount.set(e.clientId, (enrollCount.get(e.clientId) ?? 0) + 1);
      lastEnrollment.set(e.clientId, { packageName: e.packageName, endDate: e.endDate });
      const expired = e.status === "ACTIVE" && e.endDate != null && now > e.endDate.getTime();
      const ongoing = (e.status === "ACTIVE" && !expired) || e.status === "PAUSED";
      if (ongoing) ongoingProgramClientIds.add(e.clientId);
    }

    // Eligible to lose 7 kg = at least 7 kg above ideal weight (height − 100):
    //   initialWeight(kg) − height(cm) + 100 ≥ 7. Clients without weight/height are unclassified.
    const isEligible = (c: { initialWeight: number; height: number }) =>
      c.initialWeight > 0 && c.height > 0 && c.initialWeight - c.height + 100 >= 7;
    const isClassifiable = (c: { initialWeight: number; height: number }) =>
      c.initialWeight > 0 && c.height > 0;
    const isTransformed = (c: { initialWeight: number; currentWeight: number }) =>
      c.initialWeight - c.currentWeight >= 7;

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
      transformEvents: transformed.map((c) => ({
        branchId: c.branchId,
        branchName: c.branch.name,
        date: (firstTransformDate.get(c.id) ?? c.updatedAt).toISOString(),
      })),
      transformQuality: branches.map((b) => {
        const bc = allClients.filter((c) => c.branchId === b.id);
        let eligible = 0, eligibleTransformed = 0, notEligible = 0, notEligibleTransformed = 0;
        let eligibleNotTransformedOngoing = 0;
        for (const c of bc) {
          const t = isTransformed(c);
          if (isClassifiable(c)) {
            if (isEligible(c)) {
              eligible += 1;
              if (t) eligibleTransformed += 1;
              else if (ongoingProgramClientIds.has(c.id)) eligibleNotTransformedOngoing += 1;
            } else {
              notEligible += 1;
              if (t) notEligibleTransformed += 1;
            }
          }
        }
        return {
          branchId: b.id,
          eligible,
          eligibleTransformed,
          notEligible,
          notEligibleTransformed,
          eligibleNotTransformedOngoing,
        };
      }),
      notTransformedClients: allClients
        .filter((c) => !isTransformed(c))
        .map((c) => ({
          id: c.id,
          fullName: c.fullName,
          branchId: c.branchId,
          branchName: c.branch.name,
          ptId: c.assignedPTId,
          ptName: c.assignedPT.name ?? c.assignedPT.email,
          currentWeight: c.currentWeight,
          initialWeight: c.initialWeight,
          lostKg: Math.max(0, c.initialWeight - c.currentWeight),
          eligible: isClassifiable(c) ? isEligible(c) : null,
          hasOngoingProgram: ongoingProgramClientIds.has(c.id),
        })),
      // Churn (rời bỏ) by number of lộ trình bought. A buyer (≥1 enrollment) has "churned"
      // when no enrollment is currently ongoing. Buckets: exactly 1 / 2 / 3 / 4+.
      churnStats: branches.map((b) => {
        const row = {
          branchId: b.id,
          total1: 0, churned1: 0,
          total2: 0, churned2: 0,
          total3: 0, churned3: 0,
          total4plus: 0, churned4plus: 0,
        };
        for (const c of allClients) {
          if (c.branchId !== b.id) continue;
          const n = enrollCount.get(c.id) ?? 0;
          if (n < 1) continue; // only customers who actually bought a lộ trình
          const churned = !ongoingProgramClientIds.has(c.id);
          if (n === 1) { row.total1 += 1; if (churned) row.churned1 += 1; }
          else if (n === 2) { row.total2 += 1; if (churned) row.churned2 += 1; }
          else if (n === 3) { row.total3 += 1; if (churned) row.churned3 += 1; }
          else { row.total4plus += 1; if (churned) row.churned4plus += 1; }
        }
        return row;
      }),
      churnedAfterOne: allClients
        .filter((c) => (enrollCount.get(c.id) ?? 0) === 1 && !ongoingProgramClientIds.has(c.id))
        .map((c) => {
          const e = lastEnrollment.get(c.id);
          return {
            id: c.id,
            fullName: c.fullName,
            branchId: c.branchId,
            branchName: c.branch.name,
            ptId: c.assignedPTId,
            ptName: c.assignedPT.name ?? c.assignedPT.email,
            packageName: e?.packageName ?? null,
            lostKg: Math.max(0, c.initialWeight - c.currentWeight),
            endDate: e?.endDate ? e.endDate.toISOString() : null,
          };
        }),
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
      orderBy: { createdAt: "desc" }, // newest clients first
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

  // Pass all recent logs (newest first) so the dashboard can paginate them client-side.
  const recentLogs = rawRecentLogs.map((log) => {
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
