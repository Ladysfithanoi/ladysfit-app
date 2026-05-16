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

  // Get PT's branch for PT role
  let ptBranchId: string | null = null;
  if (isPT) {
    const ptUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { branchId: true },
    });
    ptBranchId = ptUser?.branchId ?? null;
  }

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
      managedBranchIds={managedBranchIds}
    />
  );
}
