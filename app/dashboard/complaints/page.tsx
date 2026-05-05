import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ComplaintsPage } from "@/components/dashboard/complaints-page";

export default async function Complaints() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "FM") redirect("/dashboard");

  return <ComplaintsPage userRole="FM" />;
}
