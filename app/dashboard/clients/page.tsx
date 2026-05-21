import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientsPageClient } from "@/components/dashboard/clients-page-client";

type PkgRow = {
  packageName: string;
  status: string;
  sessions: number;
  sessionsUsed: number;
  startDate: Date | null;
  endDate: Date | null;
};

/**
 * Picks the most relevant ACTIVE package to display in the client list.
 * Priority (highest score first):
 *   3 = not expired + has sessions remaining  ← ideal, currently usable
 *   2 = not expired + no sessions left        ← valid but fully used
 *   1 = expired + has sessions remaining      ← stale, edge case
 *   0 = expired + no sessions                 ← worst, last resort
 * Within the same score, pick the one expiring soonest (motivates usage).
 */
function pickBestPackage(enrollments: PkgRow[]): PkgRow | null {
  const now = new Date();
  const active = enrollments.filter((p) => p.status === "ACTIVE");
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];

  return active.slice().sort((a, b) => {
    const aNotExpired = a.endDate ? a.endDate >= now : true;
    const bNotExpired = b.endDate ? b.endDate >= now : true;
    const aHasSessions = a.sessionsUsed < a.sessions;
    const bHasSessions = b.sessionsUsed < b.sessions;
    const aScore = (aNotExpired ? 2 : 0) + (aHasSessions ? 1 : 0);
    const bScore = (bNotExpired ? 2 : 0) + (bHasSessions ? 1 : 0);
    if (bScore !== aScore) return bScore - aScore;
    // Tiebreak: soonest expiring first (use it before it's gone)
    const aEnd = a.endDate?.getTime() ?? Infinity;
    const bEnd = b.endDate?.getTime() ?? Infinity;
    return aEnd - bEnd;
  })[0];
}

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const [clients, branches, staff] = await Promise.all([
    prisma.client.findMany({
      where: isAdmin
        ? undefined
        : isFM
        ? { branchId: { in: managedBranchIds } }
        : { assignedPTId: session.user.id },
      include: {
        assignedPT: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        packageEnrollments: {
          orderBy: { createdAt: "asc" },
          select: {
            packageName: true,
            status: true,
            sessions: true,
            sessionsUsed: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    (isAdmin || isFM)
      ? prisma.user.findMany({
          where: {
            deletedAt: null,
            role: { in: ["PT", "FM", "ADMIN"] },
            ...(isFM ? {
              OR: [
                { branchId: { in: managedBranchIds } },
                { role: "FM", managedBranches: { some: { branchId: { in: managedBranchIds } } } },
              ],
            } : {}),
          },
          select: {
            id: true,
            name: true,
            branchId: true,
            role: true,
            managedBranches: { select: { branchId: true } },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const threeDaysAgo = new Date(todayStart);
  threeDaysAgo.setDate(todayStart.getDate() - 3);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 7);

  const clientIds = clients.map((c) => c.id);

  const [latestScans, selfMeasurements] = await Promise.all([
    prisma.foodScanLog.groupBy({
      by: ["clientId"],
      _max: { scanDate: true },
      where: { clientId: { in: clientIds } },
    }),
    prisma.bodyMeasurementLog.findMany({
      where: {
        clientId:    { in: clientIds },
        measuredById: null,
        measuredDate: { gte: weekStart },
      },
      select: { clientId: true },
    }),
  ]);

  const scanMap = new Map(latestScans.map((s) => [s.clientId, s._max.scanDate]));
  const selfMeasuredSet = new Set(selfMeasurements.map((m) => m.clientId));

  const serialized = clients.map((c) => {
    const activePkg   = pickBestPackage(c.packageEnrollments);
    const latestScan  = scanMap.get(c.id) ?? null;
    return {
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      height: c.height,
      initialWeight: c.initialWeight,
      currentWeight: c.currentWeight,
      targetWeight: c.targetWeight,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      assignedPT: c.assignedPT,
      branch: c.branch,
      activePackage: activePkg
        ? {
            packageName: activePkg.packageName,
            sessions: activePkg.sessions,
            sessionsUsed: activePkg.sessionsUsed,
            startDate: activePkg.startDate?.toISOString() ?? null,
            endDate: activePkg.endDate?.toISOString() ?? null,
          }
        : null,
      packageNames: Array.from(new Set(c.packageEnrollments.map((p) => p.packageName))),
      avatarUrl: c.avatarUrl ?? null,
      foodLogToday:       latestScan != null && latestScan >= todayStart,
      foodLogStale:       latestScan == null || latestScan < threeDaysAgo,
      selfMeasuredThisWeek: selfMeasuredSet.has(c.id),
    };
  });

  return (
    <ClientsPageClient
      initialClients={serialized}
      branches={branches}
      staffList={staff}
      isAdmin={isAdmin}
      isFM={isFM}
      currentUserBranchId={session.user.branchId ?? null}
      managedBranchIds={managedBranchIds}
    />
  );
}
