import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ReportsPage } from "@/components/dashboard/reports-page";

export default async function Reports() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!["ADMIN", "FM", "CEO_FITPARTNER", "COO"].includes(session.user.role)) redirect("/dashboard");

  return <ReportsPage userRole={session.user.role} />;
}
