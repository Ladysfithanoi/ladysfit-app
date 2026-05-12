import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FinancePage } from "@/components/dashboard/finance/finance-page";

export default async function FinancePageRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isCEO   = role === "CEO_FITPARTNER" || role === "COO";
  const isFM    = role === "FM";

  if (!isAdmin && !isCEO && !isFM) redirect("/dashboard");

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];

  const branches = await prisma.branch.findMany({
    where: (isAdmin || isCEO) ? {} : { id: { in: managedBranchIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <FinancePage
      branches={branches}
      currentUserId={session.user.id}
      currentUserRole={role}
      managedBranchIds={managedBranchIds}
      isReadOnly={isAdmin || isCEO}
    />
  );
}
