import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { PortalLayoutClient } from "@/components/my/portal-layout-client";
import { OverviewTab } from "@/components/my/overview-tab";

export default async function MyPage() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) redirect("/my/login");

  const clientId = session.user.id;
  const todayStr = new Date().toISOString().split("T")[0];

  const [client, todayActivity, latestMeasurement] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.activityLog.findFirst({
      where: { clientId, date: { gte: new Date(todayStr), lt: new Date(new Date(todayStr).getTime() + 86400000) } },
    }),
    prisma.bodyMeasurementLog.findFirst({
      where: { clientId },
      orderBy: { measuredDate: "desc" },
    }),
  ]);

  if (!client) redirect("/my/login");

  return (
    <PortalLayoutClient clientName={client.fullName} avatarUrl={client.avatarUrl}>
      <OverviewTab
        clientName={client.fullName}
        initialWeight={client.initialWeight}
        currentWeight={client.currentWeight}
        targetWeight={client.targetWeight}
        todaySteps={todayActivity?.steps ?? null}
        todayGymMinutes={todayActivity?.minutesGym ?? null}
        latestMeasurement={latestMeasurement ? {
          measuredDate: latestMeasurement.measuredDate.toISOString(),
          waist:        latestMeasurement.waist,
          belly:        latestMeasurement.belly,
          armSize:      latestMeasurement.armSize,
          thighSize:    latestMeasurement.thighSize,
          calfSize:     latestMeasurement.calfSize,
        } : null}
      />
    </PortalLayoutClient>
  );
}
