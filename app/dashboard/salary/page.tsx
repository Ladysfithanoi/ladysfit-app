export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalaryPage } from "@/components/dashboard/salary/salary-page";

export default async function SalaryPageRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isFM = role === "FM";
  const isPT = role === "FREE" || role === "RESTRICTED";
  if (!isFM && !isPT) redirect("/dashboard");

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];

  let branches: { id: string; name: string }[] = [];
  let staffList: { id: string; name: string | null; email: string; branchId: string | null; role: string }[] = [];

  if (isFM) {
    [branches, staffList] = await Promise.all([
      prisma.branch.findMany({
        where: { id: { in: managedBranchIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { branchId: { in: managedBranchIds }, role: { in: ["FREE", "RESTRICTED", "ADMIN"] } },
        select: { id: true, name: true, email: true, branchId: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);
  }

  return (
    <SalaryPage
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? session.user.email ?? ""}
      currentUserRole={role}
      managedBranchIds={managedBranchIds}
      branches={branches}
      staffList={staffList}
    />
  );
}
