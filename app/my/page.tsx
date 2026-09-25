import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { pickMeasurements } from "@/lib/body-measurements";
import { PortalLayoutClient } from "@/components/my/portal-layout-client";
import { OverviewTab } from "@/components/my/overview-tab";

export default async function MyPage() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) redirect("/my/login");

  const clientId = session.user.id;

  const [client, activityLogs, latestMeasurement] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    // Số bước chân mỗi ngày sống ở trang này — cần đủ dữ liệu cho biểu đồ tuần.
    prisma.activityLog.findMany({ where: { clientId }, orderBy: { date: "desc" }, take: 30 }),
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
        activityLogs={activityLogs.map((l) => ({
          id:            l.id,
          date:          l.date.toISOString(),
          steps:         l.steps,
          minutesActive: l.minutesActive,
          minutesGym:    l.minutesGym,
          note:          l.note,
        }))}
        latestMeasurement={latestMeasurement ? {
          measuredDate:  latestMeasurement.measuredDate.toISOString(),
          ...pickMeasurements(latestMeasurement),
        } : null}
      />
    </PortalLayoutClient>
  );
}
