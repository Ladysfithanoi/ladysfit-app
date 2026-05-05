import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StaffPageClient } from "@/components/dashboard/staff-page-client";

export default async function StaffPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isCEO = role === "CEO_FITPARTNER";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const [staff, branches] = await Promise.all([
    prisma.user.findMany({
      where: (isAdmin || isCEO)
        ? undefined
        : isFM
        ? { branchId: { in: managedBranchIds } }
        : { branchId: session.user.branchId ?? undefined },
      include: {
        branch: { select: { id: true, name: true } },
        managedBranches: { include: { branch: { select: { id: true, name: true } } } },
        _count: { select: { clients: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <StaffPageClient
      initialStaff={staff}
      branches={branches}
      isAdmin={isAdmin}
      isFM={isFM}
      managedBranchIds={managedBranchIds}
    />
  );
}
