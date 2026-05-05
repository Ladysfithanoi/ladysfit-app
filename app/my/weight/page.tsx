import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { PortalLayoutClient } from "@/components/my/portal-layout-client";
import { WeightTab } from "@/components/my/weight-tab";

export default async function WeightPage() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) redirect("/my/login");

  const clientId = session.user.id;

  const [client, weightLogs] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { fullName: true, targetWeight: true } }),
    prisma.weightLog.findMany({ where: { clientId }, orderBy: { date: "asc" } }),
  ]);

  if (!client) redirect("/my/login");

  const serializedLogs = weightLogs.map((l) => ({
    id: l.id,
    date: l.date.toISOString(),
    weight: l.weight,
    note: l.note,
  }));

  return (
    <PortalLayoutClient clientName={client.fullName}>
      <WeightTab weightLogs={serializedLogs} targetWeight={client.targetWeight} />
    </PortalLayoutClient>
  );
}
