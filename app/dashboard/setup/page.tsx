import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SetupPage } from "@/components/dashboard/setup/setup-page";

export default async function Setup() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isPT = role === "PT";

  const branches = await prisma.branch.findMany({
    where: { name: { not: { contains: "Fitpartner" } } },
    orderBy: { name: "asc" },
  });

  const managedBranchIds = session.user.managedBranchIds ?? [];
  const isFM = role === "FM";

  const visibleBranches = isFM
    ? branches.filter((b) => managedBranchIds.includes(b.id))
    : branches;

  // The current user's home branch. Defaults the PT's branch, and lets an Admin
  // fill their OWN branch's weekly report (Admin works fixed at one branch).
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { branchId: true },
  });
  const userBranchId = me?.branchId ?? null;
  const ptBranchId = isPT ? userBranchId : null;

  // Read-only: no role in this app needs full read-only mode on the setup screen.
  // CEO/COO can edit arising tasks; ADMIN/FM/PT can all edit their own data.
  const isReadOnly = false;

  return (
    <SetupPage
      branches={visibleBranches}
      currentUserId={session.user.id}
      currentUserRole={role}
      userName={session.user.name ?? session.user.email ?? "FM"}
      isReadOnly={isReadOnly}
      ptBranchId={ptBranchId}
      userBranchId={userBranchId}
      managedBranchIds={managedBranchIds}
    />
  );
}
