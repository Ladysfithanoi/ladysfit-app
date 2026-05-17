import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GuidesPageClient } from "@/components/dashboard/guides-page-client";

export default async function GuidesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <GuidesPageClient />;
}
