import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChecklistPage } from "@/components/dashboard/checklist/checklist-page";

export default async function ChecklistPageRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isFM      = role === "FM";
  const isPT      = role === "FREE" || role === "RESTRICTED";
  const isAdmin   = role === "ADMIN";
  if (!isFM && !isPT && !isAdmin) redirect("/dashboard");

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];

  // Staff visible to current user
  let staffList: { id: string; name: string | null; email: string; branchId: string | null; role: string }[] = [];
  if (isAdmin) {
    staffList = await prisma.user.findMany({
      where: { role: { in: ["FREE", "RESTRICTED"] }, deletedAt: null },
      select: { id: true, name: true, email: true, branchId: true, role: true },
      orderBy: { name: "asc" },
    });
  } else if (isFM) {
    staffList = await prisma.user.findMany({
      where: { branchId: { in: managedBranchIds }, deletedAt: null },
      select: { id: true, name: true, email: true, branchId: true, role: true },
      orderBy: { name: "asc" },
    });
  } else {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, branchId: true, role: true },
    });
    if (me) staffList = [me];
  }

  return (
    <ChecklistPage
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? session.user.email ?? ""}
      currentUserRole={role}
      staffList={staffList}
      managedBranchIds={managedBranchIds}
      isAdmin={isAdmin}
    />
  );
}
