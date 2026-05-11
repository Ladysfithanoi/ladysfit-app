import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientsPageClient } from "@/components/dashboard/clients-page-client";

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
          where: { deletedAt: null, ...(isFM ? { branchId: { in: managedBranchIds } } : {}) },
          select: { id: true, name: true, branchId: true },
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
    const activePkg   = c.packageEnrollments.find((p) => p.status === "ACTIVE");
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
