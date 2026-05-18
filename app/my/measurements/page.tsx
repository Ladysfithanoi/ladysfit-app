import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { PortalLayoutClient } from "@/components/my/portal-layout-client";
import { MeasurementsTab } from "@/components/my/measurements-tab";

export default async function MyMeasurementsPage() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) redirect("/my/login");

  const [client, logs] = await Promise.all([
    prisma.client.findUnique({ where: { id: session.user.id }, select: { fullName: true, avatarUrl: true } }),
    prisma.bodyMeasurementLog.findMany({
      where: { clientId: session.user.id },
      include: { measuredBy: { select: { id: true, name: true } } },
      orderBy: { measuredDate: "desc" },
    }),
  ]);

  if (!client) redirect("/my/login");

  const serialized = logs.map((l) => ({
    id:            l.id,
    measuredDate:  l.measuredDate.toISOString(),
    waist:         l.waist,
    belly:         l.belly,
    armSize:       l.armSize,
    armFromElbow:  l.armFromElbow,
    thighSize:     l.thighSize,
    thighFromKnee: l.thighFromKnee,
    calfSize:      l.calfSize,
    calfFromKnee:  l.calfFromKnee,
    notes:         l.notes,
    measuredBy:    l.measuredBy,
  }));

  return (
    <PortalLayoutClient clientName={client.fullName} avatarUrl={client.avatarUrl}>
      <MeasurementsTab initialLogs={serialized} />
    </PortalLayoutClient>
  );
}
