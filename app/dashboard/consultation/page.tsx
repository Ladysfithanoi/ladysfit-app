import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConsultationListClient } from "@/components/consultation/consultation-list-client";

export default async function ConsultationPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const [consultations, branches, staff] = await Promise.all([
    prisma.consultation.findMany({
      where: isAdmin
        ? undefined
        : isFM
        ? { branchId: { in: managedBranchIds } }
        : { createdById: session.user.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
        info: { select: { fullName: true, phone: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    (isAdmin || isFM)
      ? prisma.user.findMany({
          // FM: filter to managed branches; skip filter if managedBranchIds is empty
          // to avoid `IN ()` returning nothing when branches aren't assigned yet
          where: {
            deletedAt: null,
            ...(isFM && managedBranchIds.length > 0 ? { branchId: { in: managedBranchIds } } : {}),
          },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const serialized = consultations.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  // For FM, use first managed branch as the default for new consultations
  const initialBranchId = isFM
    ? managedBranchIds[0] ?? null
    : session.user.branchId ?? null;

  return (
    <ConsultationListClient
      consultations={serialized}
      branches={branches}
      staff={staff}
      isAdmin={isAdmin}
      isFM={isFM}
      currentUserId={session.user.id}
      currentUserBranchId={initialBranchId}
      managedBranchIds={managedBranchIds}
    />
  );
}
