import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { PortalLayoutClient } from "@/components/my/portal-layout-client";
import { SettingsTab } from "@/components/my/settings-tab";

export default async function SettingsPage() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) redirect("/my/login");

  const client = await prisma.client.findUnique({
    where: { id: session.user.id },
    select: { fullName: true, avatarUrl: true },
  });
  if (!client) redirect("/my/login");

  return (
    <PortalLayoutClient clientName={client.fullName} avatarUrl={client.avatarUrl}>
      <SettingsTab />
    </PortalLayoutClient>
  );
}
