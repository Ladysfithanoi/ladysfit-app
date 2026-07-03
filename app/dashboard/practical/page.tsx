import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PracticalPage } from "@/components/dashboard/practical/practical-page";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FM") redirect("/dashboard");

  return <PracticalPage />;
}
